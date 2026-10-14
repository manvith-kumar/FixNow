import { exec, query, queryOne } from '../db/pool.js';
import { orderBy } from '../utils/pagination.js';

export const lock = (db, id) => queryOne(db, 'SELECT * FROM technician_applications WHERE id = ? FOR UPDATE', [id]);
export const get = (db, id) => queryOne(db, `SELECT a.*, u.email, r.full_name AS reviewer_name FROM technician_applications a JOIN users u ON u.id = a.user_id LEFT JOIN users r ON r.id = a.reviewer_id WHERE a.id = ?`, [id]);
export const latestByUser = (db, userId) => queryOne(db, 'SELECT * FROM technician_applications WHERE user_id = ? ORDER BY id DESC LIMIT 1', [userId]);
export const historyByUser = (db, userId) => query(db, 'SELECT id, status, submitted_at, reviewed_at, review_notes FROM technician_applications WHERE user_id = ? ORDER BY id DESC', [userId]);
export const hasOpen = async (db, userId) => !!(await queryOne(db, "SELECT id FROM technician_applications WHERE user_id = ? AND status IN ('SUBMITTED','NEEDS_INFO') FOR UPDATE", [userId]));
export async function insert(db, userId, d) {
  const r = await exec(db, `INSERT INTO technician_applications (user_id, full_name, phone, specialization, experience_years, service_area, bio, service_ids)
    VALUES (?,?,?,?,?,?,?,?)`, [userId, d.fullName, d.phone, d.specialization, d.experienceYears, d.serviceArea, d.bio ?? null, JSON.stringify(d.serviceIds ?? [])]);
  return r.insertId;
}
export const setStatus = (db, id, status, reviewerId = null, notes = null) => exec(db,
  `UPDATE technician_applications SET status = ?, reviewer_id = ?, review_notes = ?, reviewed_at = ${reviewerId ? 'UTC_TIMESTAMP()' : 'reviewed_at'} WHERE id = ?`, [status, reviewerId, notes, id]);
export const resubmit = (db, id) => exec(db, "UPDATE technician_applications SET status = 'SUBMITTED' WHERE id = ?", [id]);
export const insertDocument = (db, appId, userId, type, m) => exec(db,
  'INSERT INTO technician_documents (application_id, user_id, doc_type, original_name, stored_name, mime_type, size_bytes) VALUES (?,?,?,?,?,?,?)',
  [appId, userId, type, m.originalName, m.storedName, m.mimeType, m.sizeBytes]);
export const documents = (db, appId) => query(db, 'SELECT id, doc_type, original_name, mime_type, size_bytes, uploaded_at FROM technician_documents WHERE application_id = ? ORDER BY id', [appId]);
export const documentFile = (db, appId, docId) => queryOne(db, 'SELECT * FROM technician_documents WHERE id = ? AND application_id = ?', [docId, appId]);
export const documentCount = async (db, appId) => (await queryOne(db, 'SELECT COUNT(*) c FROM technician_documents WHERE application_id = ?', [appId])).c;

export async function adminList(db, { status, q, sortBy, sortDir, limit, offset }) {
  const where = [], params = [];
  if (status) { where.push('a.status = ?'); params.push(status); }
  if (q) { where.push('(a.full_name LIKE ? OR u.email LIKE ? OR a.specialization LIKE ?)'); params.push(`%${q}%`, `%${q}%`, `%${q}%`); }
  const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const total = (await queryOne(db, `SELECT COUNT(*) c FROM technician_applications a JOIN users u ON u.id = a.user_id ${w}`, params)).c;
  const ob = orderBy({ submitted: 'a.submitted_at', name: 'a.full_name', status: 'a.status' }, sortBy, sortDir, 'submitted');
  const rows = await query(db, `SELECT a.*, u.email FROM technician_applications a JOIN users u ON u.id = a.user_id ${w} ORDER BY ${ob} LIMIT ? OFFSET ?`, [...params, limit, offset]);
  return { rows, total };
}
