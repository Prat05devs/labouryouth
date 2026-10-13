import {existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {SERVER_ROOT} from './paths.ts';

// Same variables and checks as apps/api/app/config.py, so one .env serves both backends during the move.
for (const file of [resolve(SERVER_ROOT, '../../.env'), resolve('.env')]) {
  if (existsSync(file)) process.loadEnvFile(file);
}

const text = (name: string, fallback = '') => process.env[name] ?? fallback;
const int = (name: string, fallback: number) => {
  const value = process.env[name];
  return value === undefined || value === '' ? fallback : Number.parseInt(value, 10);
};

export type Settings = ReturnType<typeof load>;

function load() {
  const s = {
    appEnv: text('APP_ENV', 'development'),
    databaseUrl: text('DATABASE_URL'),
    jwtSecret: text('JWT_SECRET'),
    jwtIssuer: text('JWT_ISSUER', 'labour-youth'),
    jwtAudience: text('JWT_AUDIENCE', 'labour-youth-app'),
    accessTokenMinutes: int('ACCESS_TOKEN_MINUTES', 15),
    refreshTokenDays: int('REFRESH_TOKEN_DAYS', 30),
    resetTokenMinutes: int('RESET_TOKEN_MINUTES', 30),
    emailVerificationRequired: text('EMAIL_VERIFICATION_REQUIRED', 'false').toLowerCase() === 'true',
    allowedOrigins: text('ALLOWED_ORIGINS', 'http://localhost:3000').split(',').map(o => o.trim()).filter(Boolean),
    maxUploadBytes: int('MAX_UPLOAD_BYTES', 10_485_760),
    storageDriver: text('STORAGE_DRIVER', 'local'),
    privateStoragePath: text('PRIVATE_STORAGE_PATH', './private-uploads'),
    supabaseUrl: text('SUPABASE_URL'),
    supabaseServiceRoleKey: text('SUPABASE_SERVICE_ROLE_KEY'),
    supabaseStorageBucket: text('SUPABASE_STORAGE_BUCKET', 'private-documents'),
    geofenceRadiusMeters: int('GEOFENCE_RADIUS_METERS', 150),
    maxLocationAccuracyMeters: int('MAX_LOCATION_ACCURACY_METERS', 50),
    maxLocationAgeSeconds: int('MAX_LOCATION_AGE_SECONDS', 120),
    checkInEarlyMinutes: int('CHECK_IN_EARLY_MINUTES', 30),
    checkInLateMinutes: int('CHECK_IN_LATE_MINUTES', 120),
    smtpHost: text('SMTP_HOST'),
    smtpPort: int('SMTP_PORT', 587),
    smtpUser: text('SMTP_USER'),
    smtpPassword: text('SMTP_PASSWORD'),
    emailFrom: text('EMAIL_FROM'),
    passwordResetUrl: text('PASSWORD_RESET_URL'),
    port: int('PORT', 8000),
    trustProxyHops: int('TRUST_PROXY_HOPS', 1),
  };
  if (!s.databaseUrl) throw new Error('DATABASE_URL is required');
  if (s.jwtSecret.length < 48 || s.jwtSecret.includes('REPLACE')) {
    throw new Error('JWT_SECRET must be a random secret of at least 48 characters');
  }
  if (!['local', 'supabase'].includes(s.storageDriver)) throw new Error('STORAGE_DRIVER must be local or supabase');
  if (s.storageDriver === 'supabase' && (!s.supabaseUrl.startsWith('https://') || !s.supabaseServiceRoleKey)) {
    throw new Error('STORAGE_DRIVER=supabase requires an https SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  }
  // Hosted servers have no private, backed-up disk; documents must go to the private bucket (Decision 31).
  if (s.appEnv !== 'development' && s.storageDriver !== 'supabase') {
    throw new Error('Staging and production require STORAGE_DRIVER=supabase');
  }
  if (s.appEnv === 'production' && (!s.smtpHost || !s.passwordResetUrl.startsWith('https://'))) {
    throw new Error('Production requires password-reset email and HTTPS reset URL');
  }
  return s;
}

let cached: Settings | undefined;
export function settings(): Settings {
  cached ??= load();
  return cached;
}
