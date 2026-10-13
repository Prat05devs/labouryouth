/**
 * Unauthenticated, read-only browse endpoints for guests.
 *
 * Only safe marketplace fields leave this module. Opaque resource IDs support detail navigation, but user IDs,
 * contact details, exact coordinates, free-text notes and employer identity stay private. Workers appear only
 * when operations has activated them.
 */
import express from 'express';
import type {Row, Tx} from '../db.ts';
import {require} from '../errors.ts';
import {type Ctx, errorBody, parse, route, uuidParam} from '../http.ts';
import {BrowseQuery} from '../schemas.ts';
import {throttle} from '../security.ts';
import {OPEN, filled, firstName, trust} from './marketplace.ts';

export const router = express.Router();
const browse = express.Router();
router.use('/public', browse);
const PER_MINUTE = 60;

const guard = (ctx: Ctx) => throttle(ctx.tx, 'public:' + ctx.ip, PER_MINUTE);

async function jobPayload(tx: Tx, job: Row) {
  return {
    id: job.id,
    service_id: job.service_id,
    service_name: job.service_name,
    service_name_hi: job.service_name_hi,
    locality: job.location_snapshot?.locality ?? '',
    approximate_location: job.location_precision === 'AREA',
    engagement_type: job.engagement_type,
    start_at: job.start_at,
    end_at: job.end_at,
    wage_min_paise: job.budget_min,
    wage_paise: job.budget_max,
    headcount: job.headcount,
    slots_left: job.headcount - (await filled(tx, job.id)),
  };
}

async function workerPayload(tx: Tx, profile: Row) {
  const services = await tx.query(
    'SELECT c.id, c.name, c.name_hi FROM service_categories c JOIN worker_services ws ON ws.service_id = c.id WHERE ws.worker_id = $1 ORDER BY c.sort_order',
    [profile.id],
  );
  const availability = await tx.one('SELECT * FROM worker_availability WHERE worker_id = $1', [profile.id]);
  const area = availability?.service_area_id
    ? await tx.value<string>('SELECT name FROM service_areas WHERE id = $1', [availability.service_area_id])
    : null;
  const languages = (await tx.query('SELECT language_code FROM worker_languages WHERE worker_id = $1', [profile.id])).map(r => r.language_code);
  const completed = await tx.value<number>(`SELECT count(*)::int FROM assignments WHERE worker_id = $1 AND status = 'COMPLETED'`, [profile.id]);
  return {
    id: profile.id,
    first_name: firstName(profile.full_name),
    skills: services.map(r => r.name),
    skills_hi: services.map(r => r.name_hi),
    service_ids: services.map(r => r.id),
    experience_years: profile.experience_years,
    engagement_types: profile.engagement_types,
    rate_min_paise: profile.rate_min_paise,
    area: area ?? null,
    online: Boolean(availability?.online),
    availability_kind: availability ? availability.kind : null,
    languages,
    completed_jobs: completed ?? 0,
    verified: true,
    trust: await trust(tx, profile.user_id),
  };
}

const JOBS = `SELECT j.*, c.name AS service_name, c.name_hi AS service_name_hi FROM job_requests j
  JOIN service_categories c ON c.id = j.service_id WHERE j.status = ANY($1) AND j.end_at > now()`;
const WORKERS = `SELECT w.*, u.full_name FROM worker_profiles w JOIN users u ON u.id = w.user_id
  WHERE w.worker_status = 'ACTIVE' AND w.onboarding_status = 'COMPLETE'`;

route(browse, 'get', '/jobs', {}, async ctx => {
  await guard(ctx);
  const q = parse(BrowseQuery, ctx.req.query, 'query');
  const params: unknown[] = [OPEN, q.limit];
  const filter = q.service_id ? ` AND j.service_id = $${params.push(q.service_id)}` : '';
  const items = [];
  for (const job of await ctx.tx.query(`${JOBS}${filter} ORDER BY j.created_at DESC LIMIT $2`, params)) {
    const item = await jobPayload(ctx.tx, job);
    if (item.slots_left > 0) items.push(item);
  }
  return {items, next_cursor: null};
});

route(browse, 'get', '/jobs/:id', {}, async ctx => {
  await guard(ctx);
  const job = await ctx.tx.one(`${JOBS} AND j.id = $2`, [OPEN, uuidParam(ctx, 'id')]);
  require(job, 'NOT_FOUND', 404);
  const item = await jobPayload(ctx.tx, job);
  require(item.slots_left > 0, 'NOT_FOUND', 404);
  return item;
});

route(browse, 'get', '/workers', {}, async ctx => {
  await guard(ctx);
  const q = parse(BrowseQuery, ctx.req.query, 'query');
  const params: unknown[] = [q.limit];
  const filter = q.service_id ? ` AND w.id IN (SELECT worker_id FROM worker_services WHERE service_id = $${params.push(q.service_id)})` : '';
  const items = [];
  for (const profile of await ctx.tx.query(`${WORKERS}${filter} ORDER BY w.created_at DESC LIMIT $1`, params)) {
    items.push(await workerPayload(ctx.tx, profile));
  }
  return {items, next_cursor: null};
});

route(browse, 'get', '/workers/:id', {}, async ctx => {
  await guard(ctx);
  const profile = await ctx.tx.one(`${WORKERS} AND w.id = $1`, [uuidParam(ctx, 'id')]);
  require(profile, 'NOT_FOUND', 404);
  return workerPayload(ctx.tx, profile);
});

// The browse API is read-only: any other method on these paths is 405, as the FastAPI router answered.
browse.all(['/jobs', '/jobs/:id', '/workers', '/workers/:id'], (_req, res) => errorBody(res, 'HTTP_ERROR', 405));
