import assert from 'node:assert/strict';
import {after, before, describe, test} from 'node:test';
import {call, system, user, type System, type Tokens} from './helpers.ts';

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64');
const PDF = Buffer.from('%PDF-1.4\n%test\n');

async function upload(s: System, u: Tokens, purpose: string, content: Buffer, type: string, status = 201) {
  const form = new FormData();
  form.set('purpose', purpose);
  form.set('file', new Blob([new Uint8Array(content)], {type}), 'evidence');
  const r = await fetch(s.base + '/api/v1/documents', {method: 'POST', headers: {Authorization: 'Bearer ' + u.access_token}, body: form});
  const text = await r.text();
  assert.equal(r.status, status, text);
  return JSON.parse(text);
}

const fetchDoc = (s: System, u: Tokens, id: string) =>
  fetch(s.base + '/api/v1/documents/' + id, {headers: {Authorization: 'Bearer ' + u.access_token}});

describe('profiles', () => {
  let s: System;
  before(async () => {
    s = await system();
  });
  after(async () => {
    await s.close();
  });

  test('catalog and locations are public and never expose raw geography', async () => {
    const services = await call(s, '/services', {method: 'GET'});
    assert.deepEqual(services.items.map((x: any) => x.id), [s.ids.service]);
    assert.equal(services.next_cursor, null);
    const locations = await call(s, '/locations', {method: 'GET'});
    assert.equal(locations.cities[0].id, s.ids.city);
    assert.equal(locations.service_areas[0].id, s.ids.area);
    assert.equal('center' in locations.service_areas[0], false);
  });

  test('addresses, client profile and ownership', async () => {
    const client = await user(s, 1);
    const other = await user(s, 2);
    const base = {city_id: s.ids.city, label: 'Home', line1: 'Test road 1', locality: 'Centre', state: 'Test State', postal_code: '248001'};
    const pinned = await call(s, '/addresses', {u: client, status: 201, body: {...base, latitude: 30.3165, longitude: 78}});
    assert.equal(pinned.location_precision, 'PIN');
    assert.equal(pinned.longitude, '78.0');
    assert.equal('point' in pinned, false);
    const linked = await call(s, '/addresses', {u: client, status: 201, body: {...base, maps_url: 'https://maps.google.com/?q=30.32,78.04'}});
    assert.deepEqual([linked.latitude, linked.longitude, linked.location_precision], ['30.32', '78.04', 'PIN']);
    assert.equal('maps_url' in linked, false);
    const area = await call(s, '/addresses', {u: client, status: 201, body: base});
    assert.deepEqual([area.latitude, area.longitude, area.location_precision], ['30.3165', '78.0322', 'AREA']);
    const bad = await call(s, '/addresses', {u: client, status: 422, body: {...base, maps_url: 'https://evil.example/x'}});
    assert.equal(bad.error.code, 'MAPS_LINK_INVALID');
    await call(s, '/addresses', {u: client, status: 422, body: {...base, postal_code: '12'}});
    await call(s, '/addresses', {u: client, status: 404, body: {...base, city_id: crypto.randomUUID()}});
    const listed = await call(s, '/addresses', {u: client, method: 'GET'});
    assert.equal(listed.items.length, 3);
    assert.equal((await call(s, '/addresses', {u: other, method: 'GET'})).items.length, 0);
    await call(s, '/addresses/' + pinned.id, {u: other, method: 'PUT', status: 404, body: base});
    const bad_id = await call(s, '/addresses/not-a-uuid', {u: client, method: 'PUT', status: 422, body: base});
    assert.deepEqual(bad_id.error.details.fields, [{path: 'path.id', type: 'uuid_parsing'}]);
    const edited = await call(s, '/addresses/' + pinned.id, {u: client, method: 'PUT', body: {...base, label: 'Shop'}});
    assert.deepEqual([edited.label, edited.location_precision], ['Shop', 'AREA']);

    const profile = {full_name: 'Client One', primary_address_id: pinned.id, whatsapp_number: '98765 00011'};
    assert.equal((await call(s, '/client/profile', {u: client, method: 'PUT', status: 403, body: profile})).error.code, 'FORBIDDEN');
    await call(s, '/me/roles', {u: client, body: {role: 'CLIENT'}});
    await call(s, '/me/roles', {u: other, body: {role: 'CLIENT'}});
    await call(s, '/client/profile', {u: other, method: 'PUT', status: 404, body: profile});
    const saved = await call(s, '/client/profile', {u: client, method: 'PUT', body: profile});
    assert.equal(saved.onboarding_complete, true);
    assert.equal(saved.whatsapp_number, '+919876500011');
    assert.equal(saved.client_type, 'INDIVIDUAL');
    const me = await call(s, '/me', {u: client, method: 'GET'});
    assert.equal(me.full_name, 'Client One');
    assert.equal(me.client_profile.primary_address_id, pinned.id);
    assert.deepEqual(await call(s, '/client/profile', {u: client, method: 'GET'}), saved);
  });

  test('documents are private, type-checked by content and streamed only to the owner or reviewers', async () => {
    const owner = await user(s, 3);
    const stranger = await user(s, 4);
    await call(s, '/me/roles', {u: stranger, body: {role: 'CLIENT'}});
    const doc = await upload(s, owner, 'IDENTITY', PNG, 'image/png');
    assert.equal(doc.size_bytes, PNG.length);
    assert.equal('storage_key' in doc, false);
    const pdf = await upload(s, owner, 'POLICE', PDF, 'application/pdf');
    assert.equal(pdf.mime_type, 'application/pdf');
    assert.equal((await upload(s, owner, 'IDENTITY', PDF, 'image/png', 422)).error.code, 'UNSUPPORTED_FILE_TYPE');
    assert.equal((await upload(s, owner, 'PHOTO', PDF, 'application/pdf', 422)).error.code, 'UNSUPPORTED_FILE_TYPE');
    assert.equal((await upload(s, owner, 'SELFIE', PNG, 'image/png', 422)).error.code, 'VALIDATION_ERROR');
    assert.equal((await upload(s, owner, 'IDENTITY', Buffer.alloc(0), 'image/png', 422)).error.code, 'UPLOAD_TOO_LARGE');
    const big = Buffer.concat([PNG, Buffer.alloc(10_485_760)]);
    assert.equal((await upload(s, owner, 'IDENTITY', big, 'image/png', 422)).error.code, 'UPLOAD_TOO_LARGE');

    const mine = await fetchDoc(s, owner, doc.id);
    assert.equal(mine.status, 200);
    assert.deepEqual(Buffer.from(await mine.arrayBuffer()), PNG);
    assert.equal(mine.headers.get('content-type'), 'image/png');
    assert.equal(mine.headers.get('content-disposition'), 'attachment');
    assert.equal(mine.headers.get('cache-control'), 'no-store');
    assert.equal((await fetchDoc(s, stranger, doc.id)).status, 404);
    const photo = await upload(s, owner, 'PHOTO', PNG, 'image/png');
    assert.equal((await fetchDoc(s, stranger, photo.id)).status, 404);
    assert.equal((await fetchDoc(s, owner, photo.id)).headers.get('content-disposition'), 'inline');
    await s.pool.query(`INSERT INTO user_roles (id, user_id, role) VALUES (gen_random_uuid(), $1, 'VERIFICATION')`, [stranger.user.id]);
    assert.equal((await fetchDoc(s, stranger, doc.id)).status, 200);
  });

  test('worker onboarding runs step by step and submits once', async () => {
    const u = await user(s, 5);
    await call(s, '/worker/profile', {u, method: 'GET', status: 404});
    const w = (await call(s, '/me/roles', {u, body: {role: 'WORKER'}})).worker_profile;
    await call(s, '/worker/onboarding/submit', {u, body: {}, status: 422});
    await call(s, '/worker/onboarding/unknown', {u, method: 'PUT', body: {data: {}}, status: 422});
    await call(s, '/worker/onboarding/basic', {u, method: 'PUT', body: {data: {full_name: 'W', extra: 1}}, status: 422});
    await call(s, '/worker/onboarding/identity', {u, method: 'PUT', body: {data: {}}, status: 422});
    await call(s, '/worker/onboarding/availability', {u, method: 'PUT', body: {data: {}}, status: 422});
    await call(s, '/worker/onboarding/services', {u, method: 'PUT', body: {data: {service_ids: ['nope']}}, status: 422});
    await call(s, '/worker/onboarding/services', {u, method: 'PUT', body: {data: {service_ids: [crypto.randomUUID()]}}, status: 404});
    await call(s, '/worker/onboarding/experience', {u, method: 'PUT', body: {data: {years: 61}}, status: 422});

    const docs: Record<string, string> = {};
    for (const purpose of ['PHOTO', 'IDENTITY', 'POLICE']) {
      docs[purpose] = (await upload(s, u, purpose, PNG, 'image/png')).id;
      if (purpose !== 'PHOTO') {
        const v = await call(s, '/worker/verifications', {u, status: 201, body: {type: purpose, document_id: docs[purpose]}});
        assert.equal(v.status, 'PENDING');
      }
    }
    await call(s, '/worker/verifications', {u, status: 404, body: {type: 'BANK', document_id: docs.IDENTITY}});
    assert.equal((await call(s, '/worker/verifications', {u, method: 'GET'})).items.length, 2);

    assert.equal(await call(s, '/worker/availability', {u, method: 'GET'}), null);
    const offline = {online: false, service_area_id: s.ids.area};
    await call(s, '/worker/availability', {u, method: 'PUT', status: 422, body: {...offline, online: true}});
    await call(s, '/worker/availability', {u, method: 'PUT', status: 422, body: {...offline, latitude: 30.3}});
    const online = await call(s, '/worker/availability', {u, method: 'PUT', body: {...offline, online: true, latitude: 30.3165, longitude: 78.0322, radius_m: 10000}});
    assert.deepEqual([online.online, online.radius_m, online.kind, 'point' in online], [true, 10000, 'IMMEDIATE', false]);
    const off = await call(s, '/worker/availability', {u, method: 'PUT', body: offline});
    assert.deepEqual([off.id, off.online, off.radius_m], [online.id, false, 15000]);
    const {rows} = await s.pool.query('SELECT ST_AsText(point) AS p FROM worker_availability WHERE id = $1', [online.id]);
    assert.equal(rows[0].p, 'POINT(78.0322 30.3165)');

    const steps: Record<string, object> = {
      basic: {full_name: 'Worker Five'},
      photo: {document_id: docs.PHOTO},
      services: {service_ids: [s.ids.service, s.ids.service]},
      experience: {years: 2},
      languages: {codes: ['hi', 'en', 'hi']},
      locations: {service_area_ids: [s.ids.area]},
      availability: {},
      identity: {},
      police: {},
      payout: {bank: 'should be ignored'},
    };
    let last: any;
    for (const [step, data] of Object.entries(steps)) last = await call(s, '/worker/onboarding/' + step, {u, method: 'PUT', body: {data}});
    assert.equal(last.onboarding_status, 'IN_PROGRESS');
    assert.deepEqual(last.progress.payout, {deferred: true});
    const profile = await call(s, '/worker/profile', {u, method: 'GET'});
    assert.deepEqual(profile.services, [s.ids.service]);
    assert.deepEqual(profile.languages.sort(), ['en', 'hi']);
    assert.equal(profile.experience_years, 2);
    assert.equal((await call(s, '/me', {u, method: 'GET'})).full_name, 'Worker Five');

    const submitted = await call(s, '/worker/onboarding/submit', {u, body: {}});
    assert.equal(submitted.id, w.id);
    assert.equal(submitted.onboarding_status, 'SUBMITTED');
    assert.equal((await call(s, '/worker/onboarding/submit', {u, body: {}, status: 409})).error.code, 'INVALID_STATE_TRANSITION');
    await call(s, '/worker/onboarding/basic', {u, method: 'PUT', body: {data: {full_name: 'Changed'}}, status: 409});
  });

  test('a worker cannot attach another person\'s photo or document', async () => {
    const a = await user(s, 6);
    const b = await user(s, 7);
    await call(s, '/me/roles', {u: b, body: {role: 'WORKER'}});
    const photo = await upload(s, a, 'PHOTO', PNG, 'image/png');
    const id = await upload(s, a, 'IDENTITY', PNG, 'image/png');
    await call(s, '/worker/onboarding/photo', {u: b, method: 'PUT', body: {data: {document_id: photo.id}}, status: 404});
    await call(s, '/worker/verifications', {u: b, status: 404, body: {type: 'IDENTITY', document_id: id.id}});
  });
});

describe('seed', () => {
  test('loads the catalog and localities once, however often it runs', async () => {
    const {seed} = await import('../src/seed.ts');
    const s = await system();
    try {
      await seed(s.pool);
      await seed(s.pool);
      const {rows} = await s.pool.query(
        `SELECT (SELECT count(*)::int FROM service_categories WHERE slug <> 'test-service') AS services,
                (SELECT count(*)::int FROM localities) AS localities,
                (SELECT count(*)::int FROM service_areas WHERE slug = 'dehradun-central') AS areas,
                (SELECT verification_types FROM service_categories WHERE slug = 'driver') AS driver,
                (SELECT count(*)::int FROM users) AS users`,
      );
      assert.deepEqual(rows[0], {services: 23, localities: 9, areas: 1, driver: ['IDENTITY', 'POLICE', 'DRIVING_LICENSE'], users: 0});
    } finally {
      await s.close();
    }
  });
});
