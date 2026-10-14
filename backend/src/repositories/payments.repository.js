import { exec, query, queryOne } from '../db/pool.js';
import { orderBy } from '../utils/pagination.js';

const SEL = `SELECT p.*, b.reference AS booking_reference, s.name AS service_name, cu.full_name AS customer_name, tu.full_name AS technician_name, tp.user_id AS technician_user_id
  FROM payments p JOIN bookings b ON b.id = p.booking_id JOIN services s ON s.id = b.service_id JOIN users cu ON cu.id = p.customer_id
  LEFT JOIN technician_profiles tp ON tp.id = b.technician_id LEFT JOIN users tu ON tu.id = tp.user_id`;
export const getById = (db, id) => queryOne(db, `${SEL} WHERE p.id = ?`, [id]);
export async function insert(db, d) {
  const r = await exec(db, `INSERT INTO payments (booking_id, quotation_id, customer_id, amount, currency, method, status, transaction_reference, provider, is_simulated, failure_reason)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)`, [d.bookingId, d.quotationId, d.customerId, d.amount, d.currency, d.method, d.status, d.reference, d.provider, d.isSimulated ? 1 : 0, d.failureReason ?? null]);
  return r.insertId;
}
export const markBookingPaid = (db, bookingId) => exec(db, "UPDATE bookings SET payment_status = 'PAID' WHERE id = ?", [bookingId]);
export async function list(db, { customerId, technicianUserId, status, q, from, to, sortBy, sortDir, limit, offset }) {
  const where = [], params = [];
  if (customerId) { where.push('p.customer_id = ?'); params.push(customerId); }
  if (technicianUserId) { where.push('tp.user_id = ?'); params.push(technicianUserId); }
  if (status) { where.push('p.status = ?'); params.push(status); }
  if (from) { where.push('DATE(p.created_at) >= ?'); params.push(from); }
  if (to) { where.push('DATE(p.created_at) <= ?'); params.push(to); }
  if (q) { where.push('(p.transaction_reference LIKE ? OR b.reference LIKE ?)'); params.push(`%${q}%`, `%${q}%`); }
  const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const total = (await queryOne(db, `SELECT COUNT(*) c FROM payments p JOIN bookings b ON b.id = p.booking_id LEFT JOIN technician_profiles tp ON tp.id = b.technician_id ${w}`, params)).c;
  const ob = orderBy({ created: 'p.created_at', amount: 'p.amount' }, sortBy, sortDir, 'created');
  const rows = await query(db, `${SEL} ${w} ORDER BY ${ob}, p.id DESC LIMIT ? OFFSET ?`, [...params, limit, offset]);
  return { rows, total };
}
