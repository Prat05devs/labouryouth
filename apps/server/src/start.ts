import pg from 'pg';
import {poolConfig} from './db.ts';
import {migrate} from './migrate.ts';

// Hostinger's Node.js apps have no pre-deploy hook, so the entry file applies pending migrations first.
// migrate() holds an advisory lock and records each file, so a second instance booting at once waits, then skips.
const pool = new pg.Pool(poolConfig());
try {
  await migrate(pool);
} finally {
  await pool.end();
}
await import('./index.ts');
