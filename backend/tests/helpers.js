// Integration test helpers. These tests run against a REAL MySQL-compatible server using a dedicated *_test database.
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

const here = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(here, '..');
dotenv.config({ path: path.join(backendRoot, '.env') }); // DB credentials come from backend/.env; DB_NAME is forced to a *_test database below
process.env.NODE_ENV = 'test';
process.env.DB_NAME = process.env.TEST_DB_NAME || 'fixnow_test';
process.env.JWT_SECRET ||= 'test-secret-test-secret-test-secret-test-secret';
process.env.BCRYPT_ROUNDS = '4';
process.env.DEV_EXPOSE_RESET_TOKEN = 'true';
process.env.UPLOAD_DIR = path.join(backendRoot, 'storage', 'test-uploads');
if (!/_test$/.test(process.env.DB_NAME)) throw new Error('Refusing to reset a database whose name does not end in _test');

export const SEED_PASSWORD = 'Password@123';

export async function resetDatabase() {
  const conn = await mysql.createConnection({ host: process.env.DB_HOST || '127.0.0.1', port: Number(process.env.DB_PORT || 3306), user: process.env.DB_USER, password: process.env.DB_PASSWORD });
  await conn.query(`DROP DATABASE IF EXISTS \`${process.env.DB_NAME}\``);
  await conn.end();
  for (const s of ['create-database.js', 'migrate.js', 'seed.js']) {
    execFileSync(process.execPath, [path.join(backendRoot, 'scripts', s)], { env: process.env, stdio: 'pipe', cwd: backendRoot });
  }
}

export async function bootApp() {
  await resetDatabase();
  const { createApp } = await import('../src/app.js');
  const { pool } = await import('../src/db/pool.js');
  const request = (await import('supertest')).default;
  const app = createApp();
  return { api: request(app), pool, close: () => pool.end() };
}

export const pdf = () => Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF');

export async function login(api, email, password = SEED_PASSWORD) {
  const res = await api.post('/api/auth/login').send({ email, password });
  if (res.status !== 200) throw new Error(`login failed for ${email}: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body.data.token;
}
export const bearer = (t) => ({ Authorization: `Bearer ${t}` });
let n = 0;
export async function register(api, role = 'CUSTOMER', over = {}) {
  const email = over.email ?? `user${Date.now()}${n++}@test.dev`;
  const res = await api.post('/api/auth/register').send({ email, password: 'Secret123', fullName: over.fullName ?? `Test ${role} ${n}`, role });
  if (res.status !== 201) throw new Error(`register failed ${res.status} ${JSON.stringify(res.body)}`);
  return { token: res.body.data.token, user: res.body.data.user, email };
}
export function futureDate(days = 3) { return new Date(Date.now() + days * 864e5).toISOString().slice(0, 10); }

/** Register a technician, submit an application, and have the admin approve it. */
export async function approvedTechnician(api, adminToken, serviceIds) {
  const t = await register(api, 'TECHNICIAN');
  const res = await api.post('/api/technician-applications').set(bearer(t.token))
    .field('fullName', 'Test Technician').field('phone', '+911234567890').field('specialization', 'Plumbing').field('experienceYears', '4')
    .field('serviceArea', 'Guntur').field('serviceIds', JSON.stringify(serviceIds)).field('docTypes', 'ID_DOCUMENT')
    .attach('documents', pdf(), { filename: 'id.pdf', contentType: 'application/pdf' });
  if (res.status !== 201) throw new Error(`application failed ${res.status} ${JSON.stringify(res.body)}`);
  const d = await api.post(`/api/technician-applications/${res.body.data.id}/decision`).set(bearer(adminToken)).send({ decision: 'APPROVE' });
  if (d.status !== 200) throw new Error(`approval failed ${d.status} ${JSON.stringify(d.body)}`);
  return t;
}
