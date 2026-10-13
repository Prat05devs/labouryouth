import {randomUUID} from 'node:crypto';
import express from 'express';
import nodemailer from 'nodemailer';
import {settings} from '../config.ts';
import type {Row, Tx} from '../db.ts';
import {require} from '../errors.ts';
import {audit} from '../events.ts';
import {route} from '../http.ts';
import {publicRow} from '../repository.ts';
import {DeleteInput, EmailInput, Login, Preferences, Refresh, Register, Reset, RoleInput} from '../schemas.ts';
import {DUMMY_HASH, digest, hashPassword, issue, normalizeEmail, normalizePhone, passwordOk, refresh, roles, throttle, token} from '../security.ts';

export const router = express.Router();

const WORKER_ENGAGEMENT = ['HOURLY', 'DAILY', 'FIXED_TERM', 'MONTHLY'];

export async function me(tx: Tx, user: Row) {
  const client = await tx.one('SELECT * FROM client_profiles WHERE user_id = $1', [user.id]);
  const worker = await tx.one('SELECT * FROM worker_profiles WHERE user_id = $1', [user.id]);
  return {
    ...publicRow(user),
    roles: await roles(tx, user.id),
    client_profile: client ? publicRow(client) : null,
    worker_profile: worker ? publicRow(worker) : null,
  };
}

route(router, 'post', '/auth/register', {status: 201, body: Register}, async ({tx, ip}, data) => {
  await throttle(tx, 'register:' + ip, 5);
  const email = normalizeEmail(data.email);
  const phone = normalizePhone(data.phone_number);
  require(!(await tx.one('SELECT id FROM users WHERE email = $1', [email])), 'EMAIL_ALREADY_REGISTERED', 409);
  require(!(await tx.one('SELECT id FROM users WHERE phone_number = $1', [phone])), 'PHONE_ALREADY_REGISTERED', 409);
  const user = await tx.one(
    `INSERT INTO users (id, full_name, email, phone_number, password_hash, status, preferences)
     VALUES ($1, $2, $3, $4, $5, 'ACTIVE', '{}') RETURNING *`,
    [randomUUID(), data.full_name, email, phone, await hashPassword(data.password)],
  );
  return {...(await issue(tx, user!)), user: await me(tx, user!)};
});

route(router, 'post', '/auth/login', {body: Login}, async ({tx, ip}, data) => {
  const email = normalizeEmail(data.email);
  await throttle(tx, 'login:' + email, 10);
  await throttle(tx, 'login-ip:' + ip, 30);
  const user = await tx.one('SELECT * FROM users WHERE email = $1', [email]);
  // Always verify a hash so response time does not reveal whether the email exists.
  const valid = await passwordOk(data.password, user ? user.password_hash : DUMMY_HASH);
  require(user && valid && user.status === 'ACTIVE', 'INVALID_CREDENTIALS', 401);
  require(!settings().emailVerificationRequired || user.email_verified_at, 'EMAIL_NOT_VERIFIED', 403);
  return {...(await issue(tx, user)), user: await me(tx, user)};
});

route(router, 'post', '/auth/refresh', {body: Refresh}, async ({tx}, data) => refresh(tx, data.refresh_token));

route(router, 'post', '/auth/logout', {status: 204, auth: true}, async ({tx, sessionId}) => {
  await tx.query(
    'UPDATE sessions SET revoked_at = now() WHERE family_id = (SELECT family_id FROM sessions WHERE id = $1)',
    [sessionId],
  );
});

route(router, 'get', '/me', {auth: true}, async ({tx, user}) => me(tx, user));

route(router, 'post', '/me/roles', {body: RoleInput, auth: true}, async ({tx, user}, data) => {
  await tx.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [user.id]);
  if (!(await roles(tx, user.id)).includes(data.role)) {
    await tx.query('INSERT INTO user_roles (id, user_id, role) VALUES ($1, $2, $3)', [randomUUID(), user.id, data.role]);
    if (data.role === 'CLIENT') {
      await tx.query(
        `INSERT INTO client_profiles (id, user_id, client_type, onboarding_complete) VALUES ($1, $2, 'INDIVIDUAL', false)`,
        [randomUUID(), user.id],
      );
    } else {
      await tx.query(
        `INSERT INTO worker_profiles (id, user_id, onboarding_status, worker_status, experience_years, engagement_types)
         VALUES ($1, $2, 'NOT_STARTED', 'PENDING_VERIFICATION', 0, $3)`,
        [randomUUID(), user.id, JSON.stringify(WORKER_ENGAGEMENT)],
      );
    }
  }
  return me(tx, user);
});

route(router, 'put', '/me/preferences', {body: Preferences, auth: true}, async ({tx, user}, data) => {
  require((await roles(tx, user.id)).includes(data.last_active_mode), 'FORBIDDEN', 403);
  const updated = await tx.one('UPDATE users SET preferences = $2 WHERE id = $1 RETURNING *', [user.id, data]);
  return publicRow(updated!);
});

route(router, 'post', '/me/deletion-request', {status: 202, body: DeleteInput, auth: true}, async ({tx, user, requestId}, data) => {
  require(await passwordOk(data.password, user.password_hash), 'INVALID_CREDENTIALS', 401);
  await tx.query(`UPDATE users SET status = 'DELETION_REQUESTED' WHERE id = $1`, [user.id]);
  await tx.query(`INSERT INTO account_deletion_requests (id, user_id, status) VALUES ($1, $2, 'REQUESTED')`, [randomUUID(), user.id]);
  await tx.query('UPDATE sessions SET revoked_at = now() WHERE user_id = $1', [user.id]);
  await audit(tx, user, 'account.deletion_requested', user.id, requestId);
  return {status: 'REQUESTED'};
});

async function sendReset(recipient: string, raw: string) {
  const cfg = settings();
  const transport = nodemailer.createTransport({
    host: cfg.smtpHost,
    port: cfg.smtpPort,
    requireTLS: true,
    connectionTimeout: 15_000,
    auth: cfg.smtpUser ? {user: cfg.smtpUser, pass: cfg.smtpPassword} : undefined,
  });
  await transport.sendMail({
    from: cfg.emailFrom,
    to: recipient,
    subject: 'Reset your Labour Youth password',
    text: `Reset your password: ${cfg.passwordResetUrl}?token=${raw}\nThis link expires in ${cfg.resetTokenMinutes} minutes.`,
  });
}

route(router, 'post', '/auth/forgot-password', {status: 202, body: EmailInput}, async ({tx, ip}, data) => {
  const email = normalizeEmail(data.email);
  await throttle(tx, 'reset:' + email, 3);
  await throttle(tx, 'reset-ip:' + ip, 10);
  const cfg = settings();
  require(cfg.smtpHost && cfg.emailFrom && cfg.passwordResetUrl, 'EMAIL_UNAVAILABLE', 503);
  const user = await tx.one(`SELECT id FROM users WHERE email = $1 AND status = 'ACTIVE'`, [email]);
  if (user) {
    const raw = token();
    await tx.query(
      `INSERT INTO password_resets (id, user_id, token_hash, expires_at) VALUES ($1, $2, $3, now() + make_interval(mins => $4))`,
      [randomUUID(), user.id, digest(raw), cfg.resetTokenMinutes],
    );
    await tx.commit();
    // The answer is the same whether or not delivery works, so it never reveals which emails have accounts.
    await sendReset(email, raw).catch(() => {});
  }
  return {status: 'IF_ACCOUNT_EXISTS_EMAIL_SENT'};
});

route(router, 'post', '/auth/reset-password', {status: 204, body: Reset}, async ({tx}, data) => {
  const reset = await tx.one('SELECT * FROM password_resets WHERE token_hash = $1 FOR UPDATE', [digest(data.token)]);
  require(reset && !reset.consumed_at && reset.expires_at > new Date(), 'RESET_TOKEN_INVALID', 400);
  const user = await tx.one('SELECT * FROM users WHERE id = $1', [reset.user_id]);
  require(user?.status === 'ACTIVE', 'RESET_TOKEN_INVALID', 400);
  await tx.query('UPDATE password_resets SET consumed_at = now() WHERE id = $1', [reset.id]);
  await tx.query('UPDATE users SET password_hash = $2 WHERE id = $1', [user.id, await hashPassword(data.password)]);
  await tx.query('UPDATE sessions SET revoked_at = now() WHERE user_id = $1', [user.id]);
});
