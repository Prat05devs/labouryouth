import {z} from 'zod';

// Request schemas, matching apps/api/app/schemas.py: unknown fields are rejected and every string is trimmed
// (Pydantic str_strip_whitespace also trims passwords, so stored hashes stay compatible).
const str = (min: number, max: number) => z.string().trim().min(min).max(max);
const email = z.string().trim().pipe(z.email());
const matching = (d: {password: string; confirm_password: string}) => d.password === d.confirm_password;
const mismatch = {message: 'PASSWORD_MISMATCH'};

export const Register = z
  .strictObject({
    full_name: str(2, 160),
    email,
    phone_number: str(10, 30),
    password: str(12, 128),
    confirm_password: z.string().trim(),
  })
  .refine(matching, mismatch);

export const Login = z.strictObject({email, password: str(1, 128)});
export const Refresh = z.strictObject({refresh_token: str(20, 200)});
export const EmailInput = z.strictObject({email});

export const Reset = z
  .strictObject({token: str(20, 200), password: str(12, 128), confirm_password: z.string().trim()})
  .refine(matching, mismatch);

export const RoleInput = z.strictObject({role: z.enum(['CLIENT', 'WORKER'])});

export const Preferences = z.strictObject({
  last_active_mode: z.enum(['CLIENT', 'WORKER']),
  locale: z.enum(['en', 'hi']).default('en'),
});

export const DeleteInput = z.strictObject({password: z.string().trim().max(128), confirm: z.literal(true)});

const uuid = z.string().trim().pipe(z.uuid()).transform(v => v.toLowerCase());
const lat = z.number().min(-90).max(90).nullable().default(null);
const lng = z.number().min(-180).max(180).nullable().default(null);

export const AddressInput = z.strictObject({
  city_id: uuid,
  label: str(1, 80),
  line1: str(3, 240),
  locality: str(1, 120),
  state: str(2, 100),
  postal_code: z.string().trim().regex(/^\d{6}$/),
  latitude: lat,
  longitude: lng,
  maps_url: z.string().trim().max(500).nullable().default(null),
});

export const ClientInput = z.strictObject({
  full_name: str(2, 160),
  client_type: z.enum(['INDIVIDUAL', 'BUSINESS']).default('INDIVIDUAL'),
  primary_address_id: uuid,
  whatsapp_number: str(10, 30).nullable().default(null),
});

export const AvailabilityInput = z
  .strictObject({
    online: z.boolean(),
    service_area_id: uuid,
    latitude: lat,
    longitude: lng,
    radius_m: z.number().int().min(100).max(50000).default(15000),
  })
  .refine(d => !(d.online && (d.latitude === null || d.longitude === null)) && (d.latitude === null) === (d.longitude === null), {
    message: 'LOCATION_REQUIRED',
  });

export const VerificationInput = z.strictObject({
  type: z.enum(['IDENTITY', 'POLICE', 'BANK', 'DRIVING_LICENSE', 'ADDRESS', 'SKILL_CERTIFICATE', 'REFERENCE']),
  document_id: uuid,
});

// Not strict, like the Python StepInput (a plain BaseModel): unknown top-level keys are ignored.
export const StepInput = z.object({data: z.record(z.string(), z.unknown()).default({})});

export const UploadInput = z.object({purpose: z.string()});

/** Pydantic AwareDatetime: an ISO 8601 date-time that carries a zone (Z or an offset), returned as a Date. */
export const aware = z.iso.datetime({offset: true}).transform(v => new Date(v));
const paise = z.number().int().min(0).max(100_000_000);
const dict = z.record(z.string(), z.unknown());

export const Window = z
  .strictObject({start_at: aware, end_at: aware})
  .refine(w => w.end_at > w.start_at, {message: 'SCHEDULE_INVALID'})
  .refine(w => w.end_at.getTime() - w.start_at.getTime() <= 86_400_000, {message: 'SHIFT_TOO_LONG'});

export const JobInput = z
  .strictObject({
    service_id: uuid,
    service_area_id: uuid,
    address_id: uuid,
    engagement_type: z.enum(['HOURLY', 'DAILY', 'FIXED_TERM', 'MONTHLY']),
    schedule: z.array(Window).min(1).max(62),
    headcount: z.number().int().min(1).max(100),
    budget_min: paise.nullable().default(null),
    budget_max: paise.nullable().default(null),
    currency: z.literal('INR').default('INR'),
    notes: z.string().trim().max(2000).default(''),
    requirements: dict.default({}),
    recurring_metadata: dict.default({}),
  })
  .superRefine((d, ctx) => {
    const fail = (message: string) => ctx.addIssue({code: 'custom', message, path: []});
    d.schedule.sort((a, b) => a.start_at.getTime() - b.start_at.getTime());
    if (d.schedule.some((w, i) => i > 0 && d.schedule[i - 1].end_at > w.start_at)) return fail('SCHEDULE_OVERLAP');
    if ((d.engagement_type === 'HOURLY' || d.engagement_type === 'DAILY') && d.schedule.length !== 1) return fail('SCHEDULE_INVALID');
    if ((d.engagement_type === 'FIXED_TERM' || d.engagement_type === 'MONTHLY') && d.schedule.length < 2) return fail('MULTIPLE_SHIFTS_REQUIRED');
    if (d.budget_max !== null && d.budget_max < (d.budget_min ?? 0)) return fail('BUDGET_INVALID');
  });

export const ReasonInput = z.strictObject({reason: str(3, 1000)});

export const CheckInInput = z.strictObject({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracy_m: z.number().gt(0).max(10000),
  device_timestamp: z.iso.datetime({offset: true}),
});

export const ReplacementInput = z.strictObject({
  assignment_id: uuid,
  reason: z.enum(['NO_SHOW', 'UNAVAILABLE', 'QUALITY_ISSUE', 'CLIENT_REQUEST', 'WORKER_REQUEST', 'EMERGENCY', 'OTHER']),
  details: z.string().trim().max(2000).default(''),
});

export const IncidentInput = z.strictObject({
  assignment_id: uuid,
  type: z.enum(['NO_SHOW', 'BEHAVIOUR', 'PAYMENT', 'SAFETY', 'QUALITY', 'LOCATION', 'ATTENDANCE', 'OTHER']),
  description: str(3, 4000),
});

export const ReviewInput = z.strictObject({
  assignment_id: uuid,
  rating: z.number().int().min(1).max(5),
  tags: z.array(z.string().trim()).max(10).default([]),
  comment: z.string().trim().max(2000).default(''),
});

export const OfferInput = z.strictObject({
  worker_id: uuid,
  expires_at: aware,
  agreed_worker_amount_paise: paise,
  replacement_request_id: uuid.nullable().default(null),
});

export const PaymentCreate = z.strictObject({
  job_id: uuid,
  method: z.enum(['PAY_LATER', 'CASH', 'MANUAL_UPI']),
  amount_paise: z.number().int().gt(0).max(100_000_000),
});

export const PaymentReconcile = z.strictObject({
  amount_paise: z.number().int().gt(0).max(100_000_000),
  reference: str(4, 200),
});

export const QuickJobInput = z.strictObject({
  service_id: uuid,
  service_area_id: uuid,
  preferred_worker_id: uuid.nullable().default(null),
  latitude: lat,
  longitude: lng,
  maps_url: z.string().trim().max(500).nullable().default(null),
  locality: z.string().trim().max(120).default(''),
  start_at: aware,
  hours: z.number().int().min(1).max(16).default(8),
  headcount: z.number().int().min(1).max(100),
  wage_per_day_paise: z.number().int().gt(0).max(100_000_000),
  notes: z.string().trim().max(500).default(''),
});

// Query strings arrive as text; these mirror FastAPI's coercion of query parameters.
const qint = z.coerce.number().int();
const qnum = z.coerce.number();
const qbool = z
  .string()
  .transform(v => v.toLowerCase())
  .pipe(z.enum(['true', '1', 'yes', 'on', 't', 'y', 'false', '0', 'no', 'off', 'f', 'n']))
  .transform(v => ['true', '1', 'yes', 'on', 't', 'y'].includes(v));

export const NearbyQuery = z.object({
  radius_km: qint.default(10),
  service_id: uuid.optional(),
  today: qbool.default(false),
  engagement: z.enum(['DAILY', 'PERMANENT']).optional(),
  min_wage_paise: qint.min(0).max(100_000_000).optional(),
  latitude: qnum.min(-90).max(90).optional(),
  longitude: qnum.min(-180).max(180).optional(),
});

export const BenchmarkQuery = z.object({service_id: uuid, days: qint.min(7).max(180).default(60)});
export const BrowseQuery = z.object({service_id: uuid.optional(), limit: qint.min(1).max(50).default(30)});
