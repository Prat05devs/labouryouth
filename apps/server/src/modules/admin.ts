import {randomUUID} from 'node:crypto';
import express from 'express';
import {require} from '../errors.ts';
import {LIVE, MatchingService, idempotent} from '../domain.ts';
import {audit, emit} from '../events.ts';
import {type Ctx, permit, route, uuidParam} from '../http.ts';
import {get, listing, publicRow} from '../repository.ts';
import {OfferInput, PaymentCreate, PaymentReconcile, ReasonInput} from '../schemas.ts';

export const router = express.Router();
const admin = express.Router();
router.use('/admin', admin);

// Section name -> table and the staff role allowed to read it. Table names are constants, never user input.
const READS: Record<string, [string, string]> = {
  workers: ['worker_profiles', 'OPERATIONS'],
  clients: ['client_profiles', 'OPERATIONS'],
  jobs: ['job_requests', 'OPERATIONS'],
  assignments: ['assignments', 'OPERATIONS'],
  replacements: ['replacement_requests', 'OPERATIONS'],
  attendance: ['attendance_events', 'OPERATIONS'],
  payments: ['payments', 'FINANCE'],
  ledger: ['worker_ledger_entries', 'FINANCE'],
  incidents: ['incidents', 'SUPPORT'],
  verifications: ['worker_verifications', 'VERIFICATION'],
};

route(admin, 'get', '/overview', {auth: true}, async ctx => {
  permit(ctx, 'OPERATIONS');
  const count = (sql: string, params: unknown[] = []) => ctx.tx.value<number>(sql, params);
  return {
    open_jobs: await count(`SELECT count(*)::int FROM job_requests WHERE status IN ('SUBMITTED', 'MATCHING', 'OFFERING')`),
    pending_verifications: await count(`SELECT count(*)::int FROM worker_verifications WHERE status = 'PENDING'`),
    active_assignments: await count('SELECT count(*)::int FROM assignments WHERE status = ANY($1)', [LIVE]),
    open_replacements: await count(`SELECT count(*)::int FROM replacement_requests WHERE status NOT IN ('RESOLVED', 'REJECTED', 'CANCELLED')`),
  };
});

route(admin, 'get', '/:section', {auth: true}, async ctx => {
  // Check staff role before the section name, so non-staff cannot discover which sections exist.
  permit(ctx, 'OPERATIONS', 'VERIFICATION', 'FINANCE', 'SUPPORT');
  const section = String(ctx.req.params.section);
  require(Object.hasOwn(READS, section), 'NOT_FOUND', 404);
  const [table, role] = READS[section];
  permit(ctx, role);
  return listing(ctx.tx, `SELECT * FROM ${table} ORDER BY created_at DESC`);
});

route(admin, 'get', '/workers/:id', {auth: true}, async ctx => {
  permit(ctx, 'OPERATIONS', 'VERIFICATION');
  const id = uuidParam(ctx, 'id');
  const w = await get(ctx.tx, 'worker_profiles', id);
  const u = await get(ctx.tx, 'users', w.user_id);
  return {
    ...publicRow(w),
    full_name: u.full_name,
    phone_number: u.phone_number,
    verifications: (await listing(ctx.tx, 'SELECT * FROM worker_verifications WHERE worker_id = $1', [id])).items,
  };
});

async function verify(ctx: Ctx, reason: string, target: 'APPROVED' | 'REJECTED') {
  const {tx, user} = ctx;
  permit(ctx, 'VERIFICATION');
  const v = await get(tx, 'worker_verifications', uuidParam(ctx, 'id'), true);
  require(v.status === 'PENDING');
  const saved = await tx.one(
    'UPDATE worker_verifications SET status = $2, reason = $3, reviewer_id = $4, reviewed_at = now() WHERE id = $1 RETURNING *',
    [v.id, target, reason, user.id],
  );
  const w = await get(tx, 'worker_profiles', v.worker_id, true);
  if (target === 'REJECTED') await tx.query(`UPDATE worker_profiles SET onboarding_status = 'IN_PROGRESS' WHERE id = $1`, [w.id]);
  await audit(tx, user, 'verification.' + target.toLowerCase(), v.id, ctx.requestId, {reason});
  if (target === 'APPROVED') await emit(tx, 'VerificationApproved', v.id, [w.user_id], '/worker/profile');
  return publicRow(saved!);
}

route(admin, 'post', '/verifications/:id/approve', {body: ReasonInput, auth: true}, async (ctx, d) => verify(ctx, d.reason, 'APPROVED'));
route(admin, 'post', '/verifications/:id/reject', {body: ReasonInput, auth: true}, async (ctx, d) => verify(ctx, d.reason, 'REJECTED'));

route(admin, 'post', '/workers/:id/activate', {body: ReasonInput, auth: true}, async (ctx, data) => {
  const {tx, user} = ctx;
  permit(ctx, 'VERIFICATION');
  const id = uuidParam(ctx, 'id');
  const w = await get(tx, 'worker_profiles', id, true);
  require(w.onboarding_status === 'SUBMITTED');
  const services = await tx.query(
    'SELECT c.verification_types FROM service_categories c JOIN worker_services ws ON ws.service_id = c.id WHERE ws.worker_id = $1',
    [id],
  );
  const required = new Set(services.flatMap(s => s.verification_types as string[]));
  const approved = new Set(
    (
      await tx.query(
        `SELECT type FROM worker_verifications WHERE worker_id = $1 AND status = 'APPROVED' AND (expires_at IS NULL OR expires_at > now())`,
        [id],
      )
    ).map(r => r.type),
  );
  require(services.length && [...required].every(t => approved.has(t)), 'WORKER_NOT_VERIFIED');
  const saved = await tx.one(`UPDATE worker_profiles SET worker_status = 'ACTIVE', onboarding_status = 'COMPLETE' WHERE id = $1 RETURNING *`, [id]);
  await audit(tx, user, 'worker.activate', id, ctx.requestId, {reason: data.reason});
  return publicRow(saved!);
});

route(admin, 'post', '/jobs/:id/generate-matches', {auth: true}, async ctx => {
  permit(ctx, 'OPERATIONS');
  const id = uuidParam(ctx, 'id');
  const j = await get(ctx.tx, 'job_requests', id, true);
  const result = await MatchingService.generate(ctx.tx, j);
  await audit(ctx.tx, ctx.user, 'matches.generate', id, ctx.requestId);
  return result;
});

route(admin, 'post', '/jobs/:id/offers', {status: 201, body: OfferInput, auth: true}, async (ctx, data) => {
  const {tx, user} = ctx;
  permit(ctx, 'OPERATIONS');
  const id = uuidParam(ctx, 'id');
  const j = await get(tx, 'job_requests', id, true);
  const w = await get(tx, 'worker_profiles', data.worker_id, true);
  require(['MATCHING', 'OFFERING', 'ASSIGNED', 'ACTIVE'].includes(j.status));
  require(new Date() < data.expires_at && data.expires_at <= j.end_at, 'OFFER_EXPIRY_INVALID', 422);
  require(data.agreed_worker_amount_paise > 0, 'QUOTE_REQUIRED', 422);
  await MatchingService.eligibility(tx, j, w, undefined, data.agreed_worker_amount_paise);
  if (data.replacement_request_id) {
    const replacement = await get(tx, 'replacement_requests', data.replacement_request_id, true);
    require(replacement.job_id === id && ['MATCHING', 'OFFERING'].includes(replacement.status));
    await tx.query(`UPDATE replacement_requests SET status = 'OFFERING' WHERE id = $1`, [replacement.id]);
  } else {
    const count = await tx.value<number>(
      `SELECT count(*)::int FROM assignments WHERE job_id = $1 AND status NOT IN ('CANCELLED', 'REPLACED', 'NO_SHOW')`,
      [id],
    );
    require(count! < j.headcount, 'JOB_ALREADY_ASSIGNED');
  }
  const o = await tx.one(
    `INSERT INTO job_offers (id, job_id, worker_id, status, expires_at, agreed_worker_amount_paise, replacement_request_id)
     VALUES ($1, $2, $3, 'PENDING', $4, $5, $6) RETURNING *`,
    [randomUUID(), id, w.id, data.expires_at, data.agreed_worker_amount_paise, data.replacement_request_id],
  );
  if (['MATCHING', 'OFFERING'].includes(j.status)) await tx.query(`UPDATE job_requests SET status = 'OFFERING' WHERE id = $1`, [id]);
  await emit(tx, 'OfferCreated', o!.id, [w.user_id], '/worker/offers');
  await audit(tx, user, 'offer.create', o!.id, ctx.requestId);
  return publicRow(o!);
});

route(admin, 'post', '/replacements/:id/rematch', {body: ReasonInput, auth: true}, async (ctx, data) => {
  const {tx, user} = ctx;
  permit(ctx, 'OPERATIONS');
  const id = uuidParam(ctx, 'id');
  const peek = await get(tx, 'replacement_requests', id);
  const j = await get(tx, 'job_requests', peek.job_id, true);
  const r = await get(tx, 'replacement_requests', id, true);
  require(['REQUESTED', 'UNDER_REVIEW', 'MATCHING', 'OFFERING'].includes(r.status));
  await tx.query(`UPDATE replacement_requests SET status = 'MATCHING' WHERE id = $1`, [id]);
  const result = await MatchingService.generate(tx, j);
  const original = await get(tx, 'assignments', r.original_assignment_id);
  result.items = result.items.filter(x => x.worker_id !== original.worker_id);
  await audit(tx, user, 'replacement.rematch', id, ctx.requestId, {reason: data.reason});
  return result;
});

const decided = (ctx: Ctx, id: string) =>
  ctx.tx.one(`SELECT id FROM audit_logs WHERE entity_id = $1 AND action IN ('attendance.approve', 'attendance.reject') LIMIT 1`, [id]);

route(admin, 'post', '/attendance/:id/approve', {body: ReasonInput, auth: true}, async (ctx, data) => {
  const {tx, user} = ctx;
  permit(ctx, 'OPERATIONS');
  const id = uuidParam(ctx, 'id');
  const e = await get(tx, 'attendance_events', id);
  const peek = await get(tx, 'shifts', e.shift_id);
  const assignment = await get(tx, 'assignments', peek.assignment_id);
  const j = await get(tx, 'job_requests', assignment.job_id, true);
  const w = await get(tx, 'worker_profiles', e.worker_id, true);
  const a = await get(tx, 'assignments', assignment.id, true);
  const s = await get(tx, 'shifts', peek.id, true);
  require(e.type === 'MANUAL_REQUEST' && s.status === 'SCHEDULED' && a.status === 'ARRIVED');
  require(w.worker_status === 'ACTIVE', 'WORKER_NOT_VERIFIED');
  require(!['CANCELLED', 'ON_HOLD', 'EXPIRED'].includes(j.status));
  require(!(await decided(ctx, id)));
  // Manual attendance is its own audited event, never a fake geo pass (ARCHITECTURE.md).
  const shift = await tx.one(`UPDATE shifts SET status = 'IN_PROGRESS' WHERE id = $1 RETURNING *`, [s.id]);
  await tx.query(`UPDATE assignments SET status = 'IN_PROGRESS', started_at = COALESCE(started_at, now()) WHERE id = $1`, [a.id]);
  await tx.query(`UPDATE job_requests SET status = 'ACTIVE' WHERE id = $1`, [j.id]);
  await tx.query(
    `INSERT INTO attendance_events (id, worker_id, shift_id, actor_id, type, reason, observation) VALUES ($1, $2, $3, $4, 'MANUAL_CHECK_IN', $5, $6)`,
    [randomUUID(), w.id, s.id, user.id, data.reason, {request_event_id: id}],
  );
  await audit(tx, user, 'attendance.approve', id, ctx.requestId, {reason: data.reason});
  await emit(tx, 'WorkerCheckedIn', s.id, [j.client_id, w.user_id], `/shared/assignment/${a.id}`);
  return publicRow(shift!);
});

route(admin, 'post', '/attendance/:id/reject', {body: ReasonInput, auth: true}, async (ctx, data) => {
  permit(ctx, 'OPERATIONS');
  const id = uuidParam(ctx, 'id');
  const e = await get(ctx.tx, 'attendance_events', id, true);
  require(e.type === 'MANUAL_REQUEST');
  require(!(await decided(ctx, id)));
  await audit(ctx.tx, ctx.user, 'attendance.reject', id, ctx.requestId, {reason: data.reason});
  return {status: 'REJECTED'};
});

route(admin, 'post', '/payments', {status: 201, body: PaymentCreate, auth: true}, async (ctx, data) => {
  const {tx, user} = ctx;
  permit(ctx, 'FINANCE');
  return idempotent(tx, user, 'payment:create', ctx.req.get('idempotency-key'), data, async () => {
    const job = await get(tx, 'job_requests', data.job_id, true);
    require(!['DRAFT', 'CANCELLED', 'EXPIRED'].includes(job.status), 'INVALID_STATE_TRANSITION');
    const payment = await tx.one(
      `INSERT INTO payments (id, job_id, payer_id, method, amount_paise, currency, status) VALUES ($1, $2, $3, $4, $5, $6, 'PENDING') RETURNING *`,
      [randomUUID(), job.id, job.client_id, data.method, data.amount_paise, job.currency],
    );
    await audit(tx, user, 'payment.create', payment!.id, ctx.requestId, {method: data.method});
    return publicRow(payment!);
  });
});

route(admin, 'post', '/payments/:id/reconcile', {body: PaymentReconcile, auth: true}, async (ctx, data) => {
  const {tx, user} = ctx;
  permit(ctx, 'FINANCE');
  const id = uuidParam(ctx, 'id');
  return idempotent(tx, user, `payment:${id}:reconcile`, ctx.req.get('idempotency-key'), data, async () => {
    const payment = await get(tx, 'payments', id, true);
    require(payment.status === 'PENDING', 'INVALID_STATE_TRANSITION');
    require(data.amount_paise === payment.amount_paise, 'VALIDATION_ERROR', 422);
    require(['CASH', 'MANUAL_UPI'].includes(payment.method), 'INVALID_STATE_TRANSITION');
    const saved = await tx.one(`UPDATE payments SET status = 'CAPTURED', provider_reference = $2 WHERE id = $1 RETURNING *`, [id, data.reference]);
    await emit(tx, 'PaymentCaptured', id, [payment.payer_id], `/shared/job/${payment.job_id}`);
    // Only the last four characters of the bank reference go into the audit trail.
    await audit(tx, user, 'payment.reconcile', id, ctx.requestId, {reference_suffix: data.reference.slice(-4)});
    return publicRow(saved!);
  });
});
