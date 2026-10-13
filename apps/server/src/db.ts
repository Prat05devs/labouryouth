import pg from 'pg';
import {settings} from './config.ts';

// BIGINT columns hold paise; keep them numbers like the Python API did (safe far beyond any real amount).
pg.types.setTypeParser(pg.types.builtins.INT8, value => Number(value));

/** Accepts the Python-style URL from the shared .env (postgresql+asyncpg://...?ssl=require) as well as a plain one. */
export function poolConfig(url = settings().databaseUrl, searchPath?: string): pg.PoolConfig {
  const parsed = new URL(url.replace(/^postgres(ql)?\+asyncpg:/, 'postgresql:'));
  const mode = parsed.searchParams.get('ssl') ?? parsed.searchParams.get('sslmode');
  for (const key of ['ssl', 'sslmode']) parsed.searchParams.delete(key);
  const encrypted = mode !== null && mode !== 'disable' && mode !== 'false';
  // Hosting panels often store a PEM on one line with literal \n sequences.
  const ca = process.env.DATABASE_CA_CERT?.replace(/\\n/g, '\n') || undefined;
  if (settings().appEnv === 'production') {
    const local = ['localhost', '127.0.0.1', '::1', '[::1]'].includes(parsed.hostname);
    if (!encrypted && !local) throw new Error('Production requires an encrypted database connection (ssl=require)');
    if (encrypted && !ca) throw new Error('Production requires DATABASE_CA_CERT so the database certificate is verified');
  }
  return {
    connectionString: parsed.toString(),
    // Without a CA this matches asyncpg ssl=require: encrypted, certificate not verified (development and staging only).
    ssl: encrypted ? (ca ? {ca} : {rejectUnauthorized: false}) : undefined,
    options: searchPath ? `-c search_path=${searchPath}` : undefined,
    max: Number(process.env.DATABASE_POOL_MAX) || 10,
  };
}

export type Row = Record<string, any>;

/** One request's transaction. Mirrors the SQLAlchemy session: commit at the end, roll back on any error. */
export class Tx {
  client: pg.PoolClient;
  constructor(client: pg.PoolClient) {
    this.client = client;
  }
  async query(sql: string, params: unknown[] = []): Promise<Row[]> {
    return (await this.client.query(sql, params)).rows;
  }
  async one(sql: string, params: unknown[] = []): Promise<Row | undefined> {
    return (await this.client.query(sql, params)).rows[0];
  }
  async value<T = unknown>(sql: string, params: unknown[] = []): Promise<T | undefined> {
    const row = await this.one(sql, params);
    return row ? (Object.values(row)[0] as T) : undefined;
  }
  /** Commits what is done so far and keeps going in a new transaction (rate limit counters, replay revocation). */
  async commit() {
    await this.client.query('COMMIT');
    await this.client.query('BEGIN');
  }
}

export async function transaction<T>(pool: pg.Pool, work: (tx: Tx) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await work(new Tx(client));
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}
