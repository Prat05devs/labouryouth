// Port of apps/api tests/test_marketplace.py. Each test gets its own schema, as the Python fixture did.
import assert from 'node:assert/strict';
import {afterEach, beforeEach, describe, test} from 'node:test';
import {call, system, type System, type Tokens} from './helpers.ts';
import {HERE, client, worker} from './fixtures.ts';

const FAR = {latitude: 30.43, longitude: 78.0322}; // about 12.6 km north

const quickBody = (s: System, over: object = {}) => ({
  service_id: s.ids.service,
  service_area_id: s.ids.area,
  ...HERE,
  locality: 'Patel Nagar',
  start_at: new Date(Date.now() + 3 * 3_600_000).toISOString(),
  hours: 8,
  headcount: 1,
  wage_per_day_paise: 90000,
  ...over,
});

const quick = (s: System, u: Tokens, over: object = {}) => call(s, '/jobs/quick', {u, status: 201, body: quickBody(s, over)});

async function feed(s: System, u: Tokens, params: Record<string, string | number> = {}) {
  const query = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)]));
  return (await call(s, '/worker/jobs/nearby?' + query, {u, method: 'GET'})).items;
}

const get = (s: System, path: string) => fetch(s.base + '/api/v1' + path);

describe('marketplace', () => {
  let s: System;
  beforeEach(async () => {
    s = await system();
  });
  afterEach(async () => {
    await s.close();
  });

  test('quick post notifies and the feed filters by distance', async () => {
    const c = await client(s, 1);
    const {u} = await worker(s, 3);
    const j = await quick(s, c.u);
    assert.equal(j.status, 'MATCHING');
    assert.equal(j.notified_workers, 1);
    assert.ok((await call(s, '/notifications', {u, method: 'GET'})).items.some((n: any) => n.kind === 'NewJobNearby'));
    assert.deepEqual((await feed(s, u, {radius_km: 2})).map((x: any) => x.id), [j.id]);
    assert.deepEqual(await feed(s, u, {radius_km: 2, ...FAR}), []);
    assert.deepEqual((await feed(s, u, {radius_km: 20, ...FAR})).map((x: any) => x.id), [j.id]);
    assert.deepEqual(await feed(s, u, {min_wage_paise: 100000}), []);
    assert.equal((await feed(s, u, {today: 'false', min_wage_paise: 90000})).length, 1);
    const [item] = await feed(s, u);
    assert.deepEqual([item.locality, item.slots_left, item.employer_first_name, item.my_interest], ['Patel Nagar', 1, 'Client', null]);
    assert.deepEqual(item.employer_trust, {average: null, reviews: 0});
    for (const hidden of ['location_snapshot', 'schedule', 'point', 'maps_url', 'contact_whatsapp']) assert.equal(hidden in item, false, hidden);
    await call(s, '/worker/jobs/nearby?radius_km=3', {u, method: 'GET', status: 422});
    await call(s, '/worker/jobs/nearby?today=maybe', {u, method: 'GET', status: 422});
  });

  test('a client cannot use the worker feed and a worker cannot post', async () => {
    const c = await client(s, 1);
    const {u} = await worker(s, 3);
    await call(s, '/worker/jobs/nearby', {u: c.u, method: 'GET', status: 403});
    await call(s, '/jobs/quick', {u, status: 403, body: quickBody(s, {wage_per_day_paise: 50000})});
  });

  test('interest is idempotent and selection is owner-only', async () => {
    const c = await client(s, 1);
    const {u} = await worker(s, 3);
    const {u: other} = await worker(s, 4);
    const j = await quick(s, c.u);
    const first = await call(s, `/jobs/${j.id}/interest`, {u, status: 201, body: {}});
    const again = await call(s, `/jobs/${j.id}/interest`, {u, status: 201, body: {}});
    assert.equal(first.id, again.id);
    const listing = await call(s, `/jobs/${j.id}/interests`, {u: c.u, method: 'GET'});
    assert.equal(listing.items.length, 1);
    assert.ok(listing.items[0].worker_name.startsWith('Worker'));
    assert.deepEqual(listing.items[0].trust, {average: null, reviews: 0});
    await call(s, `/jobs/${j.id}/interests`, {u: other, method: 'GET', status: 404});
    await call(s, `/jobs/${j.id}/interests/${first.id}/select`, {u: other, status: 404, body: {}});
    await call(s, `/jobs/${j.id}/interest/withdraw`, {u, body: {}});
    await call(s, `/jobs/${j.id}/interest/withdraw`, {u, body: {}, status: 409});
    assert.deepEqual((await call(s, `/jobs/${j.id}/interests`, {u: c.u, method: 'GET'})).items, []);
    await call(s, `/jobs/${j.id}/interest`, {u, status: 201, body: {}});
  });

  test('selection creates an offer, the worker accepts, and capacity holds', async () => {
    const c = await client(s, 1);
    const {u: u1} = await worker(s, 3);
    const {u: u2} = await worker(s, 4);
    const j = await quick(s, c.u, {headcount: 1});
    const i1 = await call(s, `/jobs/${j.id}/interest`, {u: u1, status: 201, body: {}});
    const i2 = await call(s, `/jobs/${j.id}/interest`, {u: u2, status: 201, body: {}});
    const offer = await call(s, `/jobs/${j.id}/interests/${i1.id}/select`, {u: c.u, status: 201, body: {}});
    assert.deepEqual([offer.agreed_worker_amount_paise, offer.status], [90000, 'PENDING']);
    assert.equal((await call(s, `/jobs/${j.id}/interests/${i2.id}/select`, {u: c.u, status: 409, body: {}})).error.code, 'JOB_ALREADY_ASSIGNED');
    assert.equal((await call(s, `/jobs/${j.id}/interest`, {u: u1, status: 409, body: {}})).error.code, 'ALREADY_SELECTED');
    const accepted = await call(s, `/offers/${offer.id}/accept`, {u: u1, key: 'accept-market', body: {}});
    assert.equal(accepted.job_id, j.id);
    assert.deepEqual(await feed(s, u2), [], 'full jobs leave the feed');
  });

  test('a client can request a publicly listed worker after login', async () => {
    const c = await client(s, 1);
    const {u, w} = await worker(s, 3);
    const requested = await quick(s, c.u, {preferred_worker_id: w.id});
    assert.equal(requested.status, 'OFFERING');
    assert.equal(requested.notified_workers, 1);
    assert.ok(requested.preferred_offer_id);
    const offers = await call(s, '/offers', {u, method: 'GET'});
    assert.ok(offers.items.some((x: any) => x.id === requested.preferred_offer_id));
  });

  test('concurrent selection never overfills', async () => {
    const c = await client(s, 1);
    const {u: u1} = await worker(s, 3);
    const {u: u2} = await worker(s, 4);
    const j = await quick(s, c.u, {headcount: 1});
    const rows = [];
    for (const u of [u1, u2]) rows.push(await call(s, `/jobs/${j.id}/interest`, {u, status: 201, body: {}}));
    const results = await Promise.all(
      rows.map(r =>
        fetch(`${s.base}/api/v1/jobs/${j.id}/interests/${r.id}/select`, {
          method: 'POST',
          headers: {Authorization: 'Bearer ' + c.u.access_token, 'Content-Type': 'application/json'},
          body: '{}',
        }),
      ),
    );
    assert.deepEqual(results.map(r => r.status).sort(), [201, 409]);
  });

  test('the wage benchmark is hidden until enough real samples exist', async () => {
    const c = await client(s, 1);
    await quick(s, c.u);
    const thin = await call(s, `/wages/benchmark?service_id=${s.ids.service}`, {u: c.u, method: 'GET'});
    assert.deepEqual([thin.sample_size, thin.median_paise], [1, null]);
    for (const wage of [80000, 85000, 95000, 100000]) await quick(s, c.u, {wage_per_day_paise: wage});
    const full = await call(s, `/wages/benchmark?service_id=${s.ids.service}`, {u: c.u, method: 'GET'});
    assert.deepEqual([full.sample_size, full.median_paise, full.min_paise, full.max_paise], [5, 90000, 80000, 100000]);
    await call(s, '/wages/benchmark', {u: c.u, method: 'GET', status: 422});
  });

  test('guest browse is public, read-only and leaks nothing', async () => {
    const c = await client(s, 1);
    const {w} = await worker(s, 3);
    const j = await quick(s, c.u, {notes: 'call me on 9876543210'});
    const r = await get(s, '/public/jobs');
    assert.equal(r.status, 200);
    const blob = await r.text();
    const items = JSON.parse(blob).items;
    assert.equal(items.length, 1);
    assert.deepEqual([items[0].wage_paise, items[0].locality, items[0].id, items[0].service_id], [90000, 'Patel Nagar', j.id, s.ids.service]);
    for (const secret of ['9876543210', 'latitude', 'client_id', 'point', 'maps_url', 'contact_whatsapp']) assert.ok(!blob.includes(secret), secret);
    const detail = await get(s, `/public/jobs/${j.id}`);
    assert.equal(detail.status, 200);
    assert.equal((await detail.json()).headcount, 1);
    const people = (await (await get(s, '/public/workers')).json()).items;
    assert.equal(people.length, 1);
    assert.deepEqual([people[0].first_name, people[0].id, people[0].languages], ['Worker', w.id, ['hi']]);
    for (const key of ['user_id', 'email', 'phone_number', 'full_name', 'photo_document_id']) assert.equal(key in people[0], false, key);
    const person = await get(s, `/public/workers/${w.id}`);
    assert.equal(person.status, 200);
    assert.equal((await person.json()).verified, true);
    const post = await fetch(s.base + '/api/v1/public/jobs', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: '{}'});
    assert.equal(post.status, 405);
    assert.ok((await (await get(s, `/public/jobs?service_id=${s.ids.service}`)).json()).items.length);
    assert.equal((await get(s, `/public/workers/${crypto.randomUUID()}`)).status, 404);
    assert.equal((await get(s, '/public/jobs?limit=51')).status, 422);
  });

  test('a map link pin, the area fallback, and contact only after selection', async () => {
    const c = await client(s, 1);
    const {u: u1} = await worker(s, 3);
    const {u: u2} = await worker(s, 4);
    const linked = {latitude: null, longitude: null, maps_url: 'https://maps.google.com/?q=30.3165,78.0322'};
    const j = await quick(s, c.u, linked);
    assert.equal(j.location_precision, 'PIN');
    assert.equal('maps_url' in j, false);
    assert.equal('contact_whatsapp' in j, false);
    const approx = await quick(s, c.u, {latitude: null, longitude: null});
    assert.equal(approx.location_precision, 'AREA');
    const bad = await call(s, '/jobs/quick', {u: c.u, status: 422, body: quickBody(s, {latitude: null, longitude: null, maps_url: 'https://evil.example/x'})});
    assert.equal(bad.error.code, 'MAPS_LINK_INVALID');
    const outside = await call(s, '/jobs/quick', {u: c.u, status: 422, body: quickBody(s, {latitude: 31.5, longitude: 78.0322})});
    assert.equal(outside.error.code, 'OUTSIDE_SERVICE_AREA');
    const i1 = await call(s, `/jobs/${j.id}/interest`, {u: u1, status: 201, body: {}});
    await call(s, `/jobs/${j.id}/interest`, {u: u2, status: 201, body: {}});
    await call(s, `/jobs/${j.id}/contact`, {u: u1, method: 'GET', status: 404});
    await call(s, `/jobs/${j.id}/interests/${i1.id}/select`, {u: c.u, status: 201, body: {}});
    const contact = await call(s, `/jobs/${j.id}/contact`, {u: u1, method: 'GET'});
    assert.ok(contact.whatsapp.startsWith('+91'));
    assert.ok(contact.whatsapp_url.startsWith('https://wa.me/91'));
    assert.equal(contact.maps_url, linked.maps_url);
    assert.equal(contact.locality, 'Patel Nagar');
    await call(s, `/jobs/${j.id}/contact`, {u: u2, method: 'GET', status: 404});
    await call(s, `/jobs/${j.id}/contact`, {u: c.u, method: 'GET', status: 403});
    const publicJobs = await (await get(s, '/public/jobs')).text();
    assert.ok(!publicJobs.includes(contact.whatsapp) && !publicJobs.includes('maps.google'));
    assert.ok((await feed(s, u2)).every((x: any) => !JSON.stringify(x).includes('whatsapp')));
  });

  test('public browse is rate limited per client address', async () => {
    await s.pool.query(
      `INSERT INTO auth_attempts (id, bucket, window_start, count)
       SELECT gen_random_uuid(), encode(sha256('public:10.7.7.7'::bytea), 'hex'), w, 60
       FROM unnest(ARRAY[date_trunc('minute', now()), date_trunc('minute', now()) + interval '1 minute']) AS w`,
    );
    const r = await fetch(s.base + '/api/v1/public/jobs', {headers: {'X-Forwarded-For': '10.7.7.7'}});
    assert.equal(r.status, 429);
    assert.equal((await fetch(s.base + '/api/v1/public/jobs', {headers: {'X-Forwarded-For': '10.7.7.8'}})).status, 200);
  });
});
