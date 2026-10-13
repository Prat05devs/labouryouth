import {createHash, randomUUID} from 'node:crypto';
import {settings} from './config.ts';
import type {Row, Tx} from './db.ts';
import {DomainError, require} from './errors.ts';
import {emit} from './events.ts';
import {get, publicRow} from './repository.ts';

export const LIVE = ['PENDING', 'ACCEPTED', 'EN_ROUTE', 'ARRIVED', 'IN_PROGRESS'];
const NOT_LIVE_SLOT = ['CANCELLED', 'REPLACED', 'NO_SHOW'];

export async function workerFor(tx: Tx, userId: string, lock = false): Promise<Row> {
  const worker = await tx.one(`SELECT * FROM worker_profiles WHERE user_id = $1${lock ? ' FOR UPDATE' : ''}`, [userId]);
  require(worker, 'NOT_FOUND', 404);
  return worker;
}

export async function visibleAssignment(tx: Tx, id: string, user: Row, admin = false) {
  const a = await get(tx, 'assignments', id);
  const w = await get(tx, 'worker_profiles', a.worker_id);
  const j = await get(tx, 'job_requests', a.job_id);
  require(admin || j.client_id === user.id || w.user_id === user.id, 'NOT_FOUND', 404);
  return {a, w, j};
}

/** JSON with sorted keys, so the same request always hashes the same way. */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + canonical((value as Row)[k])).join(',') + '}';
  }
  return JSON.stringify(value) ?? 'null';
}

/**
 * Runs `action` once per (actor, operation, key). A repeat with the same body returns the stored response; a repeat
 * with a different body is IDEMPOTENCY_CONFLICT. The transaction-scoped advisory lock serializes concurrent repeats.
 */
export async function idempotent<T>(tx: Tx, user: Row, operation: string, key: string | undefined, payload: unknown, action: () => Promise<T>) {
  require(key && key.length >= 8 && key.length <= 120, 'IDEMPOTENCY_KEY_REQUIRED', 422);
  const hashed = createHash('sha256').update(canonical(payload)).digest('hex');
  const lock = createHash('sha256').update(`${user.id}:${operation}:${key}`).digest().readBigInt64BE(0);
  await tx.query('SELECT pg_advisory_xact_lock($1::bigint)', [lock.toString()]);
  const old = await tx.one('SELECT * FROM idempotency_records WHERE actor_id = $1 AND operation = $2 AND key = $3', [user.id, operation, key]);
  if (old) {
    require(old.request_hash === hashed, 'IDEMPOTENCY_CONFLICT');
    return old.response as T;
  }
  const result = await action();
  await tx.query(
    'INSERT INTO idempotency_records (id, actor_id, operation, key, request_hash, response) VALUES ($1, $2, $3, $4, $5, $6)',
    [randomUUID(), user.id, operation, key, hashed, JSON.stringify(result)],
  );
  return result;
}

export const PricingService = {
  quote: (job: Row) => ({status: 'QUOTE_REQUIRED', currency: job.currency, budget_min: job.budget_min, budget_max: job.budget_max}),
};

type Window = {start_at: string | Date; end_at: string | Date};

export const MatchingService = {
  /** Every rule a worker must pass for this job; throws the first one that fails. Returns the distance in meters. */
  async eligibility(tx: Tx, job: Row, worker: Row, windows?: Window[], amount?: number | null): Promise<number> {
    require(worker.worker_status === 'ACTIVE' && worker.onboarding_status === 'COMPLETE', 'WORKER_NOT_VERIFIED');
    require(
      await tx.one('SELECT id FROM worker_services WHERE worker_id = $1 AND service_id = $2', [worker.id, job.service_id]),
      'SERVICE_MISMATCH',
    );
    const service = await get(tx, 'service_categories', job.service_id);
    const approved = new Set(
      (
        await tx.query(
          `SELECT type FROM worker_verifications WHERE worker_id = $1 AND status = 'APPROVED' AND (expires_at IS NULL OR expires_at > now())`,
          [worker.id],
        )
      ).map(r => r.type),
    );
    require((service.verification_types as string[]).every(t => approved.has(t)), 'WORKER_NOT_VERIFIED');
    const avail = await tx.one('SELECT * FROM worker_availability WHERE worker_id = $1', [worker.id]);
    require(avail && avail.online && avail.point !== null && avail.service_area_id === job.service_area_id, 'WORKER_UNAVAILABLE');
    require((worker.engagement_types as string[]).includes(job.engagement_type), 'ENGAGEMENT_MISMATCH');
    const distance = await tx.value<number | null>(
      'SELECT ST_Distance(a.point, j.point) FROM worker_availability a, job_requests j WHERE a.id = $1 AND j.id = $2',
      [avail.id, job.id],
    );
    require(distance != null && distance <= avail.radius_m, 'OUTSIDE_SERVICE_AREA');
    require(amount == null || worker.rate_min_paise == null || amount >= worker.rate_min_paise, 'RATE_MISMATCH');
    for (const window of windows ?? (job.schedule as Window[])) {
      const clash = await tx.one(
        `SELECT s.id FROM shifts s JOIN assignments a ON s.assignment_id = a.id
         WHERE a.worker_id = $1 AND a.status = ANY($2) AND s.status IN ('SCHEDULED', 'IN_PROGRESS')
           AND s.scheduled_start < $3 AND s.scheduled_end > $4 LIMIT 1`,
        [worker.id, LIVE, new Date(window.end_at), new Date(window.start_at)],
      );
      require(!clash, 'SCHEDULE_CONFLICT');
    }
    return Math.trunc(distance);
  },

  async generate(tx: Tx, job: Row) {
    require(['SUBMITTED', 'MATCHING', 'OFFERING', 'ASSIGNED', 'ACTIVE'].includes(job.status));
    if (job.status === 'SUBMITTED') await tx.query(`UPDATE job_requests SET status = 'MATCHING' WHERE id = $1`, [job.id]);
    await tx.query(`UPDATE candidate_matches SET status = 'STALE' WHERE job_id = $1`, [job.id]);
    const results: Row[] = [];
    for (const worker of await tx.query(`SELECT * FROM worker_profiles WHERE worker_status = 'ACTIVE'`)) {
      let distance: number;
      try {
        distance = await MatchingService.eligibility(tx, job, worker, undefined, job.budget_max);
      } catch (error) {
        if (error instanceof DomainError) continue;
        throw error;
      }
      const row = await tx.one(
        `INSERT INTO candidate_matches (id, job_id, worker_id, distance_m, final_score, metadata, status, generated_at)
         VALUES ($1, $2, $3, $4, $5, $6, 'ELIGIBLE', now())
         ON CONFLICT (job_id, worker_id) DO UPDATE SET distance_m = EXCLUDED.distance_m, final_score = EXCLUDED.final_score,
           metadata = EXCLUDED.metadata, status = 'ELIGIBLE', generated_at = now()
         RETURNING *`,
        [randomUUID(), job.id, worker.id, distance, Math.max(0, 100 - Math.trunc(distance / 500)), {version: 1, eligibility: 'passed'}],
      );
      results.push(publicRow(row!));
    }
    results.sort((a, b) => b.final_score - a.final_score || (a.worker_id < b.worker_id ? -1 : a.worker_id > b.worker_id ? 1 : 0));
    return {items: results, next_cursor: null};
  },
};

export const OfferService = {
  /** Locks job, then worker, then offer (ARCHITECTURE.md lock order), so concurrent accepts cannot overfill a job. */
  async accept(tx: Tx, user: Row, id: string) {
    const peek = await get(tx, 'job_offers', id);
    const job = await get(tx, 'job_requests', peek.job_id, true);
    const worker = await workerFor(tx, user.id, true);
    require(peek.worker_id === worker.id, 'NOT_FOUND', 404);
    const offer = await get(tx, 'job_offers', id, true);
    require(offer.status === 'PENDING', 'JOB_ALREADY_ASSIGNED');
    require(offer.expires_at > new Date(), 'OFFER_EXPIRED');
    require(['OFFERING', 'MATCHING', 'ASSIGNED', 'ACTIVE'].includes(job.status), 'JOB_ALREADY_ASSIGNED');
    let replacement: Row | null = null;
    let original: Row | null = null;
    let remaining: Row[] = [];
    let windows: Window[] = job.schedule;
    let slot: number;
    if (offer.replacement_request_id) {
      replacement = await get(tx, 'replacement_requests', offer.replacement_request_id, true);
      require(['MATCHING', 'OFFERING'].includes(replacement.status), 'JOB_ALREADY_ASSIGNED');
      original = await get(tx, 'assignments', replacement.original_assignment_id, true);
      require(original.worker_id !== worker.id && [...LIVE, 'NO_SHOW'].includes(original.status), 'INVALID_REPLACEMENT');
      require(
        !(await tx.one(`SELECT id FROM shifts WHERE assignment_id = $1 AND status = 'IN_PROGRESS'`, [original.id])),
        'SHIFT_NOT_ACTIVE',
      );
      remaining = await tx.query(`SELECT * FROM shifts WHERE assignment_id = $1 AND status = 'SCHEDULED' ORDER BY scheduled_start`, [original.id]);
      require(remaining.length, 'NO_REMAINING_SHIFTS');
      windows = remaining.map(s => ({start_at: s.scheduled_start, end_at: s.scheduled_end}));
      slot = original.slot_number;
    } else {
      const occupied = new Set(
        (await tx.query('SELECT slot_number FROM assignments WHERE job_id = $1 AND NOT (status = ANY($2))', [job.id, NOT_LIVE_SLOT])).map(r => r.slot_number),
      );
      const free = Array.from({length: job.headcount}, (_, i) => i + 1).filter(i => !occupied.has(i));
      require(free.length, 'JOB_ALREADY_ASSIGNED');
      slot = free[0];
    }
    await MatchingService.eligibility(tx, job, worker, windows, offer.agreed_worker_amount_paise);
    if (original) {
      await tx.query(`UPDATE assignments SET status = 'REPLACED' WHERE id = $1`, [original.id]);
      await tx.query(`UPDATE shifts SET status = 'CANCELLED' WHERE id = ANY($1)`, [remaining.map(s => s.id)]);
    }
    await tx.query(`UPDATE job_offers SET status = 'ACCEPTED', responded_at = now() WHERE id = $1`, [offer.id]);
    const a = await tx.one(
      `INSERT INTO assignments (id, job_id, worker_id, offer_id, slot_number, status, replacement_of_id)
       VALUES ($1, $2, $3, $4, $5, 'ACCEPTED', $6) RETURNING *`,
      [randomUUID(), job.id, worker.id, offer.id, slot, original?.id ?? null],
    );
    // Integer paise split across shifts; the first shifts absorb the remainder so the total is exact.
    const total = offer.agreed_worker_amount_paise;
    const rate = Math.floor(total / windows.length);
    const remainder = total % windows.length;
    for (const [i, w] of windows.entries()) {
      await tx.query(
        `INSERT INTO shifts (id, assignment_id, scheduled_start, scheduled_end, status, agreed_earning_paise) VALUES ($1, $2, $3, $4, 'SCHEDULED', $5)`,
        [randomUUID(), a!.id, new Date(w.start_at), new Date(w.end_at), rate + (i < remainder ? 1 : 0)],
      );
    }
    const count = await tx.value<number>('SELECT count(*)::int FROM assignments WHERE job_id = $1 AND NOT (status = ANY($2))', [job.id, NOT_LIVE_SLOT]);
    if (count! >= job.headcount) {
      if (job.status !== 'ACTIVE') await tx.query(`UPDATE job_requests SET status = 'ASSIGNED' WHERE id = $1`, [job.id]);
      await tx.query(
        `UPDATE job_offers SET status = 'WITHDRAWN' WHERE job_id = $1 AND status = 'PENDING' AND replacement_request_id IS NULL`,
        [job.id],
      );
    }
    const route = `/shared/assignment/${a!.id}`;
    if (replacement) {
      await tx.query(
        `UPDATE replacement_requests SET status = 'RESOLVED', replacement_assignment_id = $2, resolved_at = now() WHERE id = $1`,
        [replacement.id, a!.id],
      );
      await tx.query(`UPDATE job_offers SET status = 'WITHDRAWN' WHERE replacement_request_id = $1 AND status = 'PENDING'`, [replacement.id]);
      await emit(tx, 'ReplacementAssigned', replacement.id, [job.client_id, user.id], route);
    }
    await emit(tx, 'OfferAccepted', offer.id, [user.id, job.client_id], route);
    await emit(tx, 'AssignmentCreated', a!.id, [user.id, job.client_id], route);
    return publicRow(a!);
  },
};

export const ShiftService = {
  /** Loads and locks a shift's job, worker, assignment and shift, in that order, for the shift's own worker. */
  async context(tx: Tx, user: Row, id: string) {
    const peek = await get(tx, 'shifts', id);
    const assignment = await get(tx, 'assignments', peek.assignment_id);
    const j = await get(tx, 'job_requests', assignment.job_id, true);
    const w = await get(tx, 'worker_profiles', assignment.worker_id, true);
    require(w.user_id === user.id, 'NOT_FOUND', 404);
    const a = await get(tx, 'assignments', assignment.id, true);
    const s = await get(tx, 'shifts', id, true);
    require(w.worker_status === 'ACTIVE', 'WORKER_NOT_VERIFIED');
    require(!['CANCELLED', 'EXPIRED', 'ON_HOLD'].includes(j.status), 'SHIFT_NOT_ACTIVE');
    return {s, a, w, j};
  },

  async checkIn(tx: Tx, user: Row, id: string, data: {latitude: number; longitude: number; accuracy_m: number; device_timestamp: string}) {
    const {s, a, w, j} = await ShiftService.context(tx, user, id);
    require(a.status === 'ARRIVED' && s.status === 'SCHEDULED', 'SHIFT_NOT_ACTIVE');
    const cfg = settings();
    const instant = new Date();
    const minute = 60_000;
    const opens = s.scheduled_start.getTime() - cfg.checkInEarlyMinutes * minute;
    const closes = Math.min(s.scheduled_start.getTime() + cfg.checkInLateMinutes * minute, s.scheduled_end.getTime());
    let error: string | null = null;
    if (instant.getTime() < opens || instant.getTime() > closes) error = 'CHECK_IN_WINDOW_CLOSED';
    else if (data.accuracy_m > cfg.maxLocationAccuracyMeters) error = 'LOCATION_INACCURATE';
    // Server time is authoritative; a device clock far from it means a stale or replayed position.
    else if (Math.abs(instant.getTime() - new Date(data.device_timestamp).getTime()) / 1000 > cfg.maxLocationAgeSeconds) error = 'LOCATION_STALE';
    else {
      // Without a map pin the job point is the area centre, so only presence in the area is checked.
      const inside = await tx.value<boolean>(
        `SELECT ST_DWithin(j.point, ST_GeogFromText($2), CASE WHEN j.location_precision = 'PIN' THEN $3::int ELSE sa.radius_m END)
         FROM job_requests j JOIN service_areas sa ON sa.id = j.service_area_id WHERE j.id = $1`,
        [j.id, `SRID=4326;POINT(${data.longitude} ${data.latitude})`, cfg.geofenceRadiusMeters],
      );
      if (!inside) error = 'OUTSIDE_GEOFENCE';
    }
    await tx.query(
      `INSERT INTO attendance_events (id, worker_id, shift_id, actor_id, type, observation, device_timestamp, reason)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [randomUUID(), w.id, s.id, user.id, error ? 'REJECTED' : 'CHECK_IN', data, new Date(data.device_timestamp), error],
    );
    if (error) {
      await tx.commit(); // The rejected attempt is evidence and must survive the error response.
      throw new DomainError(error, 409, {retryable: true});
    }
    const shift = await tx.one(`UPDATE shifts SET status = 'IN_PROGRESS' WHERE id = $1 RETURNING *`, [s.id]);
    await tx.query(`UPDATE assignments SET status = 'IN_PROGRESS', started_at = COALESCE(started_at, $2) WHERE id = $1`, [a.id, instant]);
    await tx.query(`UPDATE job_requests SET status = 'ACTIVE' WHERE id = $1`, [j.id]);
    await emit(tx, 'WorkerCheckedIn', s.id, [j.client_id, user.id], `/shared/assignment/${a.id}`);
    return publicRow(shift!);
  },

  async complete(tx: Tx, user: Row, id: string) {
    const {s, a, w, j} = await ShiftService.context(tx, user, id);
    require(s.status === 'IN_PROGRESS' && a.status === 'IN_PROGRESS', 'SHIFT_NOT_ACTIVE');
    const shift = await tx.one(`UPDATE shifts SET status = 'COMPLETED' WHERE id = $1 RETURNING *`, [s.id]);
    await tx.query(`INSERT INTO attendance_events (id, worker_id, shift_id, actor_id, type) VALUES ($1, $2, $3, $4, 'CHECK_OUT')`, [randomUUID(), w.id, s.id, user.id]);
    await tx.query(
      `INSERT INTO worker_ledger_entries (id, worker_id, type, amount_paise, currency, shift_id, source_key) VALUES ($1, $2, 'EARNING', $3, 'INR', $4, $5)`,
      [randomUUID(), w.id, s.agreed_earning_paise, s.id, `shift:${s.id}:earning`],
    );
    const open = await tx.value<number>(`SELECT count(*)::int FROM shifts WHERE assignment_id = $1 AND status NOT IN ('COMPLETED', 'CANCELLED')`, [a.id]);
    if (!open) {
      await tx.query(`UPDATE assignments SET status = 'COMPLETED', completed_at = now() WHERE id = $1`, [a.id]);
      const done = await tx.value<number>(`SELECT count(*)::int FROM assignments WHERE job_id = $1 AND status = 'COMPLETED'`, [j.id]);
      if (done! >= j.headcount) await tx.query(`UPDATE job_requests SET status = 'COMPLETED' WHERE id = $1`, [j.id]);
    }
    await emit(tx, 'ShiftCompleted', s.id, [j.client_id, user.id], `/shared/assignment/${a.id}`);
    return publicRow(shift!);
  },
};
