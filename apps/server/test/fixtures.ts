import assert from 'node:assert/strict';
import {call, user, type System, type Tokens} from './helpers.ts';

export const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64');
export const HERE = {latitude: 30.3165, longitude: 78.0322};

export async function upload(s: System, u: Tokens, purpose: string, content = PNG, type = 'image/png', status = 201) {
  const form = new FormData();
  form.set('purpose', purpose);
  form.set('file', new Blob([new Uint8Array(content)], {type}), 'evidence');
  const r = await fetch(s.base + '/api/v1/documents', {method: 'POST', headers: {Authorization: 'Bearer ' + u.access_token}, body: form});
  const text = await r.text();
  assert.equal(r.status, status, text);
  return JSON.parse(text);
}

/** A hirer with an onboarded client profile and an address pinned inside the test service area. */
export async function client(s: System, n: number) {
  const u = await user(s, n);
  await call(s, '/me/roles', {u, body: {role: 'CLIENT'}});
  const address = await call(s, '/addresses', {
    u,
    status: 201,
    body: {city_id: s.ids.city, label: 'Home', line1: 'Test road 1', locality: 'Centre', state: 'Test State', postal_code: '248001', ...HERE},
  });
  await call(s, '/client/profile', {u, method: 'PUT', body: {full_name: `Client ${n}`, client_type: 'INDIVIDUAL', primary_address_id: address.id}});
  return {u, address};
}

const admins = new WeakMap<System, Promise<Tokens>>();

/** One SUPER_ADMIN per test system. Staff roles are never self-assigned through the API, so the role is set in SQL. */
export function staff(s: System): Promise<Tokens> {
  if (!admins.has(s)) {
    admins.set(
      s,
      user(s, 999).then(async u => {
        await s.pool.query(`INSERT INTO user_roles (id, user_id, role) VALUES (gen_random_uuid(), $1, 'SUPER_ADMIN')`, [u.user.id]);
        return u;
      }),
    );
  }
  return admins.get(s)!;
}

/** A worker who completed onboarding, had evidence approved and was activated, all through the API. */
export async function worker(s: System, n: number) {
  const admin = await staff(s);
  const u = await user(s, n);
  const w = (await call(s, '/me/roles', {u, body: {role: 'WORKER'}})).worker_profile;
  const docs: Record<string, string> = {};
  for (const purpose of ['PHOTO', 'IDENTITY', 'POLICE']) {
    docs[purpose] = (await upload(s, u, purpose)).id;
    if (purpose !== 'PHOTO') {
      const v = await call(s, '/worker/verifications', {u, status: 201, body: {type: purpose, document_id: docs[purpose]}});
      await call(s, '/admin/verifications/' + v.id + '/approve', {u: admin, body: {reason: 'Evidence reviewed'}});
    }
  }
  await call(s, '/worker/availability', {u, method: 'PUT', body: {online: true, service_area_id: s.ids.area, ...HERE, radius_m: 10000}});
  const steps: Record<string, object> = {
    basic: {full_name: `Worker ${n}`},
    photo: {document_id: docs.PHOTO},
    services: {service_ids: [s.ids.service]},
    experience: {years: 2},
    languages: {codes: ['hi']},
    locations: {service_area_ids: [s.ids.area]},
    availability: {},
    identity: {},
    police: {},
    payout: {},
  };
  for (const [step, data] of Object.entries(steps)) await call(s, '/worker/onboarding/' + step, {u, method: 'PUT', body: {data}});
  await call(s, '/worker/onboarding/submit', {u, body: {}});
  await call(s, '/admin/workers/' + w.id + '/activate', {u: admin, body: {reason: 'All evidence approved'}});
  return {u, w, docs};
}

/** A submitted job starting in five minutes; `multi` makes a two-day MONTHLY job with two shifts. */
export async function job(s: System, c: {u: Tokens; address: any}, multi = false) {
  const start = Date.now() + 5 * 60_000;
  const day = 86_400_000;
  const schedule = Array.from({length: multi ? 2 : 1}, (_, i) => ({
    start_at: new Date(start + i * day).toISOString(),
    end_at: new Date(start + i * day + 2 * 3_600_000).toISOString(),
  }));
  const j = await call(s, '/jobs', {
    u: c.u,
    status: 201,
    body: {
      service_id: s.ids.service,
      service_area_id: s.ids.area,
      address_id: c.address.id,
      engagement_type: multi ? 'MONTHLY' : 'HOURLY',
      schedule,
      headcount: 1,
      requirements: {},
    },
  });
  await call(s, '/jobs/' + j.id + '/submit', {u: c.u, body: {}});
  return j;
}

/** An operations offer to a worker; a freshly submitted job gets matches generated first, as staff would. */
export async function offer(s: System, jobId: string, workerId: string, amount = 20000, status = 201) {
  const admin = await staff(s);
  const {rows} = await s.pool.query('SELECT status FROM job_requests WHERE id = $1', [jobId]);
  if (rows[0].status === 'SUBMITTED') await call(s, '/admin/jobs/' + jobId + '/generate-matches', {u: admin, body: {}});
  return call(s, '/admin/jobs/' + jobId + '/offers', {
    u: admin,
    status,
    body: {worker_id: workerId, expires_at: new Date(Date.now() + 20 * 60_000).toISOString(), agreed_worker_amount_paise: amount},
  });
}

export const observation = (at = new Date(), where = HERE) => ({...where, accuracy_m: 10, device_timestamp: at.toISOString()});
