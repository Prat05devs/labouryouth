import {randomUUID} from 'node:crypto';
import express from 'express';
import type {Row, Tx} from '../db.ts';
import {require} from '../errors.ts';
import {LIVE, MatchingService, workerFor} from '../domain.ts';
import {audit, emit} from '../events.ts';
import {parse, permit, route, uuidParam} from '../http.ts';
import {contactLinks, pinFor} from '../maps.ts';
import {get, listing, publicRow} from '../repository.ts';
import {BenchmarkQuery, NearbyQuery, QuickJobInput} from '../schemas.ts';
import {operations} from './workflows.ts';

export const router = express.Router();
export const OPEN = ['SUBMITTED', 'MATCHING', 'OFFERING'];
const BENCHMARK_MIN_SAMPLES = 5;
const OFFER_HOURS = 4;

export const firstName = (fullName: string) => fullName.trim().split(/\s+/)[0];

/** Average rating and count from real reviews only; nothing is shown until reviews exist. */
export async function trust(tx: Tx, userId: string) {
  const row = await tx.one('SELECT avg(rating)::float8 AS average, count(id)::int AS reviews FROM reviews WHERE reviewee_id = $1', [userId]);
  return {average: row!.average === null ? null : Number(row!.average.toFixed(1)), reviews: row!.reviews};
}

/** Places already taken on a job: live assignments plus pending, unexpired offers. */
export async function filled(tx: Tx, jobId: string) {
  return (await tx.value<number>(
    `SELECT (SELECT count(*) FROM assignments WHERE job_id = $1 AND status = ANY($2))
          + (SELECT count(*) FROM job_offers WHERE job_id = $1 AND status = 'PENDING' AND expires_at > now())`,
    [jobId, LIVE],
  ))!;
}

/** A PENDING offer that expires in four hours or when the job ends, whichever is first. */
async function createOffer(tx: Tx, job: Row, worker: Row) {
  return (await tx.one(
    `INSERT INTO job_offers (id, job_id, worker_id, status, expires_at, agreed_worker_amount_paise)
     VALUES ($1, $2, $3, 'PENDING', LEAST(now() + make_interval(hours => $4), $5), $6) RETURNING *`,
    [randomUUID(), job.id, worker.id, OFFER_HOURS, job.end_at, job.budget_max],
  ))!;
}

route(router, 'get', '/localities', {}, async ({tx}) => listing(tx, 'SELECT * FROM localities WHERE active ORDER BY sort_order'));

route(router, 'post', '/jobs/quick', {status: 201, body: QuickJobInput, auth: true}, async (ctx, data) => {
  const {tx, user} = ctx;
  permit(ctx, 'CLIENT');
  const profile = await tx.one('SELECT * FROM client_profiles WHERE user_id = $1', [user.id]);
  require(profile && profile.onboarding_complete, 'ONBOARDING_INCOMPLETE', 422);
  const service = await get(tx, 'service_categories', data.service_id);
  const area = await get(tx, 'service_areas', data.service_area_id);
  require(service.active && area.active, 'OUTSIDE_SERVICE_AREA', 422);
  const now = Date.now();
  require(now < data.start_at.getTime() && data.start_at.getTime() <= now + 14 * 86_400_000, 'SCHEDULE_INVALID', 422);
  const pin = await pinFor(tx, area, data.maps_url, data.latitude, data.longitude);
  const city = await get(tx, 'cities', area.city_id);
  const address = await tx.one(
    `INSERT INTO addresses (id, owner_id, city_id, label, line1, locality, state, postal_code, latitude, longitude, point, maps_url, location_precision)
     VALUES ($1, $2, $3, $4, $5, $6, $7, '', $8, $9, ST_GeogFromText($10), $11, $12) RETURNING *`,
    [randomUUID(), user.id, city.id, data.locality || 'Job site', data.locality || 'Pinned location', data.locality, city.state,
      pin.latitude, pin.longitude, pin.point, data.maps_url, pin.precision],
  );
  const endAt = new Date(data.start_at.getTime() + data.hours * 3_600_000);
  let job = (await tx.one(
    `INSERT INTO job_requests (id, client_id, service_id, service_area_id, engagement_type, location_snapshot, point, location_precision, maps_url,
       contact_whatsapp, start_at, end_at, schedule, recurring_metadata, headcount, budget_min, budget_max, currency, notes, status, submitted_at)
     VALUES ($1, $2, $3, $4, 'DAILY', $5, ST_GeogFromText($6), $7, $8, $9, $10, $11, $12, '{}', $13, $14, $14, 'INR', $15, 'SUBMITTED', now())
     RETURNING *`,
    [randomUUID(), user.id, service.id, area.id, publicRow(address!), pin.point, pin.precision, data.maps_url,
      profile.whatsapp_number || user.phone_number, data.start_at, endAt,
      JSON.stringify([{start_at: data.start_at.toISOString(), end_at: endAt.toISOString()}]), data.headcount, data.wage_per_day_paise, data.notes],
  ))!;
  await emit(tx, 'JobSubmitted', job.id, [user.id], `/shared/job/${job.id}`);
  if (data.preferred_worker_id) {
    // Requesting a listed worker still goes through matching and a normal offer the worker must accept (Decision 28).
    const worker = await get(tx, 'worker_profiles', data.preferred_worker_id, true);
    await MatchingService.eligibility(tx, job, worker, undefined, job.budget_max);
    const offer = await createOffer(tx, job, worker);
    job = (await tx.one(`UPDATE job_requests SET status = 'OFFERING' WHERE id = $1 RETURNING *`, [job.id]))!;
    await emit(tx, 'OfferCreated', offer.id, [worker.user_id], '/worker/offers');
    await audit(tx, user, 'job.quick_post_preferred', job.id, ctx.requestId);
    return {...publicRow(job), notified_workers: 1, preferred_offer_id: offer.id};
  }
  const matches = await MatchingService.generate(tx, job);
  const workers = (await tx.query('SELECT user_id FROM worker_profiles WHERE id = ANY($1)', [matches.items.map(m => m.worker_id)])).map(r => r.user_id);
  await emit(tx, 'NewJobNearby', job.id, workers, '/worker/jobs');
  await audit(tx, user, 'job.quick_post', job.id, ctx.requestId);
  job = (await get(tx, 'job_requests', job.id))!;
  return {...publicRow(job), notified_workers: workers.length};
});

route(router, 'get', '/worker/jobs/nearby', {auth: true}, async ctx => {
  const {tx, user} = ctx;
  permit(ctx, 'WORKER');
  const q = parse(NearbyQuery, ctx.req.query, 'query');
  require([2, 5, 10, 20].includes(q.radius_km), 'VALIDATION_ERROR', 422);
  const worker = await workerFor(tx, user.id);
  let origin: string;
  if (q.latitude !== undefined && q.longitude !== undefined) origin = `SRID=4326;POINT(${q.longitude} ${q.latitude})`;
  else {
    origin = (await tx.value<string>('SELECT ST_AsEWKT(point) FROM worker_availability WHERE worker_id = $1', [worker.id]))!;
    require(origin, 'LOCATION_REQUIRED', 422);
  }
  const where = [
    `j.status = ANY($1)`, 'j.end_at > now()', 'j.client_id <> $2',
    'j.service_id IN (SELECT service_id FROM worker_services WHERE worker_id = $3)',
    'ST_DWithin(j.point, ST_GeogFromText($4), $5)',
  ];
  const params: unknown[] = [OPEN, user.id, worker.id, origin, q.radius_km * 1000];
  if (q.service_id) where.push(`j.service_id = $${params.push(q.service_id)}`);
  if (q.min_wage_paise !== undefined) where.push(`j.budget_max >= $${params.push(q.min_wage_paise)}`);
  // "Today" ends at the next midnight in India, whatever the server's own time zone.
  if (q.today) where.push(`j.start_at < (date_trunc('day', now() AT TIME ZONE 'Asia/Kolkata') + interval '1 day') AT TIME ZONE 'Asia/Kolkata'`);
  if (q.engagement === 'PERMANENT') where.push(`j.engagement_type IN ('MONTHLY', 'FIXED_TERM')`);
  else if (q.engagement === 'DAILY') where.push(`j.engagement_type IN ('DAILY', 'HOURLY')`);
  const rows = await tx.query(
    `SELECT j.*, ST_Distance(j.point, ST_GeogFromText($4)) AS distance_m FROM job_requests j WHERE ${where.join(' AND ')} ORDER BY distance_m LIMIT 100`,
    params,
  );
  const items = [];
  for (const {distance_m, ...job} of rows) {
    const taken = await filled(tx, job.id);
    if (taken >= job.headcount) continue;
    const service = await get(tx, 'service_categories', job.service_id);
    const client = await get(tx, 'users', job.client_id);
    const mine = await tx.value<string>('SELECT status FROM job_interests WHERE job_id = $1 AND worker_id = $2', [job.id, worker.id]);
    items.push({
      ...publicRow(job, ['location_snapshot', 'recurring_metadata', 'schedule']),
      service_name: service.name,
      service_name_hi: service.name_hi,
      locality: job.location_snapshot?.locality ?? '',
      distance_m: Math.trunc(distance_m),
      approximate: job.location_precision === 'AREA',
      slots_left: job.headcount - taken,
      employer_first_name: firstName(client.full_name),
      employer_trust: await trust(tx, client.id),
      my_interest: mine ?? null,
    });
  }
  return {items, next_cursor: null};
});

route(router, 'get', '/jobs/:id/contact', {auth: true}, async ctx => {
  const {tx, user} = ctx;
  permit(ctx, 'WORKER');
  const worker = await workerFor(tx, user.id);
  const job = await get(tx, 'job_requests', uuidParam(ctx, 'id'));
  // The hirer's WhatsApp number and map link unlock only for a worker the hirer selected (Decision 21).
  const selected =
    (await tx.one(`SELECT id FROM job_offers WHERE job_id = $1 AND worker_id = $2 AND status IN ('PENDING', 'ACCEPTED') LIMIT 1`, [job.id, worker.id])) ??
    (await tx.one('SELECT id FROM assignments WHERE job_id = $1 AND worker_id = $2 AND status = ANY($3) LIMIT 1', [job.id, worker.id, LIVE]));
  require(selected, 'NOT_FOUND', 404);
  const snap = job.location_snapshot ?? {};
  const client = await get(tx, 'users', job.client_id);
  return {
    employer_first_name: firstName(client.full_name),
    locality: snap.locality ?? '',
    address_line: snap.line1 ?? '',
    ...contactLinks(job.contact_whatsapp, job.maps_url, job.location_precision, snap.latitude, snap.longitude),
  };
});

route(router, 'post', '/jobs/:id/interest', {status: 201, auth: true}, async ctx => {
  const {tx, user} = ctx;
  permit(ctx, 'WORKER');
  const id = uuidParam(ctx, 'id');
  // Job before worker, the same lock order as offer acceptance, so the two can never deadlock.
  const job = await get(tx, 'job_requests', id, true);
  const worker = await workerFor(tx, user.id, true);
  require(job.client_id !== user.id, 'NOT_FOUND', 404);
  require(OPEN.includes(job.status) && job.end_at > new Date(), 'JOB_NOT_OPEN');
  const existing = await tx.one('SELECT * FROM job_interests WHERE job_id = $1 AND worker_id = $2 FOR UPDATE', [id, worker.id]);
  if (existing && existing.status === 'EXPRESSED') return publicRow(existing);
  require(!existing || existing.status !== 'SELECTED', 'ALREADY_SELECTED');
  require((await filled(tx, id)) < job.headcount, 'JOB_ALREADY_ASSIGNED');
  const distance = await MatchingService.eligibility(tx, job, worker, undefined, job.budget_max);
  const row = existing
    ? await tx.one(`UPDATE job_interests SET status = 'EXPRESSED', distance_m = $2 WHERE id = $1 RETURNING *`, [existing.id, distance])
    : await tx.one(`INSERT INTO job_interests (id, job_id, worker_id, status, distance_m) VALUES ($1, $2, $3, 'EXPRESSED', $4) RETURNING *`, [randomUUID(), id, worker.id, distance]);
  await emit(tx, 'WorkerInterested', row!.id, [job.client_id], `/shared/job/${id}`);
  return publicRow(row!);
});

route(router, 'post', '/jobs/:id/interest/withdraw', {auth: true}, async ctx => {
  const worker = await workerFor(ctx.tx, ctx.user.id);
  const row = await ctx.tx.one('SELECT * FROM job_interests WHERE job_id = $1 AND worker_id = $2 FOR UPDATE', [uuidParam(ctx, 'id'), worker.id]);
  require(row, 'NOT_FOUND', 404);
  require(row.status === 'EXPRESSED', 'INVALID_STATE');
  return publicRow((await ctx.tx.one(`UPDATE job_interests SET status = 'WITHDRAWN' WHERE id = $1 RETURNING *`, [row.id]))!);
});

route(router, 'get', '/jobs/:id/interests', {auth: true}, async ctx => {
  const {tx} = ctx;
  const id = uuidParam(ctx, 'id');
  const job = await get(tx, 'job_requests', id);
  require(job.client_id === ctx.user.id || operations(ctx), 'NOT_FOUND', 404);
  const rows = await tx.query(`SELECT * FROM job_interests WHERE job_id = $1 AND status <> 'WITHDRAWN' ORDER BY distance_m LIMIT 100`, [id]);
  const items = [];
  for (const row of rows) {
    const worker = await get(tx, 'worker_profiles', row.worker_id);
    const person = await get(tx, 'users', worker.user_id);
    const names = await tx.query('SELECT c.name_hi FROM service_categories c JOIN worker_services ws ON ws.service_id = c.id WHERE ws.worker_id = $1', [worker.id]);
    const done = await tx.value<number>(`SELECT count(*)::int FROM assignments WHERE worker_id = $1 AND status = 'COMPLETED'`, [worker.id]);
    items.push({
      ...publicRow(row),
      worker_name: person.full_name,
      skills: names.map(n => n.name_hi),
      experience_years: worker.experience_years,
      completed_jobs: done,
      trust: await trust(tx, person.id),
    });
  }
  return {items, next_cursor: null};
});

route(router, 'post', '/jobs/:id/interests/:interest_id/select', {status: 201, auth: true}, async ctx => {
  const {tx, user} = ctx;
  const id = uuidParam(ctx, 'id');
  const interestId = uuidParam(ctx, 'interest_id');
  // The employer picks an interested worker. This creates a normal JobOffer; the worker still accepts it.
  const job = await get(tx, 'job_requests', id, true);
  require(job.client_id === user.id, 'NOT_FOUND', 404);
  require([...OPEN, 'ASSIGNED'].includes(job.status) && job.end_at > new Date(), 'JOB_NOT_OPEN');
  const row = await get(tx, 'job_interests', interestId, true);
  require(row.job_id === id, 'NOT_FOUND', 404);
  require(row.status === 'EXPRESSED', 'INVALID_STATE');
  require((await filled(tx, id)) < job.headcount, 'JOB_ALREADY_ASSIGNED');
  const worker = await get(tx, 'worker_profiles', row.worker_id, true);
  await MatchingService.eligibility(tx, job, worker, undefined, job.budget_max);
  const offer = await createOffer(tx, job, worker);
  await tx.query(`UPDATE job_interests SET status = 'SELECTED', offer_id = $2 WHERE id = $1`, [row.id, offer.id]);
  if (['SUBMITTED', 'MATCHING'].includes(job.status)) await tx.query(`UPDATE job_requests SET status = 'OFFERING' WHERE id = $1`, [id]);
  await emit(tx, 'OfferCreated', offer.id, [worker.user_id], '/worker/offers');
  await audit(tx, user, 'interest.select', row.id, ctx.requestId);
  return publicRow(offer);
});

route(router, 'get', '/wages/benchmark', {auth: true}, async ctx => {
  const q = parse(BenchmarkQuery, ctx.req.query, 'query');
  // Daily-wage comparison computed from real postings only, hidden until enough samples exist.
  const samples = (
    await ctx.tx.query(
      `SELECT budget_max FROM job_requests WHERE service_id = $1 AND engagement_type = 'DAILY' AND status <> 'DRAFT'
         AND budget_max IS NOT NULL AND created_at >= now() - make_interval(days => $2) ORDER BY budget_max`,
      [q.service_id, q.days],
    )
  ).map(r => r.budget_max as number);
  if (samples.length < BENCHMARK_MIN_SAMPLES) return {sample_size: samples.length, min_paise: null, median_paise: null, max_paise: null};
  return {sample_size: samples.length, min_paise: samples[0], median_paise: samples[Math.floor(samples.length / 2)], max_paise: samples.at(-1)};
});
