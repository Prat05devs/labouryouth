import assert from 'node:assert/strict';
import {after, before, describe, test} from 'node:test';
import {call, system, user, type System, type Tokens} from './helpers.ts';
import {client, job, observation, offer, staff, upload, worker} from './fixtures.ts';

const grant = (s: System, u: Tokens, role: string) =>
  s.pool.query(`INSERT INTO user_roles (id, user_id, role) VALUES (gen_random_uuid(), $1, $2)`, [u.user.id, role]);

async function accept(s: System, offerId: string, u: Tokens) {
  return call(s, '/offers/' + offerId + '/accept', {u, key: 'accept-' + offerId, body: {}});
}

describe('admin', () => {
  let s: System;
  before(async () => {
    s = await system();
  });
  after(async () => {
    await s.close();
  });

  test('staff sections are role-gated and hide their names from non-staff', async () => {
    const admin = await staff(s);
    const nobody = await user(s, 1);
    const finance = await user(s, 2);
    await grant(s, finance, 'FINANCE');
    await call(s, '/admin/overview', {u: nobody, method: 'GET', status: 403});
    assert.equal((await call(s, '/admin/workers', {u: nobody, method: 'GET', status: 403})).error.code, 'FORBIDDEN');
    assert.equal((await call(s, '/admin/nothing', {u: nobody, method: 'GET', status: 403})).error.code, 'FORBIDDEN');
    await call(s, '/admin/nothing', {u: finance, method: 'GET', status: 404});
    await call(s, '/admin/constructor', {u: finance, method: 'GET', status: 404});
    await call(s, '/admin/workers', {u: finance, method: 'GET', status: 403});
    assert.deepEqual((await call(s, '/admin/payments', {u: finance, method: 'GET'})).items, []);
    const overview = await call(s, '/admin/overview', {u: admin, method: 'GET'});
    assert.deepEqual(Object.keys(overview).sort(), ['active_assignments', 'open_jobs', 'open_replacements', 'pending_verifications']);
    for (const section of ['workers', 'clients', 'jobs', 'assignments', 'replacements', 'attendance', 'payments', 'ledger', 'incidents', 'verifications']) {
      assert.ok(Array.isArray((await call(s, '/admin/' + section, {u: admin, method: 'GET'})).items), section);
    }
  });

  test('verification review, rejection and activation rules', async () => {
    const admin = await staff(s);
    const u = await user(s, 10);
    const w = (await call(s, '/me/roles', {u, body: {role: 'WORKER'}})).worker_profile;
    const doc = await upload(s, u, 'IDENTITY');
    const v = await call(s, '/worker/verifications', {u, status: 201, body: {type: 'IDENTITY', document_id: doc.id}});
    await call(s, '/admin/verifications/' + v.id + '/approve', {u, body: {reason: 'Approving myself'}, status: 403});
    await call(s, '/admin/workers/' + w.id + '/activate', {u: admin, body: {reason: 'Too early'}, status: 409});
    await call(s, '/worker/onboarding/basic', {u, method: 'PUT', body: {data: {full_name: 'Worker Ten'}}});
    const rejected = await call(s, '/admin/verifications/' + v.id + '/reject', {u: admin, body: {reason: 'Photo is blurred'}});
    assert.deepEqual([rejected.status, rejected.reason, rejected.reviewer_id], ['REJECTED', 'Photo is blurred', admin.user.id]);
    await call(s, '/admin/verifications/' + v.id + '/approve', {u: admin, body: {reason: 'Changed my mind'}, status: 409});
    const detail = await call(s, '/admin/workers/' + w.id, {u: admin, method: 'GET'});
    assert.equal(detail.full_name, 'Worker Ten');
    assert.equal(detail.phone_number, u.user.phone_number);
    assert.equal(detail.verifications[0].status, 'REJECTED');
    // Submitted with only IDENTITY approved, a POLICE-requiring service still blocks activation.
    await s.pool.query(`UPDATE worker_verifications SET status = 'APPROVED' WHERE id = $1`, [v.id]);
    await s.pool.query(`INSERT INTO worker_services (id, worker_id, service_id) VALUES (gen_random_uuid(), $1, $2)`, [w.id, s.ids.service]);
    await s.pool.query(`UPDATE worker_profiles SET onboarding_status = 'SUBMITTED' WHERE id = $1`, [w.id]);
    assert.equal((await call(s, '/admin/workers/' + w.id + '/activate', {u: admin, body: {reason: 'Looks fine'}, status: 409})).error.code, 'WORKER_NOT_VERIFIED');
    const {rows} = await s.pool.query(`SELECT action FROM audit_logs WHERE entity_id = $1`, [v.id]);
    assert.deepEqual(rows, [{action: 'verification.rejected'}]);
  });

  test('offer creation checks state, expiry, price and capacity', async () => {
    const admin = await staff(s);
    const c = await client(s, 20);
    const one = await worker(s, 21);
    const two = await worker(s, 22);
    const j = await job(s, c);
    const body = (over: object) => ({worker_id: one.w.id, expires_at: new Date(Date.now() + 600_000).toISOString(), agreed_worker_amount_paise: 100, ...over});
    assert.equal((await call(s, '/admin/jobs/' + j.id + '/offers', {u: admin, status: 409, body: body({})})).error.code, 'INVALID_STATE_TRANSITION');
    const matches = await call(s, '/admin/jobs/' + j.id + '/generate-matches', {u: admin, body: {}});
    assert.equal(matches.items.length, 2);
    assert.ok(matches.items.every((m: any) => m.final_score === 100 && m.distance_m === 0));
    assert.deepEqual(matches.items[0].metadata_, {version: 1, eligibility: 'passed'});
    assert.equal((await call(s, '/jobs/' + j.id + '/matches', {u: admin, method: 'GET'})).items.length, 2);
    const offers = '/admin/jobs/' + j.id + '/offers';
    assert.equal((await call(s, offers, {u: admin, status: 422, body: body({expires_at: new Date(Date.now() - 1000).toISOString()})})).error.code, 'OFFER_EXPIRY_INVALID');
    assert.equal((await call(s, offers, {u: admin, status: 422, body: body({expires_at: new Date(Date.now() + 86_400_000).toISOString()})})).error.code, 'OFFER_EXPIRY_INVALID');
    assert.equal((await call(s, offers, {u: admin, status: 422, body: body({agreed_worker_amount_paise: 0})})).error.code, 'QUOTE_REQUIRED');
    const o = await call(s, offers, {u: admin, status: 201, body: body({})});
    assert.equal(o.status, 'PENDING');
    assert.equal((await call(s, offers, {u: admin, status: 409, body: body({})})).error.code, 'CONFLICT');
    assert.ok((await call(s, '/notifications', {u: one.u, method: 'GET'})).items.some((n: any) => n.kind === 'OfferCreated'));
    await accept(s, o.id, one.u);
    assert.equal((await call(s, offers, {u: admin, status: 409, body: body({worker_id: two.w.id})})).error.code, 'JOB_ALREADY_ASSIGNED');
  });

  test('manual attendance: approve once, never a fake geo pass', async () => {
    const admin = await staff(s);
    const c = await client(s, 30);
    const w = await worker(s, 31);
    const j = await job(s, c);
    const a = await accept(s, (await offer(s, j.id, w.w.id)).id, w.u);
    const shift = (await call(s, '/assignments/' + a.id, {u: w.u, method: 'GET'})).shifts[0];
    await call(s, '/assignments/' + a.id + '/en-route', {u: w.u, body: {}});
    await call(s, '/assignments/' + a.id + '/arrived', {u: w.u, body: {}});
    const first = await call(s, '/shifts/' + shift.id + '/manual-check-in-request', {u: w.u, body: {reason: 'GPS will not lock'}});
    const second = await call(s, '/shifts/' + shift.id + '/manual-check-in-request', {u: w.u, body: {reason: 'Still no GPS'}});
    await call(s, '/admin/attendance/' + first.id + '/approve', {u: c.u, body: {reason: 'I am the client'}, status: 403});
    assert.equal((await call(s, '/admin/attendance/' + second.id + '/reject', {u: admin, body: {reason: 'Duplicate request'}})).status, 'REJECTED');
    await call(s, '/admin/attendance/' + second.id + '/approve', {u: admin, body: {reason: 'Now approve'}, status: 409});
    const approved = await call(s, '/admin/attendance/' + first.id + '/approve', {u: admin, body: {reason: 'Called the client, worker on site'}});
    assert.equal(approved.status, 'IN_PROGRESS');
    await call(s, '/admin/attendance/' + first.id + '/approve', {u: admin, body: {reason: 'Again'}, status: 409});
    const {rows} = await s.pool.query(`SELECT type, observation FROM attendance_events WHERE shift_id = $1 ORDER BY created_at`, [shift.id]);
    assert.deepEqual(rows.map(r => r.type), ['MANUAL_REQUEST', 'MANUAL_REQUEST', 'MANUAL_CHECK_IN']);
    assert.deepEqual(rows[2].observation, {request_event_id: first.id});
    assert.equal(rows.some(r => r.type === 'CHECK_IN'), false);
    await call(s, '/shifts/' + shift.id + '/complete', {u: w.u, key: 'complete-manual', body: {}});
    assert.equal((await call(s, '/jobs/' + j.id, {u: c.u, method: 'GET'})).status, 'COMPLETED');
  });

  test('replacement: rematch excludes the original worker and acceptance moves the remaining shifts', async () => {
    const admin = await staff(s);
    const c = await client(s, 40);
    const original = await worker(s, 41);
    const backup = await worker(s, 42);
    const j = await job(s, c, true);
    const a = await accept(s, (await offer(s, j.id, original.w.id, 30000)).id, original.u);
    const r = await call(s, '/replacements', {u: c.u, status: 201, body: {assignment_id: a.id, reason: 'NO_SHOW', details: 'Did not arrive'}});
    const matches = await call(s, '/admin/replacements/' + r.id + '/rematch', {u: admin, body: {reason: 'Original did not arrive'}});
    const matched = matches.items.map((m: any) => m.worker_id);
    assert.ok(matched.includes(backup.w.id));
    assert.ok(!matched.includes(original.w.id));
    const o = await call(s, '/admin/jobs/' + j.id + '/offers', {
      u: admin,
      status: 201,
      body: {worker_id: backup.w.id, expires_at: new Date(Date.now() + 600_000).toISOString(), agreed_worker_amount_paise: 24000, replacement_request_id: r.id},
    });
    const b = await accept(s, o.id, backup.u);
    assert.equal(b.replacement_of_id, a.id);
    assert.equal(b.slot_number, a.slot_number);
    const old = await call(s, '/assignments/' + a.id, {u: c.u, method: 'GET'});
    assert.equal(old.status, 'REPLACED');
    assert.deepEqual(old.shifts.map((x: any) => x.status), ['CANCELLED', 'CANCELLED']);
    const fresh = await call(s, '/assignments/' + b.id, {u: c.u, method: 'GET'});
    assert.deepEqual(fresh.shifts.map((x: any) => x.agreed_earning_paise), [12000, 12000]);
    const {rows} = await s.pool.query('SELECT status, replacement_assignment_id FROM replacement_requests WHERE id = $1', [r.id]);
    assert.deepEqual(rows[0], {status: 'RESOLVED', replacement_assignment_id: b.id});
    await call(s, '/admin/replacements/' + r.id + '/rematch', {u: admin, body: {reason: 'Too late'}, status: 409});
  });

  test('payments: idempotent creation and reconciliation by finance only', async () => {
    const admin = await staff(s);
    const c = await client(s, 50);
    const finance = await user(s, 51);
    await grant(s, finance, 'FINANCE');
    const j = await job(s, c);
    const body = {job_id: j.id, method: 'MANUAL_UPI', amount_paise: 50000};
    await call(s, '/admin/payments', {u: c.u, key: 'pay-create-1', status: 403, body});
    const p = await call(s, '/admin/payments', {u: finance, key: 'pay-create-1', status: 201, body});
    assert.equal(p.status, 'PENDING');
    assert.equal(p.payer_id, c.u.user.id);
    assert.equal('provider_reference' in p, true);
    assert.equal((await call(s, '/admin/payments', {u: finance, key: 'pay-create-1', status: 201, body})).id, p.id);
    assert.equal((await call(s, '/admin/payments', {u: finance, key: 'pay-create-1', status: 409, body: {...body, amount_paise: 1}})).error.code, 'IDEMPOTENCY_CONFLICT');
    const later = await call(s, '/admin/payments', {u: admin, key: 'pay-later-1', status: 201, body: {...body, method: 'PAY_LATER'}});
    const reconcile = '/admin/payments/' + p.id + '/reconcile';
    await call(s, reconcile, {u: finance, key: 'reconcile-1', status: 422, body: {amount_paise: 49999, reference: 'UPI-REF-1234'}});
    const captured = await call(s, reconcile, {u: finance, key: 'reconcile-1', body: {amount_paise: 50000, reference: 'UPI-REF-1234'}});
    assert.equal(captured.status, 'CAPTURED');
    assert.deepEqual(await call(s, reconcile, {u: finance, key: 'reconcile-1', body: {amount_paise: 50000, reference: 'UPI-REF-1234'}}), captured);
    await call(s, reconcile, {u: finance, key: 'reconcile-2', status: 409, body: {amount_paise: 50000, reference: 'UPI-REF-1234'}});
    await call(s, '/admin/payments/' + later.id + '/reconcile', {u: finance, key: 'reconcile-3', status: 409, body: {amount_paise: 50000, reference: 'PAY-LATER'}});
    const {rows} = await s.pool.query(`SELECT details FROM audit_logs WHERE action = 'payment.reconcile'`);
    assert.deepEqual(rows, [{details: {reference_suffix: '1234'}}]);
    const draft = await call(s, '/jobs', {
      u: c.u,
      status: 201,
      body: {service_id: s.ids.service, service_area_id: s.ids.area, address_id: c.address.id, engagement_type: 'HOURLY', headcount: 1,
        schedule: [{start_at: new Date(Date.now() + 3_600_000).toISOString(), end_at: new Date(Date.now() + 7_200_000).toISOString()}]},
    });
    await call(s, '/admin/payments', {u: finance, key: 'pay-draft-1', status: 409, body: {...body, job_id: draft.id}});
  });
});
