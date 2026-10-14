import { exec, query, queryOne } from '../db/pool.js';
import { orderBy } from '../utils/pagination.js';

const BASE = `SELECT b.*, s.name AS service_name, s.category_id, c.name AS category_name,
  cu.full_name AS customer_name, cu.phone AS customer_phone, cu.email AS customer_email,
  tu.full_name AS technician_name, tu.phone AS technician_phone, tp.specialization AS technician_specialization, tp.user_id AS technician_user_id,
  (SELECT q.total_amount FROM quotations q WHERE q.booking_id = b.id AND q.is_current = 1) AS current_quote_total,
  (SELECT q.status FROM quotations q WHERE q.booking_id = b.id AND q.is_current = 1) AS current_quote_status,
  (SELECT r.id FROM reviews r WHERE r.booking_id = b.id) AS review_id
  FROM bookings b
  JOIN services s ON s.id = b.service_id
  JOIN service_categories c ON c.id = s.category_id
  JOIN users cu ON cu.id = b.customer_id
  LEFT JOIN technician_profiles tp ON tp.id = b.technician_id
  LEFT JOIN users tu ON tu.id = tp.user_id`;

export const getById = (db, id) => queryOne(db, `${BASE} WHERE b.id = ?`, [id]);
export const lockById = (db, id) => queryOne(db, 'SELECT * FROM bookings WHERE id = ? FOR UPDATE', [id]);

export async function insert(db, d) {
  const r = await exec(db, `INSERT INTO bookings (reference, customer_id, service_id, address_id, address_snapshot, problem_description, preferred_date, preferred_time, latitude, longitude)
    VALUES (?,?,?,?,?,?,?,?,?,?)`, [d.reference, d.customerId, d.serviceId, d.addressId, JSON.stringify(d.addressSnapshot), d.problemDescription, d.preferredDate, d.preferredTime, d.latitude ?? null, d.longitude ?? null]);
  return r.insertId;
}
export const addHistory = (db, bookingId, from, to, actor, note = null) => exec(db,
  'INSERT INTO booking_status_history (booking_id, from_status, to_status, actor_id, actor_role, note) VALUES (?,?,?,?,?,?)',
  [bookingId, from, to, actor?.id ?? null, actor?.role ?? null, note ? String(note).slice(0, 500) : null]);
export const history = (db, bookingId) => query(db,
  `SELECT h.id, h.from_status, h.to_status, h.actor_role, h.note, h.created_at, u.full_name AS actor_name
   FROM booking_status_history h LEFT JOIN users u ON u.id = h.actor_id WHERE h.booking_id = ? ORDER BY h.id`, [bookingId]);
export const setStatus = (db, id, status) => exec(db, 'UPDATE bookings SET status = ? WHERE id = ?', [status, id]);

/** Atomic claim: succeeds for exactly one caller even under concurrency. */
export const claim = (db, bookingId, techProfileId) => exec(db,
  "UPDATE bookings SET technician_id = ?, status = 'ASSIGNED', assigned_at = UTC_TIMESTAMP() WHERE id = ? AND status = 'PENDING' AND technician_id IS NULL", [techProfileId, bookingId]);
export const cancel = (db, id, actorId, reason) => exec(db,
  "UPDATE bookings SET status='CANCELLED', cancelled_at = UTC_TIMESTAMP(), cancelled_by = ?, cancel_reason = ? WHERE id = ?", [actorId, reason ?? null, id]);
export const complete = (db, id, notes) => exec(db,
  "UPDATE bookings SET status='COMPLETED', completed_at = UTC_TIMESTAMP(), completion_notes = ? WHERE id = ?", [notes ?? null, id]);

export const getInspection = (db, bookingId) => queryOne(db, 'SELECT * FROM inspections WHERE booking_id = ?', [bookingId]);
export async function upsertInspection(db, bookingId, techId, d) {
  await exec(db, `INSERT INTO inspections (booking_id, technician_id, diagnosis, observed_condition, labour_notes, required_parts, additional_work, notes)
    VALUES (?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE diagnosis=VALUES(diagnosis), observed_condition=VALUES(observed_condition), labour_notes=VALUES(labour_notes),
    required_parts=VALUES(required_parts), additional_work=VALUES(additional_work), notes=VALUES(notes)`,
    [bookingId, techId, d.diagnosis, d.observedCondition, d.labourNotes ?? null, d.requiredParts ?? null, d.additionalWork ?? null, d.notes ?? null]);
}

export async function list(db, { customerId, technicianId, status, statuses, q, serviceId, from, to, paymentStatus, sortBy, sortDir, limit, offset }) {
  const where = [], params = [];
  if (customerId) { where.push('b.customer_id = ?'); params.push(customerId); }
  if (technicianId) { where.push('b.technician_id = ?'); params.push(technicianId); }
  if (status) { where.push('b.status = ?'); params.push(status); }
  if (statuses?.length) { where.push('b.status IN (?)'); params.push(statuses); }
  if (paymentStatus) { where.push('b.payment_status = ?'); params.push(paymentStatus); }
  if (serviceId) { where.push('b.service_id = ?'); params.push(serviceId); }
  if (from) { where.push('DATE(b.created_at) >= ?'); params.push(from); }
  if (to) { where.push('DATE(b.created_at) <= ?'); params.push(to); }
  if (q) { where.push('(b.reference LIKE ? OR s.name LIKE ? OR cu.full_name LIKE ?)'); params.push(`%${q}%`, `%${q}%`, `%${q}%`); }
  const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const total = (await queryOne(db, `SELECT COUNT(*) c FROM bookings b JOIN services s ON s.id=b.service_id JOIN users cu ON cu.id=b.customer_id ${w}`, params)).c;
  const ob = orderBy({ created: 'b.created_at', date: 'b.preferred_date', status: 'b.status', reference: 'b.reference' }, sortBy, sortDir, 'created');
  const rows = await query(db, `${BASE} ${w} ORDER BY ${ob}, b.id DESC LIMIT ? OFFSET ?`, [...params, limit, offset]);
  return { rows, total };
}

/** PENDING, unassigned jobs for services this technician offers. */
export async function available(db, techProfileId, { limit, offset }) {
  const sql = `FROM bookings b JOIN technician_services ts ON ts.service_id = b.service_id AND ts.technician_id = ?
    WHERE b.status = 'PENDING' AND b.technician_id IS NULL`;
  const total = (await queryOne(db, `SELECT COUNT(*) c ${sql}`, [techProfileId])).c;
  const rows = await query(db, `${BASE.replace('FROM bookings b', 'FROM bookings b JOIN technician_services ts ON ts.service_id = b.service_id AND ts.technician_id = ?')}
    WHERE b.status = 'PENDING' AND b.technician_id IS NULL ORDER BY b.preferred_date, b.preferred_time LIMIT ? OFFSET ?`, [techProfileId, limit, offset]);
  return { rows, total };
}
export const eligibleTechnicianUserIds = async (db, serviceId) => (await query(db,
  `SELECT p.user_id FROM technician_profiles p JOIN technician_services ts ON ts.technician_id = p.id AND ts.service_id = ?
   JOIN users u ON u.id = p.user_id WHERE p.approval_status='APPROVED' AND p.is_active=1 AND u.status='ACTIVE'`, [serviceId])).map((r) => r.user_id);
export const technicianOffers = async (db, techId, serviceId) => !!(await queryOne(db, 'SELECT 1 x FROM technician_services WHERE technician_id=? AND service_id=?', [techId, serviceId]));
