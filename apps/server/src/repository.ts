import type {Row, Tx} from './db.ts';
import {require} from './errors.ts';

const HIDDEN = new Set(['password_hash', 'refresh_hash', 'token_hash', 'storage_key', 'point', 'center', 'maps_url', 'contact_whatsapp']);

/** A row as the API returns it: secrets, raw geography and private contact columns removed. */
export function publicRow(row: Row, exclude: string[] = []): Row {
  return Object.fromEntries(
    Object.entries(row)
      .filter(([k]) => !HIDDEN.has(k) && !exclude.includes(k))
      // SQLAlchemy maps the `metadata` column to `metadata_`, which is the name the Python API returned.
      .map(([k, v]) => [k === 'metadata' ? 'metadata_' : k, v]),
  );
}

/** Loads one row by id or fails with NOT_FOUND. `table` is always a constant from the calling module. */
export async function get(tx: Tx, table: string, id: string, lock = false): Promise<Row> {
  const row = await tx.one(`SELECT * FROM ${table} WHERE id = $1${lock ? ' FOR UPDATE' : ''}`, [id]);
  require(row, 'NOT_FOUND', 404);
  return row;
}

/** The list envelope every collection endpoint returns; capped at 100 rows like the Python API. */
export async function listing(tx: Tx, sql: string, params: unknown[] = []) {
  return {items: (await tx.query(sql + ' LIMIT 100', params)).map(r => publicRow(r)), next_cursor: null};
}
