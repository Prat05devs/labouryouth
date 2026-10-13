import {randomUUID} from 'node:crypto';
import {createInterface} from 'node:readline/promises';
import pg from 'pg';
import {poolConfig, transaction} from './db.ts';
import {hashPassword, normalizeEmail, normalizePhone} from './security.ts';

// Port of apps/api/app/bootstrap_admin.py. Admins cannot sign up through the app; this creates the first one.
// The password is read without echo and is never printed or logged.

function hidden(prompt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const input = process.stdin;
    if (!input.isTTY) return reject(new Error('Run this in an interactive terminal'));
    process.stdout.write(prompt);
    input.setRawMode(true);
    input.resume();
    let value = '';
    const onData = (chunk: Buffer) => {
      for (const ch of chunk.toString('utf8')) {
        if (ch === '\r' || ch === '\n') {
          input.setRawMode(false);
          input.pause();
          input.off('data', onData);
          process.stdout.write('\n');
          return resolve(value);
        }
        if (ch === '\u0003') {
          input.setRawMode(false);
          return reject(new Error('Cancelled'));
        }
        value = ch === '\u007f' ? value.slice(0, -1) : value + ch;
      }
    };
    input.on('data', onData);
  });
}

const rl = createInterface({input: process.stdin, output: process.stdout});
const email = normalizeEmail(await rl.question('Admin email: '));
const phone = normalizePhone(await rl.question('Admin mobile: '));
const name = (await rl.question('Admin full name: ')).trim();
rl.close();
const password = await hidden('New password (12+ characters): ');
if (password.length < 12 || name.length < 2) throw new Error('Invalid name or password');
const pool = new pg.Pool(poolConfig());
try {
  await transaction(pool, async tx => {
    if (await tx.one('SELECT id FROM users WHERE email = $1 OR phone_number = $2', [email, phone])) {
      throw new Error('User exists; role grants need operator review');
    }
    const id = randomUUID();
    await tx.query(
      `INSERT INTO users (id, full_name, email, phone_number, password_hash, status, preferences) VALUES ($1, $2, $3, $4, $5, 'ACTIVE', '{}')`,
      [id, name, email, phone, await hashPassword(password)],
    );
    await tx.query(`INSERT INTO user_roles (id, user_id, role) VALUES ($1, $2, 'SUPER_ADMIN')`, [randomUUID(), id]);
  });
  console.log('Admin created. No password was logged.');
} finally {
  await pool.end();
}
