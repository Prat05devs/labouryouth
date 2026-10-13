import {createHash, randomUUID} from 'node:crypto';
import express from 'express';
import {settings} from '../config.ts';
import type {Row, Tx} from '../db.ts';
import {require} from '../errors.ts';
import {workerFor} from '../domain.ts';
import {FileReply, permit, route, uuidParam} from '../http.ts';
import {pinFor} from '../maps.ts';
import {get, listing, publicRow} from '../repository.ts';
import {AddressInput, AvailabilityInput, ClientInput, StepInput, UploadInput, VerificationInput} from '../schemas.ts';
import {isUuid, normalizePhone} from '../security.ts';
import {storage} from '../storage.ts';
import type {z} from 'zod';

export const router = express.Router();

route(router, 'get', '/services', {}, async ({tx}) =>
  listing(tx, 'SELECT * FROM service_categories WHERE active ORDER BY sort_order'),
);

route(router, 'get', '/locations', {}, async ({tx}) => ({
  cities: (await listing(tx, 'SELECT * FROM cities WHERE active')).items,
  service_areas: (await listing(tx, 'SELECT * FROM service_areas WHERE active')).items,
}));

route(router, 'get', '/addresses', {auth: true}, async ({tx, user}) =>
  listing(tx, 'SELECT * FROM addresses WHERE owner_id = $1', [user.id]),
);

/** Address fields from the form; the pin comes from coordinates or a Google Maps link (Decision 21). */
async function place(tx: Tx, data: z.output<typeof AddressInput>) {
  const area = await tx.one('SELECT * FROM service_areas WHERE city_id = $1 AND active LIMIT 1', [data.city_id]);
  require(area, 'OUTSIDE_SERVICE_AREA', 422);
  const pin = await pinFor(tx, area, data.maps_url, data.latitude, data.longitude, false);
  return [data.city_id, data.label, data.line1, data.locality, data.state, data.postal_code, data.maps_url, pin.latitude, pin.longitude, pin.point, pin.precision];
}

route(router, 'post', '/addresses', {status: 201, body: AddressInput, auth: true}, async ({tx, user}, data) => {
  const city = await get(tx, 'cities', data.city_id);
  require(city.active, 'OUTSIDE_SERVICE_AREA', 422);
  const row = await tx.one(
    `INSERT INTO addresses (id, owner_id, city_id, label, line1, locality, state, postal_code, maps_url, latitude, longitude, point, location_precision)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, ST_GeogFromText($12), $13) RETURNING *`,
    [randomUUID(), user.id, ...(await place(tx, data))],
  );
  return publicRow(row!);
});

route(router, 'put', '/addresses/:id', {body: AddressInput, auth: true}, async (ctx, data) => {
  const {tx, user} = ctx;
  const id = uuidParam(ctx, 'id');
  const current = await get(tx, 'addresses', id);
  require(current.owner_id === user.id, 'NOT_FOUND', 404);
  await get(tx, 'cities', data.city_id);
  const row = await tx.one(
    `UPDATE addresses SET city_id = $2, label = $3, line1 = $4, locality = $5, state = $6, postal_code = $7, maps_url = $8,
       latitude = $9, longitude = $10, point = ST_GeogFromText($11), location_precision = $12
     WHERE id = $1 RETURNING *`,
    [id, ...(await place(tx, data))],
  );
  return publicRow(row!);
});

route(router, 'get', '/client/profile', {auth: true}, async ({tx, user}) => {
  const row = await tx.one('SELECT * FROM client_profiles WHERE user_id = $1', [user.id]);
  require(row, 'NOT_FOUND', 404);
  return publicRow(row);
});

route(router, 'put', '/client/profile', {body: ClientInput, auth: true}, async (ctx, data) => {
  const {tx, user} = ctx;
  permit(ctx, 'CLIENT');
  const row = await tx.one('SELECT * FROM client_profiles WHERE user_id = $1', [user.id]);
  require(row, 'NOT_FOUND', 404);
  const address = await get(tx, 'addresses', data.primary_address_id);
  require(address.owner_id === user.id, 'NOT_FOUND', 404);
  const whatsapp = data.whatsapp_number ? normalizePhone(data.whatsapp_number) : row.whatsapp_number;
  const saved = await tx.one(
    `UPDATE client_profiles SET client_type = $2, primary_address_id = $3, whatsapp_number = $4, onboarding_complete = true
     WHERE id = $1 RETURNING *`,
    [row.id, data.client_type, address.id, whatsapp],
  );
  await tx.query('UPDATE users SET full_name = $2 WHERE id = $1', [user.id, data.full_name]);
  return publicRow(saved!);
});

route(router, 'get', '/worker/profile', {auth: true}, async ({tx, user}) => {
  const w = await workerFor(tx, user.id);
  return {
    ...publicRow(w),
    services: (await tx.query('SELECT service_id FROM worker_services WHERE worker_id = $1', [w.id])).map(r => r.service_id),
    languages: (await tx.query('SELECT language_code FROM worker_languages WHERE worker_id = $1', [w.id])).map(r => r.language_code),
  };
});

const STEPS = ['basic', 'photo', 'services', 'experience', 'languages', 'locations', 'availability', 'identity', 'police', 'payout'];
const invalid = () => require(false, 'VALIDATION_ERROR', 422);

/** UUID strings from an onboarding payload; anything else is a validation error, not a server error. */
function uuids(value: unknown): string[] {
  if (!Array.isArray(value) || !value.every(isUuid)) invalid();
  return (value as string[]).map(v => v.toLowerCase());
}

route(router, 'put', '/worker/onboarding/:step', {body: StepInput, auth: true}, async (ctx, body) => {
  const {tx, user} = ctx;
  const step = String(ctx.req.params.step);
  require(STEPS.includes(step), 'VALIDATION_ERROR', 422);
  const w = await workerFor(tx, user.id, true);
  require(['NOT_STARTED', 'IN_PROGRESS'].includes(w.onboarding_status));
  let d: Row = body.data;
  require(JSON.stringify(d).length <= 10000, 'VALIDATION_ERROR', 422);
  if (step === 'basic') {
    const name = d.full_name;
    require(
      Object.keys(d).every(k => k === 'full_name' || k === 'bio') && typeof name === 'string' && name.length >= 2 && name.length <= 160,
      'VALIDATION_ERROR',
      422,
    );
    await tx.query('UPDATE users SET full_name = $2 WHERE id = $1', [user.id, name]);
  } else if (step === 'photo') {
    require(isUuid(d.document_id), 'VALIDATION_ERROR', 422);
    const doc = await get(tx, 'documents', d.document_id);
    require(doc.owner_id === user.id && doc.purpose === 'PHOTO', 'NOT_FOUND', 404);
  } else if (step === 'services') {
    const ids = uuids(d.service_ids ?? []);
    require(ids.length > 0 && ids.length <= 20, 'VALIDATION_ERROR', 422);
    for (const id of ids) require((await get(tx, 'service_categories', id)).active, 'VALIDATION_ERROR', 422);
    await tx.query('DELETE FROM worker_services WHERE worker_id = $1', [w.id]);
    for (const id of new Set(ids)) {
      await tx.query('INSERT INTO worker_services (id, worker_id, service_id) VALUES ($1, $2, $3)', [randomUUID(), w.id, id]);
    }
  } else if (step === 'experience') {
    const years = d.years;
    require(Number.isInteger(years) && years >= 0 && years <= 60, 'VALIDATION_ERROR', 422);
    await tx.query('UPDATE worker_profiles SET experience_years = $2 WHERE id = $1', [w.id, years]);
  } else if (step === 'languages') {
    const codes = d.codes ?? [];
    require(
      Array.isArray(codes) && codes.length > 0 && codes.length <= 10 && codes.every(c => typeof c === 'string' && c.length >= 2 && c.length <= 10),
      'VALIDATION_ERROR',
      422,
    );
    await tx.query('DELETE FROM worker_languages WHERE worker_id = $1', [w.id]);
    for (const code of new Set<string>(codes)) {
      await tx.query('INSERT INTO worker_languages (id, worker_id, language_code) VALUES ($1, $2, $3)', [randomUUID(), w.id, code]);
    }
  } else if (step === 'locations') {
    const ids = uuids(d.service_area_ids ?? []);
    require(ids.length > 0 && ids.length <= 10, 'VALIDATION_ERROR', 422);
    for (const id of ids) require((await get(tx, 'service_areas', id)).active, 'OUTSIDE_SERVICE_AREA', 422);
  } else if (step === 'availability') {
    require(await tx.one('SELECT id FROM worker_availability WHERE worker_id = $1', [w.id]), 'VALIDATION_ERROR', 422);
  } else if (step === 'identity' || step === 'police') {
    require(
      await tx.one(
        `SELECT id FROM worker_verifications WHERE worker_id = $1 AND type = $2 AND status IN ('PENDING', 'APPROVED') LIMIT 1`,
        [w.id, step.toUpperCase()],
      ),
      'DOCUMENT_REQUIRED',
      422,
    );
  } else if (step === 'payout') {
    d = {deferred: true};
  }
  const saved = await tx.one(
    `UPDATE worker_profiles SET progress = progress || jsonb_build_object($2::text, $3::jsonb), onboarding_status = 'IN_PROGRESS'
     WHERE id = $1 RETURNING *`,
    [w.id, step, JSON.stringify(d)],
  );
  return publicRow(saved!);
});

route(router, 'post', '/worker/onboarding/submit', {auth: true}, async ({tx, user}) => {
  const w = await workerFor(tx, user.id, true);
  require(STEPS.every(s => s in w.progress), 'ONBOARDING_INCOMPLETE', 422);
  require(w.onboarding_status === 'IN_PROGRESS');
  const saved = await tx.one(`UPDATE worker_profiles SET onboarding_status = 'SUBMITTED' WHERE id = $1 RETURNING *`, [w.id]);
  return publicRow(saved!);
});

route(router, 'get', '/worker/availability', {auth: true}, async ({tx, user}) => {
  const w = await workerFor(tx, user.id);
  const a = await tx.one('SELECT * FROM worker_availability WHERE worker_id = $1', [w.id]);
  return a ? publicRow(a) : null;
});

route(router, 'put', '/worker/availability', {body: AvailabilityInput, auth: true}, async ({tx, user}, data) => {
  const w = await workerFor(tx, user.id);
  const area = await get(tx, 'service_areas', data.service_area_id);
  require(area.active, 'OUTSIDE_SERVICE_AREA', 422);
  const point = data.latitude !== null && data.longitude !== null ? `SRID=4326;POINT(${data.longitude} ${data.latitude})` : null;
  // One row per worker (unique index); upsert so two quick toggles cannot collide. A missing pin keeps the last one.
  const a = await tx.one(
    `INSERT INTO worker_availability (id, worker_id, online, kind, service_area_id, radius_m, point)
     VALUES ($1, $2, $3, 'IMMEDIATE', $4, $5, ST_GeogFromText($6))
     ON CONFLICT (worker_id) DO UPDATE SET online = EXCLUDED.online, service_area_id = EXCLUDED.service_area_id,
       radius_m = EXCLUDED.radius_m, point = COALESCE(EXCLUDED.point, worker_availability.point)
     RETURNING *`,
    [randomUUID(), w.id, data.online, data.service_area_id, data.radius_m, point],
  );
  return publicRow(a!);
});

const PURPOSES = ['PHOTO', 'IDENTITY', 'POLICE', 'DRIVING_LICENSE', 'BANK', 'ADDRESS', 'SKILL_CERTIFICATE', 'REFERENCE'];
const SIGNATURES: Record<string, Buffer> = {
  'image/jpeg': Buffer.from([0xff, 0xd8, 0xff]),
  'image/png': Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  'application/pdf': Buffer.from('%PDF-'),
};

route(router, 'post', '/documents', {status: 201, upload: true, body: UploadInput, auth: true}, async ({tx, user, req}, {purpose}) => {
  const file = req.file;
  require(file, 'VALIDATION_ERROR', 422, {fields: [{path: 'body.file', type: 'missing'}]});
  require(PURPOSES.includes(purpose), 'VALIDATION_ERROR', 422);
  const content = file.buffer;
  require(content.length > 0 && content.length <= settings().maxUploadBytes, 'UPLOAD_TOO_LARGE', 422);
  // The declared type must match the file's own magic bytes; the browser's word is not enough.
  const signature = SIGNATURES[file.mimetype];
  require(signature && content.subarray(0, signature.length).equals(signature), 'UNSUPPORTED_FILE_TYPE', 422);
  if (purpose === 'PHOTO') require(file.mimetype.startsWith('image/'), 'UNSUPPORTED_FILE_TYPE', 422);
  const key = randomUUID();
  await storage().put(key, content, file.mimetype);
  const row = await tx.one(
    `INSERT INTO documents (id, owner_id, storage_key, purpose, mime_type, size_bytes, checksum)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [randomUUID(), user.id, key, purpose, file.mimetype, content.length, createHash('sha256').update(content).digest('hex')],
  );
  return publicRow(row!);
});

route(router, 'get', '/documents/:id', {auth: true}, async ctx => {
  const {tx, user, roles} = ctx;
  const doc = await get(tx, 'documents', uuidParam(ctx, 'id'));
  // A hirer may see a worker's profile photo only once that worker has been assigned to one of the hirer's jobs.
  let canViewPhoto = false;
  if (doc.purpose === 'PHOTO' && roles.includes('CLIENT')) {
    const worker = await tx.one('SELECT * FROM worker_profiles WHERE user_id = $1', [doc.owner_id]);
    if (worker && worker.progress?.photo?.document_id === doc.id) {
      canViewPhoto = !!(await tx.one(
        `SELECT a.id FROM assignments a JOIN job_requests j ON a.job_id = j.id WHERE a.worker_id = $1 AND j.client_id = $2 LIMIT 1`,
        [worker.id, user.id],
      ));
    }
  }
  require(doc.owner_id === user.id || canViewPhoto || roles.some(r => r === 'SUPER_ADMIN' || r === 'VERIFICATION'), 'NOT_FOUND', 404);
  const content = await storage().get(doc.storage_key);
  require(content, 'NOT_FOUND', 404);
  return new FileReply(content, {
    'Content-Type': doc.mime_type,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Content-Disposition': doc.purpose === 'PHOTO' ? 'inline' : 'attachment',
  });
});

route(router, 'get', '/worker/verifications', {auth: true}, async ({tx, user}) => {
  const w = await workerFor(tx, user.id);
  return listing(tx, 'SELECT * FROM worker_verifications WHERE worker_id = $1 ORDER BY created_at DESC', [w.id]);
});

route(router, 'post', '/worker/verifications', {status: 201, body: VerificationInput, auth: true}, async ({tx, user}, data) => {
  const w = await workerFor(tx, user.id);
  const doc = await get(tx, 'documents', data.document_id);
  require(doc.owner_id === user.id && doc.purpose === data.type, 'NOT_FOUND', 404);
  const row = await tx.one(
    `INSERT INTO worker_verifications (id, worker_id, type, document_id, status) VALUES ($1, $2, $3, $4, 'PENDING') RETURNING *`,
    [randomUUID(), w.id, data.type, doc.id],
  );
  return publicRow(row!);
});
