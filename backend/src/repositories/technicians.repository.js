import { exec, query, queryOne } from '../db/pool.js';
import { orderBy } from '../utils/pagination.js';

export const findProfileByUser = (db, userId, forUpdate = false) =>
  queryOne(db, `SELECT p.*, u.full_name, u.email, u.phone, u.status AS user_status FROM technician_profiles p JOIN users u ON u.id = p.user_id WHERE p.user_id = ? ${forUpdate ? 'FOR UPDATE' : ''}`, [userId]);
export const findProfileById = (db, id) =>
  queryOne(db, 'SELECT p.*, u.full_name, u.email, u.phone, u.status AS user_status FROM technician_profiles p JOIN users u ON u.id = p.user_id WHERE p.id = ?', [id]);
export const updateProfile = (db, id, d) => exec(db,
  'UPDATE technician_profiles SET specialization = COALESCE(?, specialization), experience_years = COALESCE(?, experience_years), service_area = COALESCE(?, service_area), bio = COALESCE(?, bio) WHERE id = ?',
  [d.specialization ?? null, d.experienceYears ?? null, d.serviceArea ?? null, d.bio ?? null, id]);
export const setApproval = (db, id, status) => exec(db,
  `UPDATE technician_profiles SET approval_status = ?, approved_at = ${status === 'APPROVED' ? 'UTC_TIMESTAMP()' : 'approved_at'} WHERE id = ?`, [status, id]);
export const setActive = (db, id, active) => exec(db, 'UPDATE technician_profiles SET is_active = ? WHERE id = ?', [active ? 1 : 0, id]);
export const listServiceIds = async (db, techId) => (await query(db, 'SELECT service_id FROM technician_services WHERE technician_id = ?', [techId])).map((r) => r.service_id);
export const listServices = (db, techId) => query(db, `SELECT s.id, s.name, s.category_id FROM technician_services ts JOIN services s ON s.id = ts.service_id WHERE ts.technician_id = ? ORDER BY s.name`, [techId]);
export async function replaceServices(db, techId, serviceIds) {
  await exec(db, 'DELETE FROM technician_services WHERE technician_id = ?', [techId]);
  for (const sid of serviceIds) await exec(db, 'INSERT INTO technician_services (technician_id, service_id) VALUES (?,?)', [techId, sid]);
}
export const activeServiceIds = async (db, ids) => ids.length ? (await query(db, 'SELECT id FROM services WHERE is_active = 1 AND id IN (?)', [ids])).map((r) => r.id) : [];

export const listAvailability = (db, techId) => query(db, 'SELECT id, day_of_week, start_time, end_time, is_available FROM technician_availability WHERE technician_id = ? ORDER BY day_of_week, start_time', [techId]);
export async function replaceAvailability(db, techId, slots) {
  await exec(db, 'DELETE FROM technician_availability WHERE technician_id = ?', [techId]);
  for (const s of slots) await exec(db, 'INSERT INTO technician_availability (technician_id, day_of_week, start_time, end_time, is_available) VALUES (?,?,?,?,?)', [techId, s.dayOfWeek, s.startTime, s.endTime, s.isAvailable ? 1 : 0]);
}

export async function adminList(db, { status, q, sortBy, sortDir, limit, offset }) {
  const where = [], params = [];
  if (status) { where.push('p.approval_status = ?'); params.push(status); }
  if (q) { where.push('(u.full_name LIKE ? OR u.email LIKE ? OR p.specialization LIKE ?)'); params.push(`%${q}%`, `%${q}%`, `%${q}%`); }
  const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const total = (await queryOne(db, `SELECT COUNT(*) c FROM technician_profiles p JOIN users u ON u.id = p.user_id ${w}`, params)).c;
  const ob = orderBy({ name: 'u.full_name', created: 'p.created_at', experience: 'p.experience_years' }, sortBy, sortDir, 'created');
  const rows = await query(db, `SELECT p.*, u.full_name, u.email, u.phone, u.status AS user_status,
    (SELECT COUNT(*) FROM bookings b WHERE b.technician_id = p.id AND b.status NOT IN ('COMPLETED','CANCELLED')) AS open_jobs,
    (SELECT COUNT(*) FROM bookings b WHERE b.technician_id = p.id AND b.status = 'COMPLETED') AS completed_jobs,
    (SELECT ROUND(AVG(r.rating),2) FROM reviews r WHERE r.technician_id = p.id AND r.status='VISIBLE') AS avg_rating
    FROM technician_profiles p JOIN users u ON u.id = p.user_id ${w} ORDER BY ${ob} LIMIT ? OFFSET ?`, [...params, limit, offset]);
  return { rows, total };
}
export const earnings = async (db, techId) => ({
  summary: await queryOne(db, `SELECT COUNT(*) AS payment_count, COALESCE(SUM(p.amount),0) AS total_amount
    FROM payments p JOIN bookings b ON b.id = p.booking_id WHERE b.technician_id = ? AND p.status = 'SUCCESS'`, [techId]),
  rows: await query(db, `SELECT p.id, p.amount, p.currency, p.transaction_reference, p.created_at, p.is_simulated, b.id AS booking_id, b.reference AS booking_reference, s.name AS service_name
    FROM payments p JOIN bookings b ON b.id = p.booking_id JOIN services s ON s.id = b.service_id
    WHERE b.technician_id = ? AND p.status = 'SUCCESS' ORDER BY p.created_at DESC LIMIT 200`, [techId]),
});
