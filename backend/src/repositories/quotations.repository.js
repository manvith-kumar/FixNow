import { exec, query, queryOne } from '../db/pool.js';
import { orderBy } from '../utils/pagination.js';

export const currentForBooking = (db, bookingId, forUpdate = false) =>
  queryOne(db, `SELECT * FROM quotations WHERE booking_id = ? AND is_current = 1 ${forUpdate ? 'FOR UPDATE' : ''}`, [bookingId]);
export const getById = (db, id, forUpdate = false) => queryOne(db, `SELECT * FROM quotations WHERE id = ? ${forUpdate ? 'FOR UPDATE' : ''}`, [id]);
export const listForBooking = (db, bookingId) => query(db, 'SELECT * FROM quotations WHERE booking_id = ? ORDER BY version_number DESC', [bookingId]);
export const items = (db, quotationId) => query(db, 'SELECT * FROM quotation_items WHERE quotation_id = ? ORDER BY sort_order, id', [quotationId]);
// MAX()/COALESCE may be returned as a string by the driver: always coerce to a number before arithmetic.
export const maxVersion = async (db, bookingId) => Number((await queryOne(db, 'SELECT COALESCE(MAX(version_number),0) AS v FROM quotations WHERE booking_id = ?', [bookingId])).v);

/** Retire the current version without deleting it. PENDING/APPROVED become SUPERSEDED; REJECTED stays REJECTED. */
export const retireCurrent = (db, bookingId) => exec(db,
  "UPDATE quotations SET is_current = 0, status = CASE WHEN status IN ('PENDING','APPROVED') THEN 'SUPERSEDED' ELSE status END WHERE booking_id = ? AND is_current = 1", [bookingId]);
export const withdrawPending = (db, bookingId) => exec(db, "UPDATE quotations SET status = 'WITHDRAWN' WHERE booking_id = ? AND is_current = 1 AND status = 'PENDING'", [bookingId]);

export async function insert(db, d) {
  const r = await exec(db, `INSERT INTO quotations (booking_id, version_number, status, is_current, subtotal, discount_amount, tax_rate, tax_amount, total_amount, notes, revision_notes, valid_until, created_by)
    VALUES (?,?,'PENDING',1,?,?,?,?,?,?,?,?,?)`, [d.bookingId, d.version, d.calc.subtotal, d.calc.discountAmount, d.calc.taxRate, d.calc.taxAmount, d.calc.totalAmount, d.notes ?? null, d.revisionNotes ?? null, d.validUntil, d.createdBy]);
  let i = 0;
  for (const it of d.calc.items) {
    await exec(db, 'INSERT INTO quotation_items (quotation_id, item_type, description, quantity, unit_price, line_total, sort_order) VALUES (?,?,?,?,?,?,?)',
      [r.insertId, it.itemType, it.description, it.quantity, it.unitPrice, it.lineTotal, i++]);
  }
  return r.insertId;
}
export const decide = (db, id, status, userId, reason) => exec(db, 'UPDATE quotations SET status = ?, decided_by = ?, decided_at = UTC_TIMESTAMP(), decision_reason = ? WHERE id = ?', [status, userId, reason ?? null, id]);

export async function mapWithItems(db, q) {
  const its = await items(db, q.id);
  return mapQuotation(q, its);
}
export const mapQuotation = (q, its) => ({
  id: q.id, bookingId: q.booking_id, versionNumber: q.version_number, status: q.status, isCurrent: !!q.is_current,
  subtotal: q.subtotal, discountAmount: q.discount_amount, taxRate: q.tax_rate, taxAmount: q.tax_amount, totalAmount: q.total_amount,
  notes: q.notes, revisionNotes: q.revision_notes, validUntil: q.valid_until, createdAt: q.created_at, decidedAt: q.decided_at, decisionReason: q.decision_reason,
  bookingReference: q.booking_reference, serviceName: q.service_name, customerName: q.customer_name, technicianName: q.technician_name,
  ...(its ? { items: its.map((i) => ({ id: i.id, itemType: i.item_type, description: i.description, quantity: i.quantity, unitPrice: i.unit_price, lineTotal: i.line_total })) } : {}),
});

export async function adminList(db, { status, q, currentOnly, sortBy, sortDir, limit, offset }) {
  const where = [], params = [];
  if (status) { where.push('qt.status = ?'); params.push(status); }
  if (currentOnly) where.push('qt.is_current = 1');
  if (q) { where.push('(b.reference LIKE ? OR s.name LIKE ?)'); params.push(`%${q}%`, `%${q}%`); }
  const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const from = `FROM quotations qt JOIN bookings b ON b.id = qt.booking_id JOIN services s ON s.id = b.service_id JOIN users cu ON cu.id = b.customer_id
    LEFT JOIN technician_profiles tp ON tp.id = b.technician_id LEFT JOIN users tu ON tu.id = tp.user_id`;
  const total = (await queryOne(db, `SELECT COUNT(*) c ${from} ${w}`, params)).c;
  const ob = orderBy({ created: 'qt.created_at', total: 'qt.total_amount', status: 'qt.status' }, sortBy, sortDir, 'created');
  const rows = await query(db, `SELECT qt.*, b.reference AS booking_reference, s.name AS service_name, cu.full_name AS customer_name, tu.full_name AS technician_name
    ${from} ${w} ORDER BY ${ob}, qt.id DESC LIMIT ? OFFSET ?`, [...params, limit, offset]);
  return { rows, total };
}
