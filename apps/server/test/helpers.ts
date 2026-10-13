import './env.ts';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import type {AddressInfo} from 'node:net';
import pg from 'pg';
import {poolConfig} from '../src/db.ts';
import {createApp} from '../src/http.ts';
import {migrate} from '../src/migrate.ts';
import {routers} from '../src/routes.ts';

export type Ids = {city: string; area: string; service: string};
export type System = {base: string; pool: pg.Pool; ids: Ids; close: () => Promise<void>};

/** A fresh schema on the real PostgreSQL/PostGIS database from .env, with every migration applied, and a running app. */
export async function system(): Promise<System> {
  const schema = 'test_' + randomUUID().replaceAll('-', '');
  const admin = new pg.Pool(poolConfig());
  await admin.query(`CREATE SCHEMA "${schema}"`);
  const pool = new pg.Pool(poolConfig(undefined, `${schema},public`));
  await migrate(pool, () => {});
  const ids = {city: randomUUID(), area: randomUUID(), service: randomUUID()};
  await pool.query(
    `INSERT INTO cities (id, name, state, country, slug, timezone, active) VALUES ($1, 'Test City', 'Test State', 'IN', 'test-city', 'Asia/Kolkata', true)`,
    [ids.city],
  );
  await pool.query(
    `INSERT INTO service_areas (id, city_id, name, slug, center, radius_m, active)
     VALUES ($1, $2, 'Test Area', 'test-area', ST_GeogFromText('SRID=4326;POINT(78.0322 30.3165)'), 20000, true)`,
    [ids.area, ids.city],
  );
  await pool.query(
    `INSERT INTO service_categories (id, name, name_hi, slug, icon, active, sort_order, requirement_schema, verification_types)
     VALUES ($1, 'Test Service', 'सेवा', 'test-service', 'home', true, 0, $2, '["IDENTITY", "POLICE"]')`,
    [ids.service, {type: 'object', properties: {}, additionalProperties: false}],
  );
  const server = createApp(pool, routers).listen(0);
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return {
    base,
    pool,
    ids,
    close: async () => {
      await new Promise(resolve => server.close(resolve));
      await pool.end();
      await admin.query(`DROP SCHEMA "${schema}" CASCADE`);
      await admin.end();
    },
  };
}

export type Tokens = {access_token: string; refresh_token: string; user: any};

export async function call(s: System, path: string, opts: {body?: unknown; u?: Tokens; method?: string; key?: string; status?: number; headers?: Record<string, string>} = {}) {
  const headers: Record<string, string> = {'Content-Type': 'application/json', ...opts.headers};
  if (opts.u) headers.Authorization = 'Bearer ' + opts.u.access_token;
  if (opts.key) headers['Idempotency-Key'] = opts.key;
  const r = await fetch(s.base + '/api/v1' + path, {
    method: opts.method ?? 'POST',
    headers,
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
  const text = await r.text();
  assert.equal(r.status, opts.status ?? 200, `${path} ${r.status} ${text}`);
  return text ? JSON.parse(text) : null;
}

export const PASSWORD = 'A long test password!';

export function user(s: System, n: number): Promise<Tokens> {
  return call(s, '/auth/register', {
    status: 201,
    // A distinct client address per person, so the per-address registration limit does not trip in multi-user tests.
    headers: {'X-Forwarded-For': `10.0.${Math.floor(n / 250)}.${(n % 250) + 1}`},
    body: {
      full_name: `Person ${n}`,
      email: `person${n}@example.com`,
      phone_number: `+9198765${String(n).padStart(5, '0')}`,
      password: PASSWORD,
      confirm_password: PASSWORD,
    },
  });
}
