import {createHash, randomBytes, randomUUID} from 'node:crypto';
import {type Algorithm, hash, verify} from '@node-rs/argon2';
import {SignJWT, jwtVerify} from 'jose';
import {parsePhoneNumberWithError} from 'libphonenumber-js/max';
import {settings} from './config.ts';
import type {Row, Tx} from './db.ts';
import {DomainError, require} from './errors.ts';

// argon2-cffi's defaults, so hashes made by the Python API keep verifying and new ones match them.
// Algorithm is a const enum, which this build cannot read at runtime; 2 is Argon2id.
const ARGON = {algorithm: 2 as Algorithm, memoryCost: 65536, timeCost: 3, parallelism: 4, outputLen: 32};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const now = () => new Date();
export const token = () => randomBytes(48).toString('base64url');
export const digest = (value: string) => createHash('sha256').update(value).digest('hex');
export const hashPassword = (raw: string) => hash(raw, ARGON);
export const isUuid = (value: unknown): value is string => typeof value === 'string' && UUID.test(value);
export const DUMMY_HASH = await hashPassword(token());

export async function passwordOk(raw: string, encoded: string) {
  try {
    return await verify(encoded, raw);
  } catch {
    return false;
  }
}

export const normalizeEmail = (value: string) => value.trim().toLowerCase();

export function normalizePhone(value: string) {
  try {
    const number = parsePhoneNumberWithError(value, 'IN');
    require(number.isValid(), 'VALIDATION_ERROR', 422, {field: 'phone_number'});
    return number.number;
  } catch (error) {
    if (error instanceof DomainError) throw error;
    throw new DomainError('VALIDATION_ERROR', 422, {field: 'phone_number'});
  }
}

const key = () => new TextEncoder().encode(settings().jwtSecret);

export async function roles(tx: Tx, userId: string): Promise<string[]> {
  return (await tx.query('SELECT role FROM user_roles WHERE user_id = $1', [userId])).map(r => r.role);
}

export async function issue(tx: Tx, user: Row, familyId?: string, device: Row = {}) {
  const cfg = settings();
  const raw = token();
  const sessionId = randomUUID();
  await tx.query(
    `INSERT INTO sessions (id, user_id, family_id, refresh_hash, expires_at, device)
     VALUES ($1, $2, $3, $4, now() + make_interval(days => $5), $6)`,
    [sessionId, user.id, familyId ?? randomUUID(), digest(raw), cfg.refreshTokenDays, device],
  );
  const access = await new SignJWT({sid: sessionId})
    .setProtectedHeader({alg: 'HS256', typ: 'JWT'})
    .setSubject(user.id)
    .setIssuer(cfg.jwtIssuer)
    .setAudience(cfg.jwtAudience)
    .setIssuedAt()
    .setExpirationTime(`${cfg.accessTokenMinutes}m`)
    .sign(key());
  return {access_token: access, refresh_token: raw, token_type: 'bearer', expires_in: cfg.accessTokenMinutes * 60};
}

/** Checks the access token's signature and claims only (no database). */
export async function verifyAccess(bearer: string) {
  const cfg = settings();
  let uid: string, sid: string;
  try {
    const {payload} = await jwtVerify(bearer, key(), {
      algorithms: ['HS256'],
      issuer: cfg.jwtIssuer,
      audience: cfg.jwtAudience,
      requiredClaims: ['exp', 'iat', 'sub', 'sid'],
    });
    uid = payload.sub as string;
    sid = payload.sid as string;
  } catch {
    throw new DomainError('SESSION_EXPIRED', 401);
  }
  require(isUuid(uid) && isUuid(sid), 'SESSION_EXPIRED', 401);
  return {uid, sid};
}

export async function authenticate(tx: Tx, bearer: string) {
  const {uid, sid} = await verifyAccess(bearer);
  const session = await tx.one('SELECT * FROM sessions WHERE id = $1', [sid]);
  const user = await tx.one('SELECT * FROM users WHERE id = $1', [uid]);
  require(
    session && user && session.user_id === uid && session.revoked_at === null && session.expires_at > now() && user.status === 'ACTIVE',
    'SESSION_EXPIRED',
    401,
  );
  return {user, session};
}

export async function refresh(tx: Tx, raw: string) {
  const session = await tx.one('SELECT * FROM sessions WHERE refresh_hash = $1 FOR UPDATE', [digest(raw)]);
  require(session, 'SESSION_EXPIRED', 401);
  if (session.consumed_at || session.revoked_at) {
    await tx.query('UPDATE sessions SET revoked_at = now() WHERE family_id = $1', [session.family_id]);
    await tx.commit(); // Replay revocation must survive the error response's rollback.
    throw new DomainError('SESSION_EXPIRED', 401);
  }
  require(session.expires_at > now(), 'SESSION_EXPIRED', 401);
  const user = await tx.one('SELECT * FROM users WHERE id = $1', [session.user_id]);
  require(user && user.status === 'ACTIVE', 'SESSION_EXPIRED', 401);
  await tx.query('UPDATE sessions SET consumed_at = now() WHERE id = $1', [session.id]);
  return issue(tx, user, session.family_id, session.device);
}

export async function throttle(tx: Tx, bucket: string, limit = 10) {
  const count = await tx.value<number>(
    `INSERT INTO auth_attempts (id, bucket, window_start, count) VALUES ($1, $2, date_trunc('minute', now()), 1)
     ON CONFLICT (bucket, window_start) DO UPDATE SET count = auth_attempts.count + 1
     RETURNING count`,
    [randomUUID(), digest(bucket)],
  );
  if (Math.random() < 0.01) await tx.query(`DELETE FROM auth_attempts WHERE window_start < now() - interval '1 day'`);
  await tx.commit(); // Persist the abuse counter even when the credentials are rejected.
  require(count! <= limit, 'RATE_LIMITED', 429);
}
