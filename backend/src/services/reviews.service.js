import { pool, withTransaction, query, queryOne, exec } from '../db/pool.js';
import { AppError } from '../utils/AppError.js';
import { paging, pageMeta } from '../utils/pagination.js';
import { notify } from './notification.service.js';
import { audit } from './audit.service.js';

const SEL = `SELECT r.*, cu.full_name AS customer_name, s.name AS service_name, b.reference AS booking_reference, tu.full_name AS technician_name
  FROM reviews r JOIN users cu ON cu.id = r.customer_id JOIN services s ON s.id = r.service_id JOIN bookings b ON b.id = r.booking_id
  JOIN technician_profiles tp ON tp.id = r.technician_id JOIN users tu ON tu.id = tp.user_id`;
const firstName = (n) => String(n).split(' ')[0];
const map = (r, { full = false } = {}) => ({
  id: r.id, bookingId: r.booking_id, rating: r.rating, comment: r.comment, status: r.status, createdAt: r.created_at, serviceName: r.service_name,
  reviewer: full ? r.customer_name : firstName(r.customer_name), ...(full ? { bookingReference: r.booking_reference, technicianName: r.technician_name, moderationNote: r.moderation_note } : {}),
});

export async function create(user, { bookingId, rating, comment }) {
  const id = await withTransaction(async (conn) => {
    const b = await queryOne(conn, 'SELECT * FROM bookings WHERE id = ? FOR UPDATE', [bookingId]);
    if (!b || b.customer_id !== user.id) throw AppError.notFound('Booking not found');
    if (b.status !== 'COMPLETED' || !b.technician_id) throw AppError.conflict('Only completed bookings can be reviewed', 'NOT_REVIEWABLE');
    if (await queryOne(conn, 'SELECT id FROM reviews WHERE booking_id = ?', [bookingId])) throw AppError.conflict('You have already reviewed this booking', 'DUPLICATE_REVIEW');
    const r = await exec(conn, 'INSERT INTO reviews (booking_id, customer_id, technician_id, service_id, rating, comment) VALUES (?,?,?,?,?,?)', [bookingId, user.id, b.technician_id, b.service_id, rating, comment ?? null]);
    const t = await queryOne(conn, 'SELECT user_id FROM technician_profiles WHERE id = ?', [b.technician_id]);
    await notify(conn, { userId: t.user_id, type: 'REVIEW_RECEIVED', title: 'New customer review', message: `You received a ${rating}-star review for ${b.reference}.`, resourceType: 'review', resourceId: r.insertId });
    return r.insertId;
  }).catch((e) => { if (e.code === 'ER_DUP_ENTRY') throw AppError.conflict('You have already reviewed this booking', 'DUPLICATE_REVIEW'); throw e; });
  return map(await queryOne(pool, `${SEL} WHERE r.id = ?`, [id]), { full: true });
}
export async function publicList({ serviceId, technicianId, page, pageSize }) {
  const where = ["r.status = 'VISIBLE'"], params = [];
  if (serviceId) { where.push('r.service_id = ?'); params.push(serviceId); }
  if (technicianId) { where.push('r.technician_id = ?'); params.push(technicianId); }
  const w = `WHERE ${where.join(' AND ')}`;
  const total = (await queryOne(pool, `SELECT COUNT(*) c FROM reviews r ${w}`, params)).c;
  const { limit, offset } = paging({ page, pageSize });
  const rows = await query(pool, `${SEL} ${w} ORDER BY r.created_at DESC LIMIT ? OFFSET ?`, [...params, limit, offset]);
  return { rows: rows.map((r) => map(r)), meta: pageMeta({ page, pageSize }, total) };
}
export async function mine(user, { page, pageSize }) {
  const col = user.role === 'CUSTOMER' ? 'r.customer_id = ?' : 'tp.user_id = ?';
  const { limit, offset } = paging({ page, pageSize });
  const total = (await queryOne(pool, `SELECT COUNT(*) c FROM reviews r JOIN technician_profiles tp ON tp.id = r.technician_id WHERE ${col}`, [user.id])).c;
  const rows = await query(pool, `${SEL} WHERE ${col} ${user.role === 'TECHNICIAN' ? "AND r.status = 'VISIBLE'" : ''} ORDER BY r.created_at DESC LIMIT ? OFFSET ?`, [user.id, limit, offset]);
  return { rows: rows.map((r) => map(r, { full: true })), meta: pageMeta({ page, pageSize }, total) };
}
export async function adminList({ status, q, page, pageSize }) {
  const where = [], params = [];
  if (status) { where.push('r.status = ?'); params.push(status); }
  if (q) { where.push('(r.comment LIKE ? OR cu.full_name LIKE ? OR s.name LIKE ?)'); params.push(`%${q}%`, `%${q}%`, `%${q}%`); }
  const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const total = (await queryOne(pool, `SELECT COUNT(*) c FROM reviews r JOIN users cu ON cu.id = r.customer_id JOIN services s ON s.id = r.service_id ${w}`, params)).c;
  const { limit, offset } = paging({ page, pageSize });
  const rows = await query(pool, `${SEL} ${w} ORDER BY r.created_at DESC LIMIT ? OFFSET ?`, [...params, limit, offset]);
  return { rows: rows.map((r) => map(r, { full: true })), meta: pageMeta({ page, pageSize }, total) };
}
export async function moderate(actor, id, { status, note }, ip) {
  const r = await exec(pool, 'UPDATE reviews SET status = ?, moderation_note = ?, moderated_by = ? WHERE id = ?', [status, note ?? null, actor.id, id]);
  if (!r.affectedRows) throw AppError.notFound('Review not found');
  await audit(pool, actor, `REVIEW_${status}`, 'review', id, { note }, ip);
  return map(await queryOne(pool, `${SEL} WHERE r.id = ?`, [id]), { full: true });
}
