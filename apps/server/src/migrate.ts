import {readFileSync, readdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import pg from 'pg';
import {poolConfig} from './db.ts';
import {SERVER_ROOT} from './paths.ts';

const DIR = resolve(SERVER_ROOT, 'migrations');
// The Alembic revision whose schema 0001_baseline.sql reproduces. A database already there skips the baseline.
const ALEMBIC_BASELINE = '0003_contact_maps';

/** Applies migrations/*.sql in name order, each once and in its own transaction. Safe to run on every deploy. */
export async function migrate(pool: pg.Pool, log = console.log) {
  const client = await pool.connect();
  try {
    await client.query('SELECT pg_advisory_lock(hashtext($1))', ['labour-youth-migrations']);
    await client.query('CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
    const done = new Set((await client.query('SELECT name FROM schema_migrations')).rows.map(r => r.name));
    if (!done.has('0001_baseline.sql')) {
      const alembic = await client.query(`SELECT to_regclass(quote_ident(current_schema()) || '.alembic_version') IS NOT NULL AS present`);
      if (alembic.rows[0].present) {
        const version = await client.query('SELECT version_num FROM alembic_version');
        if (version.rows[0]?.version_num !== ALEMBIC_BASELINE) {
          throw new Error(`Database is at Alembic ${version.rows[0]?.version_num}; upgrade it to ${ALEMBIC_BASELINE} first`);
        }
        await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', ['0001_baseline.sql']);
        done.add('0001_baseline.sql');
        log('Adopted existing Alembic schema as 0001_baseline.sql');
      }
    }
    for (const name of readdirSync(DIR).filter(f => f.endsWith('.sql')).sort()) {
      if (done.has(name)) continue;
      await client.query('BEGIN');
      try {
        await client.query(readFileSync(resolve(DIR, name), 'utf8'));
        await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [name]);
        await client.query('COMMIT');
        log('Applied ' + name);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }
  } finally {
    await client.query('SELECT pg_advisory_unlock(hashtext($1))', ['labour-youth-migrations']).catch(() => {});
    client.release();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const pool = new pg.Pool(poolConfig());
  try {
    await migrate(pool);
  } finally {
    await pool.end();
  }
}
