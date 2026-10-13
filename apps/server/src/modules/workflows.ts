import {randomUUID} from 'node:crypto';
import {Ajv2020} from 'ajv/dist/2020.js';
import express from 'express';
import type {Row} from '../db.ts';
import {require} from '../errors.ts';
import {LIVE, OfferService, PricingService, ShiftService, idempotent, visibleAssignment, workerFor} from '../domain.ts';
import {emit} from '../events.ts';
import {type Ctx, permit, route, uuidParam} from '../http.ts';
import {get, listing, publicRow} from '../repository.ts';
import {CheckInInput, IncidentInput, JobInput, ReasonInput, ReplacementInput, ReviewInput} from '../schemas.ts';

export const router = express.Router();

// Requirement schemas are database rows (service_categories.requirement_schema), checked like Python's jsonschema.
const ajv = new Ajv2020({strict: false, allErrors: false});

export const operations = (ctx: Ctx) => ctx.roles.some(r => r === 'SUPER_ADMIN' || r === 'OPERATIONS');

async function jobVisible(ctx: Ctx, id: string) {
  const j = await get(ctx.tx, 'job_requests', id);
  if (j.client_id !== ctx.user.id && !operations(ctx)) {
    const w = await workerFor(ctx.tx, ctx.user.id);
    require(await ctx.tx.one('SELECT id FROM job_offers WHERE job_id = $1 AND worker_id = $2 LIMIT 1', [id, w.id]), 'NOT_FOUND', 404);
  }
  return j;
}

route(router, 'post', '/jobs', {status: 201, body: JobInput, auth: true}, async (ctx, data) => {
  const {tx, user} = ctx;
  permit(ctx, 'CLIENT');
  const profile = await tx.one('SELECT * FROM client_profiles WHERE user_id = $1', [user.id]);
  require(profile && profile.onboarding_complete, 'ONBOARDING_INCOMPLETE', 422);
  const service = await get(tx, 'service_categories', data.service_id);
  const area = await get(tx, 'service_areas', data.service_area_id);
  const address = await get(tx, 'addresses', data.address_id);
  require(address.owner_id === user.id, 'NOT_FOUND', 404);
  require(service.active && area.active, 'OUTSIDE_SERVICE_AREA', 422);
  require(data.schedule[0].start_at > new Date(), 'SCHEDULE_INVALID', 422);
  require(
    await tx.value('SELECT ST_DWithin(a.point, s.center, s.radius_m) FROM addresses a, service_areas s WHERE a.id = $1 AND s.id = $2', [address.id, area.id]),
    'OUTSIDE_SERVICE_AREA',
    422,
  );
  require(ajv.validate(service.requirement_schema, data.requirements), 'INVALID_REQUIREMENTS', 422);
  const schedule = data.schedule.map(w => ({start_at: w.start_at.toISOString(), end_at: w.end_at.toISOString()}));
  const j = await tx.one(
    `INSERT INTO job_requests (id, client_id, service_id, service_area_id, engagement_type, location_snapshot, point, location_precision,
       maps_url, contact_whatsapp, start_at, end_at, schedule, recurring_metadata, headcount, budget_min, budget_max, currency, notes, status)
     SELECT $1, $2, $3, $4, $5, $6, a.point, a.location_precision, a.maps_url, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, 'DRAFT'
     FROM addresses a WHERE a.id = $17 RETURNING *`,
    [
      randomUUID(), user.id, data.service_id, data.service_area_id, data.engagement_type, publicRow(address),
      profile.whatsapp_number || user.phone_number, schedule[0].start_at, schedule.at(-1)!.end_at, JSON.stringify(schedule),
      data.recurring_metadata, data.headcount, data.budget_min, data.budget_max, data.currency, data.notes, address.id,
    ],
  );
  for (const [key, value] of Object.entries(data.requirements)) {
    await tx.query('INSERT INTO job_requirements (id, job_id, key, value) VALUES ($1, $2, $3, $4)', [randomUUID(), j!.id, key, JSON.stringify(value)]);
  }
  return {...publicRow(j!), pricing: PricingService.quote(j!)};
});

route(router, 'get', '/jobs', {auth: true}, async ({tx, user}) =>
  listing(tx, 'SELECT * FROM job_requests WHERE client_id = $1 ORDER BY created_at DESC', [user.id]),
);

route(router, 'get', '/jobs/:id', {auth: true}, async ctx => {
  const {tx} = ctx;
  const id = uuidParam(ctx, 'id');
  const j = await jobVisible(ctx, id);
  const assignments = await tx.query('SELECT * FROM assignments WHERE job_id = $1', [id]);
  const offers = await tx.query('SELECT id FROM job_offers WHERE job_id = $1', [id]);
  const shifts = await tx.query('SELECT s.id FROM shifts s JOIN assignments a ON s.assignment_id = a.id WHERE a.job_id = $1', [id]);
  const timelineIds = [id, ...assignments.map(a => a.id), ...offers.map(o => o.id), ...shifts.map(s => s.id)];
  const timeline = await tx.query('SELECT * FROM domain_events WHERE aggregate_id = ANY($1) ORDER BY created_at', [timelineIds]);
  return {...publicRow(j), assignments: assignments.map(a => publicRow(a)), timeline: timeline.map(e => publicRow(e))};
});

route(router, 'post', '/jobs/:id/submit', {auth: true}, async ctx => {
  const {tx, user} = ctx;
  const j = await get(tx, 'job_requests', uuidParam(ctx, 'id'), true);
  require(j.client_id === user.id, 'NOT_FOUND', 404);
  require(j.status === 'DRAFT');
  require(j.start_at > new Date(), 'SCHEDULE_INVALID', 422);
  const saved = await tx.one(`UPDATE job_requests SET status = 'SUBMITTED', submitted_at = now() WHERE id = $1 RETURNING *`, [j.id]);
  await emit(tx, 'JobSubmitted', j.id, [user.id], `/shared/job/${j.id}`);
  return publicRow(saved!);
});

route(router, 'post', '/jobs/:id/cancel', {body: ReasonInput, auth: true}, async (ctx, data) => {
  const {tx, user} = ctx;
  const id = uuidParam(ctx, 'id');
  const j = await get(tx, 'job_requests', id, true);
  require(j.client_id === user.id || operations(ctx), 'NOT_FOUND', 404);
  require(!['COMPLETED', 'CANCELLED', 'EXPIRED'].includes(j.status));
  const ids = (await tx.query('SELECT id FROM assignments WHERE job_id = $1', [id])).map(a => a.id);
  require(!(await tx.one(`SELECT id FROM shifts WHERE assignment_id = ANY($1) AND status = 'IN_PROGRESS' LIMIT 1`, [ids])), 'ACTIVE_SHIFT_REQUIRES_SUPPORT');
  const saved = await tx.one(`UPDATE job_requests SET status = 'CANCELLED' WHERE id = $1 RETURNING *`, [id]);
  await tx.query(`INSERT INTO cancellations (id, job_id, actor_id, reason, metadata) VALUES ($1, $2, $3, $4, '{}')`, [randomUUID(), id, user.id, data.reason]);
  await tx.query(`UPDATE assignments SET status = 'CANCELLED' WHERE job_id = $1 AND status = ANY($2)`, [id, LIVE]);
  await tx.query(`UPDATE shifts SET status = 'CANCELLED' WHERE assignment_id = ANY($1) AND status = 'SCHEDULED'`, [ids]);
  await tx.query(`UPDATE job_offers SET status = 'WITHDRAWN' WHERE job_id = $1 AND status = 'PENDING'`, [id]);
  return publicRow(saved!);
});

route(router, 'get', '/jobs/:id/matches', {auth: true}, async ctx => {
  permit(ctx, 'OPERATIONS');
  return listing(ctx.tx, `SELECT * FROM candidate_matches WHERE job_id = $1 AND status = 'ELIGIBLE' ORDER BY final_score DESC`, [uuidParam(ctx, 'id')]);
});

route(router, 'get', '/offers', {auth: true}, async ({tx, user}) => {
  const w = await workerFor(tx, user.id);
  return listing(tx, 'SELECT * FROM job_offers WHERE worker_id = $1 ORDER BY created_at DESC', [w.id]);
});

route(router, 'post', '/offers/:id/accept', {auth: true}, async ctx => {
  const id = uuidParam(ctx, 'id');
  return idempotent(ctx.tx, ctx.user, `offer:${id}:accept`, ctx.req.get('idempotency-key'), {}, () => OfferService.accept(ctx.tx, ctx.user, id));
});

route(router, 'post', '/offers/:id/decline', {auth: true}, async ctx => {
  const {tx, user} = ctx;
  const o = await get(tx, 'job_offers', uuidParam(ctx, 'id'), true);
  const w = await workerFor(tx, user.id);
  require(o.worker_id === w.id, 'NOT_FOUND', 404);
  require(o.status === 'PENDING');
  return publicRow((await tx.one(`UPDATE job_offers SET status = 'DECLINED', responded_at = now() WHERE id = $1 RETURNING *`, [o.id]))!);
});

route(router, 'get', '/assignments', {auth: true}, async ({tx, user}) => {
  const w = await workerFor(tx, user.id);
  return listing(tx, 'SELECT * FROM assignments WHERE worker_id = $1 ORDER BY created_at DESC', [w.id]);
});

route(router, 'get', '/assignments/:id', {auth: true}, async ctx => {
  const {tx} = ctx;
  const id = uuidParam(ctx, 'id');
  const {a, w, j} = await visibleAssignment(tx, id, ctx.user, operations(ctx));
  const u = await get(tx, 'users', w.user_id);
  return {
    ...publicRow(a),
    job: publicRow(j),
    worker: {
      id: w.id,
      full_name: u.full_name,
      experience_years: w.experience_years,
      worker_status: w.worker_status,
      photo_document_id: w.progress?.photo?.document_id ?? null,
    },
    shifts: (await listing(tx, 'SELECT * FROM shifts WHERE assignment_id = $1 ORDER BY scheduled_start', [id])).items,
  };
});

async function move(ctx: Ctx, target: 'EN_ROUTE' | 'ARRIVED', source: string) {
  const {tx, user} = ctx;
  const id = uuidParam(ctx, 'id');
  const a = await get(tx, 'assignments', id, true);
  const w = await workerFor(tx, user.id);
  require(a.worker_id === w.id, 'NOT_FOUND', 404);
  require(w.worker_status === 'ACTIVE', 'WORKER_NOT_VERIFIED');
  require(a.status === source);
  const j = await get(tx, 'job_requests', a.job_id);
  require(!['CANCELLED', 'ON_HOLD', 'EXPIRED'].includes(j.status));
  const saved = await tx.one('UPDATE assignments SET status = $2 WHERE id = $1 RETURNING *', [id, target]);
  await emit(tx, target === 'EN_ROUTE' ? 'WorkerEnRoute' : 'WorkerArrived', a.id, [j.client_id, user.id], `/shared/assignment/${id}`);
  return publicRow(saved!);
}

route(router, 'post', '/assignments/:id/en-route', {auth: true}, async ctx => move(ctx, 'EN_ROUTE', 'ACCEPTED'));
route(router, 'post', '/assignments/:id/arrived', {auth: true}, async ctx => move(ctx, 'ARRIVED', 'EN_ROUTE'));

route(router, 'post', '/assignments/:id/prepare-next-shift', {auth: true}, async ctx => {
  const {tx, user} = ctx;
  const id = uuidParam(ctx, 'id');
  const a = await get(tx, 'assignments', id, true);
  const w = await workerFor(tx, user.id);
  require(a.worker_id === w.id, 'NOT_FOUND', 404);
  require(a.status === 'IN_PROGRESS');
  require(!(await tx.one(`SELECT id FROM shifts WHERE assignment_id = $1 AND status = 'IN_PROGRESS' LIMIT 1`, [id])));
  require(await tx.one(`SELECT id FROM shifts WHERE assignment_id = $1 AND status = 'SCHEDULED' LIMIT 1`, [id]));
  return publicRow((await tx.one(`UPDATE assignments SET status = 'ACCEPTED' WHERE id = $1 RETURNING *`, [id]))!);
});

route(router, 'post', '/shifts/:id/check-in', {body: CheckInInput, auth: true}, async (ctx, data) => {
  const id = uuidParam(ctx, 'id');
  return idempotent(ctx.tx, ctx.user, `shift:${id}:check-in`, ctx.req.get('idempotency-key'), data, () => ShiftService.checkIn(ctx.tx, ctx.user, id, data));
});

route(router, 'post', '/shifts/:id/complete', {auth: true}, async ctx => {
  const id = uuidParam(ctx, 'id');
  return idempotent(ctx.tx, ctx.user, `shift:${id}:complete`, ctx.req.get('idempotency-key'), {}, () => ShiftService.complete(ctx.tx, ctx.user, id));
});

route(router, 'post', '/shifts/:id/manual-check-in-request', {body: ReasonInput, auth: true}, async (ctx, data) => {
  const id = uuidParam(ctx, 'id');
  const {s, a, w} = await ShiftService.context(ctx.tx, ctx.user, id);
  require(s.status === 'SCHEDULED' && a.status === 'ARRIVED');
  const e = await ctx.tx.one(
    `INSERT INTO attendance_events (id, worker_id, shift_id, actor_id, type, reason) VALUES ($1, $2, $3, $4, 'MANUAL_REQUEST', $5) RETURNING *`,
    [randomUUID(), w.id, id, ctx.user.id, data.reason],
  );
  return publicRow(e!);
});

route(router, 'post', '/replacements', {status: 201, body: ReplacementInput, auth: true}, async (ctx, data) => {
  const {tx, user} = ctx;
  const {a, w, j} = await visibleAssignment(tx, data.assignment_id, user, operations(ctx));
  require([...LIVE, 'NO_SHOW'].includes(a.status));
  const row = await tx.one(
    `INSERT INTO replacement_requests (id, job_id, original_assignment_id, requester_id, reason, details, status)
     VALUES ($1, $2, $3, $4, $5, $6, 'REQUESTED') RETURNING *`,
    [randomUUID(), j.id, a.id, user.id, data.reason, data.details],
  );
  await emit(tx, 'ReplacementRequested', row!.id, [j.client_id, w.user_id], `/shared/assignment/${a.id}`);
  return publicRow(row!);
});

route(router, 'get', '/replacements', {auth: true}, async ({tx, user}) =>
  listing(tx, 'SELECT * FROM replacement_requests WHERE requester_id = $1 ORDER BY created_at DESC', [user.id]),
);

route(router, 'post', '/incidents', {status: 201, body: IncidentInput, auth: true}, async (ctx, data) => {
  await visibleAssignment(ctx.tx, data.assignment_id, ctx.user, operations(ctx));
  const row = await ctx.tx.one(
    `INSERT INTO incidents (id, assignment_id, reporter_id, type, description, status) VALUES ($1, $2, $3, $4, $5, 'OPEN') RETURNING *`,
    [randomUUID(), data.assignment_id, ctx.user.id, data.type, data.description],
  );
  return publicRow(row!);
});

route(router, 'post', '/reviews', {status: 201, body: ReviewInput, auth: true}, async ({tx, user}, data) => {
  const {a, w, j} = await visibleAssignment(tx, data.assignment_id, user);
  require(j.client_id === user.id, 'FORBIDDEN', 403);
  require(a.status === 'COMPLETED');
  const row = await tx.one(
    `INSERT INTO reviews (id, assignment_id, reviewer_id, reviewee_id, rating, tags, comment) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [randomUUID(), a.id, user.id, w.user_id, data.rating, JSON.stringify(data.tags), data.comment],
  );
  return publicRow(row!);
});

route(router, 'get', '/worker/earnings', {auth: true}, async ({tx, user}) => {
  const w = await workerFor(tx, user.id);
  const rows = await listing(tx, 'SELECT * FROM worker_ledger_entries WHERE worker_id = $1 ORDER BY created_at DESC', [w.id]);
  const balance = await tx.value<number>('SELECT COALESCE(SUM(amount_paise), 0)::bigint FROM worker_ledger_entries WHERE worker_id = $1', [w.id]);
  return {...rows, currency: 'INR', balance_paise: balance};
});

route(router, 'get', '/notifications', {auth: true}, async ({tx, user}) =>
  listing(tx, 'SELECT * FROM notifications WHERE recipient_id = $1 ORDER BY created_at DESC', [user.id]),
);

route(router, 'post', '/notifications/:id/read', {auth: true}, async ctx => {
  const n: Row = await get(ctx.tx, 'notifications', uuidParam(ctx, 'id'));
  require(n.recipient_id === ctx.user.id, 'NOT_FOUND', 404);
  return publicRow((await ctx.tx.one('UPDATE notifications SET read_at = now() WHERE id = $1 RETURNING *', [n.id]))!);
});
