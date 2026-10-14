// Reproducible DEVELOPMENT seed. Idempotent: safe to run repeatedly. Never run against production data.
// Creates: catalogue, 1 admin, 1 customer (+ address), 2 technicians (1 approved, 1 pending application).
// It deliberately does NOT create bookings, payments or reviews, so no fake "customer reviews" ever appear.
import fs from 'node:fs';
import bcrypt from 'bcryptjs';
import { adminConnection, SEEDS_DIR, env } from './_cli.js';
import { slugify } from '../src/utils/ids.js';

if (env.isProduction) { console.error('Refusing to seed in production.'); process.exit(1); }
export const SEED_PASSWORD = 'Password@123';
const conn = await adminConnection(true);
const hash = await bcrypt.hash(SEED_PASSWORD, env.BCRYPT_ROUNDS);

const cat = JSON.parse(fs.readFileSync(`${SEEDS_DIR}/catalogue.json`, 'utf8'));
const serviceIds = [];
for (const c of cat.categories) {
  await conn.query('INSERT INTO service_categories (name, slug, description, icon) VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE description = VALUES(description), icon = VALUES(icon)', [c.name, slugify(c.name), c.description, c.icon]);
  const [[{ id: categoryId }]] = await conn.query('SELECT id FROM service_categories WHERE name = ?', [c.name]);
  for (const s of c.services) {
    await conn.query(`INSERT INTO services (category_id, name, slug, description, indicative_starting_price, is_featured) VALUES (?,?,?,?,?,?)
      ON DUPLICATE KEY UPDATE description = VALUES(description), indicative_starting_price = VALUES(indicative_starting_price), is_featured = VALUES(is_featured)`,
      [categoryId, s.name, slugify(`${s.name}-${categoryId}`), s.description, s.price, s.featured ? 1 : 0]);
    const [[{ id }]] = await conn.query('SELECT id FROM services WHERE category_id = ? AND name = ?', [categoryId, s.name]);
    serviceIds.push({ id, category: c.name });
  }
}

async function user(email, fullName, role, phone) {
  await conn.query('INSERT IGNORE INTO users (email, password_hash, full_name, role, phone) VALUES (?,?,?,?,?)', [email, hash, fullName, role, phone]);
  const [[u]] = await conn.query('SELECT id FROM users WHERE email = ?', [email]);
  return u.id;
}
const adminId = await user('admin@fixnow.test', 'FixNow Admin', 'ADMIN', '+910000000001');
const customerId = await user('customer@fixnow.test', 'Demo Customer', 'CUSTOMER', '+910000000002');
const techId = await user('tech@fixnow.test', 'Demo Technician', 'TECHNICIAN', '+910000000003');
const pendingId = await user('tech.pending@fixnow.test', 'Pending Technician', 'TECHNICIAN', '+910000000004');

const [[hasAddr]] = await conn.query('SELECT COUNT(*) c FROM addresses WHERE user_id = ?', [customerId]);
if (!hasAddr.c) await conn.query("INSERT INTO addresses (user_id, label, line1, city, state, postal_code, country, is_default) VALUES (?, 'Home', '12 Demo Street', 'Guntur', 'Andhra Pradesh', '522001', 'India', 1)", [customerId]);

await conn.query("INSERT IGNORE INTO technician_profiles (user_id, specialization, experience_years, service_area, bio, approval_status, approved_at) VALUES (?, 'Plumbing and Electrical', 6, 'Guntur', 'Demo technician account for development.', 'APPROVED', UTC_TIMESTAMP())", [techId]);
const [[tp]] = await conn.query('SELECT id FROM technician_profiles WHERE user_id = ?', [techId]);
for (const s of serviceIds.filter((s) => ['Plumbing', 'Electrical', 'Appliance Repair'].includes(s.category)))
  await conn.query('INSERT IGNORE INTO technician_services (technician_id, service_id) VALUES (?,?)', [tp.id, s.id]);
const [[hasApp]] = await conn.query('SELECT COUNT(*) c FROM technician_applications WHERE user_id = ?', [techId]);
if (!hasApp.c) await conn.query("INSERT INTO technician_applications (user_id, full_name, phone, specialization, experience_years, service_area, status, reviewer_id, reviewed_at, service_ids) VALUES (?, 'Demo Technician', '+910000000003', 'Plumbing and Electrical', 6, 'Guntur', 'APPROVED', ?, UTC_TIMESTAMP(), JSON_ARRAY())", [techId, adminId]);

await conn.query("INSERT IGNORE INTO technician_profiles (user_id, approval_status) VALUES (?, 'NOT_APPLIED')", [pendingId]);
console.log(`Seed complete. Dev accounts (password: ${SEED_PASSWORD}):
  admin@fixnow.test        ADMIN
  customer@fixnow.test     CUSTOMER
  tech@fixnow.test         TECHNICIAN (approved)
  tech.pending@fixnow.test TECHNICIAN (has not applied yet)`);
await conn.end();
