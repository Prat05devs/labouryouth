// Attack-style checks for the security review (docs/SECURITY_REVIEW.md, 13 October 2026).
import assert from 'node:assert/strict';
import {after, before, describe, test} from 'node:test';
import {SignJWT, decodeJwt} from 'jose';
import {settings} from '../src/config.ts';
import {call, system, user, type System} from './helpers.ts';

const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');

describe('security', () => {
  let s: System;
  before(async () => {
    s = await system();
  });
  after(async () => {
    await s.close();
  });

  test('forged, altered, foreign and expired access tokens are all rejected', async () => {
    const u = await user(s, 1);
    const claims = decodeJwt(u.access_token);
    const me = (token: string) => fetch(s.base + '/api/v1/me', {headers: {Authorization: 'Bearer ' + token}});
    assert.equal((await me(u.access_token)).status, 200);
    const none = b64({alg: 'none', typ: 'JWT'}) + '.' + b64(claims) + '.';
    const [h, p, sig] = u.access_token.split('.');
    const tampered = h + '.' + b64({...claims, sub: crypto.randomUUID()}) + '.' + sig;
    const key = new TextEncoder().encode(settings().jwtSecret);
    const sign = (over: object, aud = settings().jwtAudience, exp = '15m') =>
      new SignJWT({...claims, ...over}).setProtectedHeader({alg: 'HS256'}).setAudience(aud).setExpirationTime(exp).sign(key);
    const otherAudience = await sign({}, 'someone-else');
    const expired = await new SignJWT({...claims, exp: Math.floor(Date.now() / 1000) - 60}).setProtectedHeader({alg: 'HS256'}).sign(key);
    const wrongKey = await new SignJWT(claims).setProtectedHeader({alg: 'HS256'}).sign(new TextEncoder().encode('x'.repeat(64)));
    const unknownSession = await sign({sid: crypto.randomUUID()});
    for (const token of [none, tampered, otherAudience, expired, wrongKey, unknownSession, 'garbage', '']) {
      const r = await me(token);
      assert.equal(r.status, 401, token.slice(0, 20));
      assert.equal((await r.json()).error.code, 'SESSION_EXPIRED');
    }
    assert.ok(p);
  });

  test('a disabled account loses access immediately, including refresh', async () => {
    const u = await user(s, 2);
    await s.pool.query(`UPDATE users SET status = 'DISABLED' WHERE id = $1`, [u.user.id]);
    await call(s, '/me', {u, method: 'GET', status: 401});
    await call(s, '/auth/refresh', {body: {refresh_token: u.refresh_token}, status: 401});
  });

  test('CORS allows only configured origins and never credentials', async () => {
    const allowed = settings().allowedOrigins[0];
    const preflight = (origin: string) =>
      fetch(s.base + '/api/v1/me', {method: 'OPTIONS', headers: {Origin: origin, 'Access-Control-Request-Method': 'GET'}});
    const ok = await preflight(allowed);
    assert.equal(ok.status, 200);
    assert.equal(ok.headers.get('access-control-allow-origin'), allowed);
    assert.equal(ok.headers.get('access-control-allow-credentials'), null);
    const evil = await preflight('https://evil.example');
    assert.equal(evil.status, 400);
    assert.equal(evil.headers.get('access-control-allow-origin'), null);
    const simple = await fetch(s.base + '/health', {headers: {Origin: 'https://evil.example'}});
    assert.equal(simple.headers.get('access-control-allow-origin'), null);
  });

  test('injection attempts are rejected as validation errors, not executed', async () => {
    const u = await user(s, 3);
    const count = async () => (await s.pool.query('SELECT count(*)::int AS n FROM users')).rows[0].n;
    const before = await count();
    const sqli = "1' OR '1'='1";
    assert.equal((await call(s, '/addresses/' + encodeURIComponent(sqli), {u, method: 'PUT', status: 422, body: {}})).error.code, 'VALIDATION_ERROR');
    assert.equal((await fetch(`${s.base}/api/v1/public/jobs?service_id=${encodeURIComponent(sqli)}`)).status, 422);
    assert.equal((await fetch(`${s.base}/api/v1/public/jobs?limit=${encodeURIComponent('1; DROP TABLE users')}`)).status, 422);
    const login = await call(s, '/auth/login', {status: 401, body: {email: "x'--@example.com", password: sqli}});
    assert.equal(login.error.code, 'INVALID_CREDENTIALS');
    assert.equal(await count(), before);
    const polluted = await call(s, '/me/preferences', {u, method: 'PUT', status: 422, body: JSON.parse('{"last_active_mode":"CLIENT","__proto__":{"admin":true}}')});
    assert.equal(polluted.error.code, 'VALIDATION_ERROR');
    assert.equal(({} as any).admin, undefined);
  });

  test('oversized bodies are refused and errors never leak internals', async () => {
    const big = JSON.stringify({email: 'a@example.com', password: 'x'.repeat(2_000_000)});
    const r = await fetch(s.base + '/api/v1/auth/login', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: big});
    assert.equal(r.status, 413);
    const body = await r.text();
    assert.ok(!/at |node_modules|stack|pg|postgres/i.test(body), body);
    const bad = await fetch(s.base + '/api/v1/auth/login', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: '{"email": '});
    assert.ok(!/SyntaxError|position|JSON at/i.test(await bad.text()));
    for (const header of ['x-powered-by', 'server']) assert.equal(r.headers.get(header), null, header);
  });
});
