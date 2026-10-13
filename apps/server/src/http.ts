import {randomUUID} from 'node:crypto';
import express, {type NextFunction, type Request, type Response} from 'express';
import multer from 'multer';
import type pg from 'pg';
import {z} from 'zod';
import {settings} from './config.ts';
import {transaction, type Row, type Tx} from './db.ts';
import {DomainError, require} from './errors.ts';
import {authenticate, isUuid, roles, verifyAccess} from './security.ts';

export type Ctx = {
  tx: Tx;
  req: Request;
  requestId: string;
  ip: string;
  user: Row;
  sessionId: string;
  roles: string[];
};

type Options<B extends z.ZodType | undefined> = {status?: number; body?: B; auth?: boolean; upload?: boolean};
type Handler<B> = (ctx: Ctx, body: B) => Promise<unknown>;

/** A handler result sent as raw bytes (private documents) instead of JSON. */
export class FileReply {
  content: Buffer;
  headers: Record<string, string>;
  constructor(content: Buffer, headers: Record<string, string>) {
    this.content = content;
    this.headers = headers;
  }
}

const uploads = () =>
  multer({storage: multer.memoryStorage(), limits: {fileSize: settings().maxUploadBytes, files: 1, fields: 5, fieldSize: 1024}}).single('file');

function receiveUpload(req: Request, res: Response): Promise<void> {
  return new Promise((done, fail) =>
    uploads()(req, res, error => {
      if (!error) return done();
      if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') return fail(new DomainError('UPLOAD_TOO_LARGE', 422));
      fail(new DomainError('VALIDATION_ERROR', 422, {fields: [{path: 'body', type: 'value_error'}]}));
    }),
  );
}

/**
 * Registers one endpoint. Every request runs in a single transaction. Auth (when asked) loads the user, session
 * and roles on the server before the body is validated, so callers without a session learn nothing about the
 * schema. Routers never set statuses directly.
 */
export function route<B extends z.ZodType | undefined = undefined>(
  router: express.Router,
  method: 'get' | 'post' | 'put',
  path: string,
  options: Options<B>,
  handler: Handler<B extends z.ZodType ? z.output<B> : undefined>,
) {
  router[method](path, async (req: Request, res: Response) => {
    if (options.upload) {
      // Reject callers without a valid token before buffering up to MAX_UPLOAD_BYTES into memory.
      const header = req.get('authorization');
      require(header !== undefined && header.startsWith('Bearer '), 'SESSION_EXPIRED', 401);
      await verifyAccess(header.slice(7));
      await receiveUpload(req, res);
    }
    const pool: pg.Pool = req.app.locals.pool;
    const result = await transaction(pool, async tx => {
      const ctx = {tx, req, requestId: res.locals.requestId, ip: req.ip ?? 'unknown', roles: []} as unknown as Ctx;
      if (options.auth) {
        const header = req.get('authorization');
        require(header !== undefined && header.startsWith('Bearer '), 'SESSION_EXPIRED', 401);
        const {user, session} = await authenticate(tx, header.slice(7));
        ctx.user = user;
        ctx.sessionId = session.id;
        ctx.roles = await roles(tx, user.id);
      }
      const body = options.body ? parse(options.body, req.body) : undefined;
      return handler(ctx, body as never);
    });
    const status = options.status ?? 200;
    if (result instanceof FileReply) res.status(status).set(result.headers).send(result.content);
    else if (status === 204 || result === undefined) res.status(status).end();
    else res.status(status).json(result);
  });
}

/** A UUID path parameter, rejected like FastAPI's uuid.UUID path type. */
export function uuidParam(ctx: Ctx, name: string): string {
  const value = ctx.req.params[name];
  require(isUuid(value), 'VALIDATION_ERROR', 422, {fields: [{path: 'path.' + name, type: 'uuid_parsing'}]});
  return value.toLowerCase();
}

export function permit(ctx: Ctx, ...allowed: string[]) {
  require(ctx.roles.some(r => r === 'SUPER_ADMIN' || allowed.includes(r)), 'FORBIDDEN', 403);
}

// Pydantic's error types, so the 422 details stay the same as the Python API's.
function issueType(issue: z.core.$ZodIssue): string {
  switch (issue.code) {
    case 'invalid_type':
      return issue.input === undefined ? 'missing' : issue.expected + '_type';
    case 'too_small':
      return issue.origin === 'string' ? 'string_too_short' : issue.origin === 'array' ? 'too_short' : 'greater_than_equal';
    case 'too_big':
      return issue.origin === 'string' ? 'string_too_long' : issue.origin === 'array' ? 'too_long' : 'less_than_equal';
    case 'unrecognized_keys':
      return 'extra_forbidden';
    case 'invalid_value':
      return 'literal_error';
    case 'invalid_format':
      return issue.format === 'regex' ? 'string_pattern_mismatch' : 'value_error';
    default:
      return 'value_error';
  }
}

export function parse<B extends z.ZodType>(schema: B, input: unknown, where: 'body' | 'query' = 'body'): z.output<B> {
  const result = schema.safeParse(input ?? {});
  if (result.success) return result.data;
  const fields = result.error.issues.flatMap(issue => {
    const keys = issue.code === 'unrecognized_keys' ? issue.keys.map(k => [...issue.path, k]) : [issue.path];
    return keys.map(path => ({path: [where, ...path].join('.'), type: issueType(issue)}));
  });
  throw new DomainError('VALIDATION_ERROR', 422, {fields});
}

export function errorBody(res: Response, code: string, status: number, details: Record<string, unknown> = {}) {
  res.status(status).json({
    error: {
      code,
      message: code.charAt(0) + code.slice(1).toLowerCase().replaceAll('_', ' '),
      details,
      requestId: res.locals.requestId ?? randomUUID(),
    },
  });
}

export function createApp(pool: pg.Pool, routers: express.Router[]) {
  const cfg = settings();
  const prod = cfg.appEnv === 'production';
  const app = express();
  app.locals.pool = pool;
  app.disable('x-powered-by');
  // Hostinger runs the app behind its proxy. Trust only the hops it adds (TRUST_PROXY_HOPS, default 1), so the
  // client address comes from the proxy's own entry and a client cannot dodge rate limits by sending X-Forwarded-For.
  app.set('trust proxy', cfg.trustProxyHops);

  app.use((req, res, next) => {
    res.locals.requestId = randomUUID();
    res.set({
      'X-Request-ID': res.locals.requestId,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'no-referrer',
      // The API serves JSON and private documents only; nothing it returns may run scripts or be framed.
      'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'; sandbox",
      'Cross-Origin-Resource-Policy': 'same-site',
      ...(prod ? {'Strict-Transport-Security': 'max-age=31536000; includeSubDomains'} : {}),
    });
    const origin = req.get('origin');
    if (origin && cfg.allowedOrigins.includes(origin)) {
      res.set({'Access-Control-Allow-Origin': origin, Vary: 'Origin'});
      if (req.method === 'OPTIONS' && req.get('access-control-request-method')) {
        res.set({
          'Access-Control-Allow-Methods': 'GET, POST, PUT',
          'Access-Control-Allow-Headers': 'Authorization, Content-Type, Idempotency-Key, X-Request-ID',
          'Access-Control-Max-Age': '600',
        });
        res.status(200).end();
        return;
      }
    } else if (origin && req.method === 'OPTIONS' && req.get('access-control-request-method')) {
      res.status(400).type('text/plain').send('Disallowed CORS origin');
      return;
    }
    next();
  });
  app.use(express.json({limit: '1mb'}));

  app.get('/health', (_req, res) => {
    res.json({status: 'ok'});
  });
  app.get('/ready', async (_req, res) => {
    await pool.query('SELECT PostGIS_Version()');
    res.json({status: 'ready'});
  });
  for (const router of routers) app.use('/api/v1', router);

  app.use((_req, res) => errorBody(res, 'NOT_FOUND', 404));
  app.use((error: any, _req: Request, res: Response, _next: NextFunction) => {
    if (error instanceof DomainError) return errorBody(res, error.code, error.status, error.details);
    if (error?.type === 'entity.parse.failed') return errorBody(res, 'VALIDATION_ERROR', 422, {fields: [{path: 'body', type: 'json_invalid'}]});
    if (error?.type === 'entity.too.large') return errorBody(res, 'HTTP_ERROR', 413);
    // Class 23 is PostgreSQL's integrity violations (unique, foreign key, check), same as SQLAlchemy's IntegrityError.
    if (typeof error?.code === 'string' && error.code.startsWith('23')) return errorBody(res, 'CONFLICT', 409);
    console.error(`Unhandled error type=${error?.name ?? typeof error} request_id=${res.locals.requestId}`);
    return errorBody(res, 'INTERNAL_ERROR', 500);
  });
  return app;
}
