import assert from 'node:assert/strict';
import {after, before, describe, test} from 'node:test';
import {call, system, type System, type Tokens} from './helpers.ts';
import {client, job, observation, offer, worker} from './fixtures.ts';

async function accept(s: System, offerId: string, u: Tokens, key = 'accept-' + offerId) {
  const r = await fetch(s.base + '/api/v1/offers/' + offerId + '/accept', {
    method: 'POST',
    headers: {Authorization: 'Bearer ' + u.access_token, 'Idempotency-Key': key, 'Content-Type': 'application/json'},
    body: '{}',
  });
  return {status: r.status, body: await r.json()};
}

describe('workflows', () => {
  let s: System;
  before(async () => {
    s = await system();
  });
  after(async () => {
    await s.close();
  });

  // Port of tests/test_operating_loop.py::test_full_loop_concurrent_accept_and_immutable_earnings.
  test('full loop: concurrent accept, geofence, idempotent completion and immutable earnings', async () => {
    const c = await client(s, 1);
    const one = await worker(s, 3);
    const two = await worker(s, 4);
    const j = await job(s, c);
    const o1 = await offer(s, j.id, one.w.id);
    const o2 = await offer(s, j.id, two.w.id);
    const responses = await Promise.all([accept(s, o1.id, one.u), accept(s, o2.id, two.u)]);
    assert.deepEqual(responses.map(r => r.status).sort(), [200, 409]);
    const win = responses[0].status === 200 ? 0 : 1;
    const u = [one.u, two.u][win];
    const o = [o1, o2][win];
    const a = responses[win].body;
    assert.equal(responses[1 - win].body.error.code, 'JOB_ALREADY_ASSIGNED');
    assert.equal((await accept(s, o.id, u)).body.id, a.id, 'same key replays the stored response');
    assert.equal((await accept(s, o.id, u, 'short')).body.error.code, 'IDEMPOTENCY_KEY_REQUIRED');
    await call(s, '/assignments/' + a.id, {u: [one.u, two.u][1 - win], method: 'GET', status: 404});
    const d = await call(s, '/assignments/' + a.id, {u, method: 'GET'});
    assert.equal(d.worker.full_name, `Worker ${win === 0 ? 3 : 4}`);
    const shift = d.shifts[0];
    assert.equal(shift.agreed_earning_paise, 20000);
    await call(s, '/shifts/' + shift.id + '/check-in', {u, key: 'too-early', body: observation(), status: 409});
    await call(s, '/assignments/' + a.id + '/arrived', {u, body: {}, status: 409});
    await call(s, '/assignments/' + a.id + '/en-route', {u, body: {}});
    await call(s, '/assignments/' + a.id + '/arrived', {u, body: {}});
    const bad = await call(s, '/shifts/' + shift.id + '/check-in', {u, key: 'outside-geofence', body: observation(new Date(), {latitude: 30.32, longitude: 78.2}), status: 409});
    assert.equal(bad.error.code, 'OUTSIDE_GEOFENCE');
    assert.deepEqual(bad.error.details, {retryable: true});
    const stale = await call(s, '/shifts/' + shift.id + '/check-in', {u, key: 'stale-position', body: observation(new Date(Date.now() - 10 * 60_000)), status: 409});
    assert.equal(stale.error.code, 'LOCATION_STALE');
    const vague = await call(s, '/shifts/' + shift.id + '/check-in', {u, key: 'vague-position', body: {...observation(), accuracy_m: 500}, status: 409});
    assert.equal(vague.error.code, 'LOCATION_INACCURATE');
    const body = observation();
    const checked = await call(s, '/shifts/' + shift.id + '/check-in', {u, key: 'correct-location', body});
    assert.equal(checked.status, 'IN_PROGRESS');
    assert.deepEqual(await call(s, '/shifts/' + shift.id + '/check-in', {u, key: 'correct-location', body}), checked);
    const conflict = await call(s, '/shifts/' + shift.id + '/check-in', {u, key: 'correct-location', body: {...body, accuracy_m: 11}, status: 409});
    assert.equal(conflict.error.code, 'IDEMPOTENCY_CONFLICT');
    for (let i = 0; i < 2; i++) await call(s, '/shifts/' + shift.id + '/complete', {u, key: 'complete-shift', body: {}});
    await call(s, '/shifts/' + shift.id + '/complete', {u, key: 'complete-again', body: {}, status: 409});
    const e = await call(s, '/worker/earnings', {u, method: 'GET'});
    assert.equal(e.balance_paise, 20000);
    assert.equal(e.items.length, 1);
    assert.equal(e.currency, 'INR');
    const done = await call(s, '/jobs/' + j.id, {u: c.u, method: 'GET'});
    assert.equal(done.status, 'COMPLETED');
    assert.ok(done.timeline.some((x: any) => x.type === 'ShiftCompleted'));
    await call(s, '/reviews', {u, status: 403, body: {assignment_id: a.id, rating: 5}});
    const review = await call(s, '/reviews', {u: c.u, status: 201, body: {assignment_id: a.id, rating: 5, comment: 'Great', tags: []}});
    assert.equal(review.reviewee_id, u.user.id);
    assert.equal((await call(s, '/reviews', {u: c.u, status: 409, body: {assignment_id: a.id, rating: 4}})).error.code, 'CONFLICT');
    const counts = await s.pool.query(
      `SELECT (SELECT count(*)::int FROM assignments) AS assignments, (SELECT count(*)::int FROM attendance_events WHERE type = 'REJECTED') AS rejected`,
    );
    assert.deepEqual(counts.rows[0], {assignments: 1, rejected: 3});
    await assert.rejects(s.pool.query('UPDATE worker_ledger_entries SET amount_paise = 0'), /immutable/);
    await assert.rejects(s.pool.query('DELETE FROM attendance_events'), /immutable/);
  });

  // Port of test_private_evidence_and_recurring_shifts (the parts that do not need the admin module).
  test('recurring job: two shifts, next shift, private evidence and replacement request', async () => {
    const c = await client(s, 10);
    const {u, docs} = await worker(s, 11);
    await fetch(s.base + '/api/v1/documents/' + docs.IDENTITY, {headers: {Authorization: 'Bearer ' + c.u.access_token}}).then(r => assert.equal(r.status, 404));
    const j = await job(s, c, true);
    const o = await offer(s, j.id, (await call(s, '/worker/profile', {u, method: 'GET'})).id, 30001);
    const a = (await accept(s, o.id, u, 'accept-recurring')).body;
    let d = await call(s, '/assignments/' + a.id, {u, method: 'GET'});
    assert.equal(d.shifts.length, 2);
    assert.deepEqual(d.shifts.map((x: any) => x.agreed_earning_paise), [15001, 15000]);
    await call(s, '/assignments/' + a.id + '/en-route', {u, body: {}});
    await call(s, '/assignments/' + a.id + '/arrived', {u, body: {}});
    const first = d.shifts[0];
    await call(s, '/shifts/' + first.id + '/check-in', {u, key: 'check-recurring', body: observation()});
    await call(s, '/assignments/' + a.id + '/prepare-next-shift', {u, body: {}, status: 409});
    await call(s, '/shifts/' + first.id + '/complete', {u, key: 'complete-recurring', body: {}});
    d = await call(s, '/assignments/' + a.id, {u, method: 'GET'});
    assert.equal(d.status, 'IN_PROGRESS');
    assert.equal(d.shifts[1].status, 'SCHEDULED');
    const next = await call(s, '/assignments/' + a.id + '/prepare-next-shift', {u, body: {}});
    assert.equal(next.status, 'ACCEPTED');
    const r = await call(s, '/replacements', {u: c.u, status: 201, body: {assignment_id: a.id, reason: 'CLIENT_REQUEST', details: 'Need a replacement'}});
    assert.equal(r.status, 'REQUESTED');
    assert.equal((await call(s, '/replacements', {u: c.u, status: 409, body: {assignment_id: a.id, reason: 'OTHER'}})).error.code, 'CONFLICT');
    assert.equal((await call(s, '/replacements', {u: c.u, method: 'GET'})).items.length, 1);
    const incident = await call(s, '/incidents', {u, status: 201, body: {assignment_id: a.id, type: 'SAFETY', description: 'Loose wiring on site'}});
    assert.equal(incident.status, 'OPEN');
    const notes = await call(s, '/notifications', {u: c.u, method: 'GET'});
    assert.ok(notes.items.some((x: any) => x.kind === 'ReplacementRequested'));
    const read = await call(s, '/notifications/' + notes.items[0].id + '/read', {u: c.u, body: {}});
    assert.ok(read.read_at);
    await call(s, '/notifications/' + notes.items[0].id + '/read', {u, body: {}, status: 404});
  });

  test('job input rules, ownership and cancellation', async () => {
    const c = await client(s, 20);
    const other = await client(s, 21);
    const {u: w} = await worker(s, 22);
    const start = Date.now() + 3_600_000;
    const at = (ms: number) => new Date(start + ms).toISOString();
    const base = {service_id: s.ids.service, service_area_id: s.ids.area, address_id: c.address.id, engagement_type: 'HOURLY', headcount: 1};
    const fields = async (body: object) => (await call(s, '/jobs', {u: c.u, status: 422, body})).error.details.fields;
    assert.deepEqual(await fields({...base, schedule: [{start_at: at(3_600_000), end_at: at(0)}]}), [{path: 'body.schedule.0', type: 'value_error'}]);
    assert.deepEqual(await fields({...base, schedule: [{start_at: at(0), end_at: at(90_000_000)}]}), [{path: 'body.schedule.0', type: 'value_error'}]);
    assert.deepEqual(await fields({...base, schedule: [{start_at: '2026-10-13T10:00:00', end_at: at(1)}]}).then(f => f[0].path), 'body.schedule.0.start_at');
    const two = [{start_at: at(0), end_at: at(3_600_000)}, {start_at: at(86_400_000), end_at: at(90_000_000)}];
    assert.deepEqual(await fields({...base, schedule: two}), [{path: 'body', type: 'value_error'}]);
    assert.deepEqual(await fields({...base, engagement_type: 'MONTHLY', schedule: two.slice(0, 1)}), [{path: 'body', type: 'value_error'}]);
    assert.deepEqual(await fields({...base, engagement_type: 'MONTHLY', schedule: [two[0], {start_at: at(1_800_000), end_at: at(5_000_000)}]}), [{path: 'body', type: 'value_error'}]);
    assert.deepEqual(await fields({...base, schedule: two.slice(0, 1), budget_min: 500, budget_max: 100}), [{path: 'body', type: 'value_error'}]);
    const past = {...base, schedule: [{start_at: new Date(Date.now() - 60_000).toISOString(), end_at: at(0)}]};
    assert.equal((await call(s, '/jobs', {u: c.u, status: 422, body: past})).error.code, 'SCHEDULE_INVALID');
    const good = {...base, schedule: two.slice(0, 1)};
    await call(s, '/jobs', {u: w, status: 403, body: good});
    await call(s, '/jobs', {u: other.u, status: 404, body: good});
    assert.equal((await call(s, '/jobs', {u: c.u, status: 422, body: {...good, requirements: {surprise: 1}}})).error.code, 'INVALID_REQUIREMENTS');
    const j = await call(s, '/jobs', {u: c.u, status: 201, body: {...good, budget_min: 100, budget_max: 500, notes: ' gate code 4 '}});
    assert.deepEqual(j.pricing, {status: 'QUOTE_REQUIRED', currency: 'INR', budget_min: 100, budget_max: 500});
    assert.equal(j.status, 'DRAFT');
    assert.equal(j.notes, 'gate code 4');
    assert.equal(j.location_snapshot.line1, 'Test road 1');
    for (const secret of ['point', 'maps_url', 'contact_whatsapp']) assert.equal(secret in j, false, secret);
    const {rows} = await s.pool.query('SELECT contact_whatsapp FROM job_requests WHERE id = $1', [j.id]);
    assert.equal(rows[0].contact_whatsapp, c.u.user.phone_number);
    await call(s, '/jobs/' + j.id, {u: other.u, method: 'GET', status: 404});
    await call(s, '/jobs/' + j.id + '/submit', {u: other.u, body: {}, status: 404});
    await call(s, '/jobs/' + j.id + '/submit', {u: c.u, body: {}});
    await call(s, '/jobs/' + j.id + '/submit', {u: c.u, body: {}, status: 409});
    assert.equal((await call(s, '/jobs', {u: c.u, method: 'GET'})).items[0].id, j.id);
    await call(s, '/jobs/' + j.id + '/matches', {u: c.u, method: 'GET', status: 403});
    await call(s, '/jobs/' + j.id + '/cancel', {u: other.u, body: {reason: 'not mine'}, status: 404});
    const cancelled = await call(s, '/jobs/' + j.id + '/cancel', {u: c.u, body: {reason: 'Plans changed'}});
    assert.equal(cancelled.status, 'CANCELLED');
    await call(s, '/jobs/' + j.id + '/cancel', {u: c.u, body: {reason: 'Again'}, status: 409});
  });

  test('offers: decline, expiry, eligibility at accept time and cancelled jobs', async () => {
    const c = await client(s, 30);
    const one = await worker(s, 31);
    const two = await worker(s, 32);
    const j = await job(s, c);
    const declined = await offer(s, j.id, one.w.id);
    await call(s, '/offers/' + declined.id + '/decline', {u: two.u, body: {}, status: 404});
    assert.equal((await call(s, '/offers/' + declined.id + '/decline', {u: one.u, body: {}})).status, 'DECLINED');
    assert.equal((await accept(s, declined.id, one.u)).body.error.code, 'JOB_ALREADY_ASSIGNED');
    assert.equal((await call(s, '/offers', {u: one.u, method: 'GET'})).items[0].status, 'DECLINED');

    const expired = await offer(s, j.id, two.w.id);
    await s.pool.query(`UPDATE job_offers SET expires_at = now() - interval '1 minute' WHERE id = $1`, [expired.id]);
    assert.equal((await accept(s, expired.id, two.u)).body.error.code, 'OFFER_EXPIRED');

    const offline = await offer(s, j.id, one.w.id);
    await call(s, '/worker/availability', {u: one.u, method: 'PUT', body: {online: false, service_area_id: s.ids.area}});
    assert.equal((await accept(s, offline.id, one.u)).body.error.code, 'WORKER_UNAVAILABLE');
    await call(s, '/worker/availability', {u: one.u, method: 'PUT', body: {online: true, service_area_id: s.ids.area, latitude: 30.3165, longitude: 78.0322}});
    await s.pool.query(`UPDATE worker_profiles SET rate_min_paise = 50000 WHERE id = $1`, [one.w.id]);
    assert.equal((await accept(s, offline.id, one.u, 'accept-rate-check')).body.error.code, 'RATE_MISMATCH');
    await s.pool.query(`UPDATE worker_profiles SET rate_min_paise = NULL WHERE id = $1`, [one.w.id]);
    await s.pool.query(`UPDATE worker_verifications SET status = 'REJECTED' WHERE worker_id = $1 AND type = 'POLICE'`, [one.w.id]);
    assert.equal((await accept(s, offline.id, one.u, 'accept-verify-check')).body.error.code, 'WORKER_NOT_VERIFIED');
    await s.pool.query(`UPDATE worker_verifications SET status = 'APPROVED' WHERE worker_id = $1`, [one.w.id]);

    // A worker already booked for an overlapping shift cannot take a second job at the same time.
    const a = (await accept(s, offline.id, one.u, 'accept-finally')).body;
    assert.equal(a.slot_number, 1);
    const k = await job(s, c);
    assert.equal((await offer(s, k.id, one.w.id, 20000, 409)).error.code, 'SCHEDULE_CONFLICT');

    await call(s, '/jobs/' + j.id + '/cancel', {u: c.u, body: {reason: 'No longer needed'}});
    const after = await call(s, '/assignments/' + a.id, {u: one.u, method: 'GET'});
    assert.equal(after.status, 'CANCELLED');
    assert.equal(after.shifts[0].status, 'CANCELLED');
    await call(s, '/assignments/' + a.id + '/en-route', {u: one.u, body: {}, status: 409});
    const free = await offer(s, k.id, two.w.id);
    assert.equal((await accept(s, free.id, two.u)).status, 200);
  });

  test('a worker cannot move or check in on someone else\'s assignment', async () => {
    const c = await client(s, 40);
    const mine = await worker(s, 41);
    const thief = await worker(s, 42);
    const j = await job(s, c);
    const a = (await accept(s, (await offer(s, j.id, mine.w.id)).id, mine.u)).body;
    const shift = (await call(s, '/assignments/' + a.id, {u: mine.u, method: 'GET'})).shifts[0];
    await call(s, '/assignments/' + a.id + '/en-route', {u: thief.u, body: {}, status: 404});
    await call(s, '/shifts/' + shift.id + '/check-in', {u: thief.u, key: 'steal-check-in', body: observation(), status: 404});
    await call(s, '/shifts/' + shift.id + '/manual-check-in-request', {u: thief.u, body: {reason: 'GPS broken'}, status: 404});
    await call(s, '/incidents', {u: thief.u, status: 404, body: {assignment_id: a.id, type: 'OTHER', description: 'Not my job'}});
    await call(s, '/replacements', {u: thief.u, status: 404, body: {assignment_id: a.id, reason: 'OTHER'}});
    await call(s, '/assignments/' + a.id + '/en-route', {u: mine.u, body: {}});
    await call(s, '/assignments/' + a.id + '/arrived', {u: mine.u, body: {}});
    const manual = await call(s, '/shifts/' + shift.id + '/manual-check-in-request', {u: mine.u, body: {reason: 'GPS is not working'}});
    assert.equal(manual.type, 'MANUAL_REQUEST');
    await s.pool.query(`UPDATE worker_profiles SET worker_status = 'SUSPENDED' WHERE id = $1`, [mine.w.id]);
    assert.equal((await call(s, '/shifts/' + shift.id + '/check-in', {u: mine.u, key: 'suspended-check', body: observation(), status: 409})).error.code, 'WORKER_NOT_VERIFIED');
  });
});
