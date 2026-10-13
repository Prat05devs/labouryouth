import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {after, before, describe, test} from 'node:test';
import {PASSWORD, call, system, user, type System} from './helpers.ts';

/** Puts a rate-limit bucket at its limit for the current and the next minute, as if the requests had been made. */
async function saturate(s: System, bucket: string, count: number) {
  await s.pool.query(
    `INSERT INTO auth_attempts (id, bucket, window_start, count)
     SELECT gen_random_uuid(), $1, w, $2 FROM unnest(ARRAY[date_trunc('minute', now()), date_trunc('minute', now()) + interval '1 minute']) AS w
     ON CONFLICT (bucket, window_start) DO UPDATE SET count = EXCLUDED.count`,
    [createHash('sha256').update(bucket).digest('hex'), count],
  );
}

describe('auth', () => {
  let s: System;
  before(async () => {
    s = await system();
  });
  after(async () => {
    await s.close();
  });

  // Port of apps/api tests/test_operating_loop.py::test_refresh_replay_and_normalization.
  test('refresh replay revokes the family and secrets are stored hashed', async () => {
    const u = await user(s, 1);
    const d = await call(s, '/auth/register', {
      status: 409,
      body: {full_name: 'Another', email: 'PERSON1@example.com', phone_number: '+919876500009', password: PASSWORD, confirm_password: PASSWORD},
    });
    assert.equal(d.error.code, 'EMAIL_ALREADY_REGISTERED');
    const fresh = await call(s, '/auth/refresh', {body: {refresh_token: u.refresh_token}});
    await call(s, '/auth/refresh', {body: {refresh_token: u.refresh_token}, status: 401});
    await call(s, '/me', {u: fresh, method: 'GET', status: 401});
    const {rows: users} = await s.pool.query('SELECT password_hash FROM users');
    assert.match(users[0].password_hash, /^\$argon2id\$v=19\$m=65536,t=3,p=4\$/);
    const {rows: sessions} = await s.pool.query('SELECT refresh_hash FROM sessions');
    for (const row of sessions) assert.ok(![u.refresh_token, fresh.refresh_token].includes(row.refresh_hash));
  });

  test('phone and email are normalized and duplicates rejected', async () => {
    const u = await call(s, '/auth/register', {
      status: 201,
      headers: {'X-Forwarded-For': '10.1.0.1'},
      body: {full_name: '  Asha Devi ', email: ' Asha@Example.COM ', phone_number: '98765 00042', password: PASSWORD, confirm_password: PASSWORD},
    });
    assert.equal(u.user.email, 'asha@example.com');
    assert.equal(u.user.phone_number, '+919876500042');
    assert.equal(u.user.full_name, 'Asha Devi');
    assert.equal(u.user.password_hash, undefined);
    const dup = await call(s, '/auth/register', {
      status: 409,
      headers: {'X-Forwarded-For': '10.1.0.2'},
      body: {full_name: 'Other', email: 'other@example.com', phone_number: '+91 98765 00042', password: PASSWORD, confirm_password: PASSWORD},
    });
    assert.equal(dup.error.code, 'PHONE_ALREADY_REGISTERED');
  });

  test('validation errors use the shared error shape', async () => {
    const r = await call(s, '/auth/register', {
      status: 422,
      body: {full_name: 'X', email: 'not-an-email', phone_number: '123', password: 'short', confirm_password: 'short', extra: 1},
    });
    assert.equal(r.error.code, 'VALIDATION_ERROR');
    assert.equal(r.error.message, 'Validation error');
    assert.ok(r.error.requestId);
    const paths = r.error.details.fields.map((f: any) => f.path);
    for (const p of ['body.full_name', 'body.email', 'body.password', 'body.extra']) assert.ok(paths.includes(p), p);
    const mismatch = await call(s, '/auth/register', {
      status: 422,
      body: {full_name: 'Mismatch', email: 'm@example.com', phone_number: '+919876500077', password: PASSWORD, confirm_password: PASSWORD + 'x'},
    });
    assert.deepEqual(mismatch.error.details.fields, [{path: 'body', type: 'value_error'}]);
    const empty = await call(s, '/auth/register', {status: 422});
    assert.ok(empty.error.details.fields.some((f: any) => f.path === 'body.email' && f.type === 'missing'));
  });

  test('login checks credentials and is rate limited per email', async () => {
    const u = await user(s, 3);
    const ok = await call(s, '/auth/login', {body: {email: 'PERSON3@example.com', password: PASSWORD}});
    assert.equal(ok.user.id, u.user.id);
    assert.equal(ok.token_type, 'bearer');
    const wrong = await call(s, '/auth/login', {body: {email: 'person3@example.com', password: 'wrong password'}, status: 401});
    assert.equal(wrong.error.code, 'INVALID_CREDENTIALS');
    const missing = await call(s, '/auth/login', {body: {email: 'nobody@example.com', password: PASSWORD}, status: 401});
    assert.equal(missing.error.code, 'INVALID_CREDENTIALS');
    // Counters are per clock minute; fill this minute and the next so the check cannot straddle a boundary.
    await saturate(s, 'login:person3@example.com', 10);
    const limited = await call(s, '/auth/login', {body: {email: 'person3@example.com', password: PASSWORD}, status: 429});
    assert.equal(limited.error.code, 'RATE_LIMITED');
  });

  test('registration is rate limited per client address', async () => {
    const headers = {'X-Forwarded-For': '10.9.9.9'};
    await saturate(s, 'register:10.9.9.9', 5);
    const limited = await call(s, '/auth/register', {status: 429, headers, body: {full_name: 'Rate 75', email: 'rate75@example.com', phone_number: '+919876500075', password: PASSWORD, confirm_password: PASSWORD}});
    assert.equal(limited.error.code, 'RATE_LIMITED');
  });

  test('roles, preferences and logout', async () => {
    const u = await user(s, 4);
    await call(s, '/me', {method: 'GET', status: 401});
    await call(s, '/me', {method: 'GET', status: 401, headers: {Authorization: 'Bearer not-a-token'}});
    const forbidden = await call(s, '/me/preferences', {u, method: 'PUT', body: {last_active_mode: 'WORKER'}, status: 403});
    assert.equal(forbidden.error.code, 'FORBIDDEN');
    const worker = await call(s, '/me/roles', {u, body: {role: 'WORKER'}});
    assert.deepEqual(worker.roles, ['WORKER']);
    assert.equal(worker.worker_profile.onboarding_status, 'NOT_STARTED');
    assert.deepEqual(worker.worker_profile.engagement_types, ['HOURLY', 'DAILY', 'FIXED_TERM', 'MONTHLY']);
    const again = await call(s, '/me/roles', {u, body: {role: 'WORKER'}});
    assert.deepEqual(again.roles, ['WORKER']);
    await call(s, '/me/roles', {u, body: {role: 'SUPER_ADMIN'}, status: 422});
    const prefs = await call(s, '/me/preferences', {u, method: 'PUT', body: {last_active_mode: 'WORKER'}});
    assert.deepEqual(prefs.preferences, {last_active_mode: 'WORKER', locale: 'en'});
    await call(s, '/auth/logout', {u, status: 204});
    await call(s, '/me', {u, method: 'GET', status: 401});
    await call(s, '/auth/refresh', {body: {refresh_token: u.refresh_token}, status: 401});
  });

  test('deletion request needs the password and revokes every session', async () => {
    const u = await user(s, 5);
    const second = await call(s, '/auth/login', {body: {email: 'person5@example.com', password: PASSWORD}});
    await call(s, '/me/deletion-request', {u, body: {password: 'wrong', confirm: true}, status: 401});
    await call(s, '/me/deletion-request', {u, body: {password: PASSWORD, confirm: false}, status: 422});
    const r = await call(s, '/me/deletion-request', {u, body: {password: PASSWORD, confirm: true}, status: 202});
    assert.equal(r.status, 'REQUESTED');
    await call(s, '/me', {u: second, method: 'GET', status: 401});
    await call(s, '/auth/login', {body: {email: 'person5@example.com', password: PASSWORD}, status: 401});
    const {rows} = await s.pool.query(`SELECT action FROM audit_logs WHERE entity_id = $1`, [u.user.id]);
    assert.deepEqual(rows, [{action: 'account.deletion_requested'}]);
  });

  test('password reset tokens are single use and revoke sessions', async () => {
    const forgot = await call(s, '/auth/forgot-password', {body: {email: 'person1@example.com'}, status: 503});
    assert.equal(forgot.error.code, 'EMAIL_UNAVAILABLE');
    const u = await user(s, 6);
    const raw = 'r'.repeat(64);
    await s.pool.query(
      `INSERT INTO password_resets (id, user_id, token_hash, expires_at) VALUES (gen_random_uuid(), $1, $2, now() + interval '30 minutes')`,
      [u.user.id, createHash('sha256').update(raw).digest('hex')],
    );
    const next = 'Another long password!';
    await call(s, '/auth/reset-password', {body: {token: raw, password: next, confirm_password: next}, status: 204});
    await call(s, '/me', {u, method: 'GET', status: 401});
    await call(s, '/auth/reset-password', {body: {token: raw, password: next, confirm_password: next}, status: 400});
    await call(s, '/auth/login', {body: {email: 'person6@example.com', password: next}});
  });

  test('unknown routes and malformed JSON return the error contract', async () => {
    const r = await fetch(s.base + '/api/v1/nowhere');
    assert.equal(r.status, 404);
    assert.equal((await r.json()).error.code, 'NOT_FOUND');
    assert.ok(r.headers.get('x-request-id'));
    assert.equal(r.headers.get('cache-control'), 'no-store');
    const bad = await fetch(s.base + '/api/v1/auth/login', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: '{'});
    assert.equal(bad.status, 422);
    const health = await fetch(s.base + '/health');
    assert.deepEqual(await health.json(), {status: 'ok'});
    const ready = await fetch(s.base + '/ready');
    assert.equal(ready.status, 200);
  });
});
