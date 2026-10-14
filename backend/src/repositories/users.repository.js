import { exec, query, queryOne } from '../db/pool.js';
import { orderBy } from '../utils/pagination.js';

const PUBLIC = 'id, email, full_name, phone, role, status, last_login_at, created_at, updated_at';
export const findById = (db, id) => queryOne(db, `SELECT ${PUBLIC} FROM users WHERE id = ?`, [id]);
export const findByEmail = (db, email) => queryOne(db, 'SELECT * FROM users WHERE email = ?', [email]);
export async function create(db, { email, passwordHash, fullName, phone, role }) {
  const r = await exec(db, 'INSERT INTO users (email, password_hash, full_name, phone, role) VALUES (?,?,?,?,?)', [email, passwordHash, fullName, phone ?? null, role]);
  return r.insertId;
}
export const updateProfile = (db, id, { fullName, phone }) =>
  exec(db, 'UPDATE users SET full_name = COALESCE(?, full_name), phone = COALESCE(?, phone) WHERE id = ?', [fullName ?? null, phone ?? null, id]);
export const setPassword = (db, id, hash) => exec(db, 'UPDATE users SET password_hash = ?, token_version = token_version + 1 WHERE id = ?', [hash, id]);
export const bumpTokenVersion = (db, id) => exec(db, 'UPDATE users SET token_version = token_version + 1 WHERE id = ?', [id]);
export const touchLogin = (db, id) => exec(db, 'UPDATE users SET last_login_at = UTC_TIMESTAMP() WHERE id = ?', [id]);
export const setStatus = (db, id, status) => exec(db, 'UPDATE users SET status = ?, token_version = token_version + 1 WHERE id = ?', [status, id]);

export async function list(db, { role, status, q, sortBy, sortDir, limit, offset }) {
  const where = [], params = [];
  if (role) { where.push('role = ?'); params.push(role); }
  if (status) { where.push('status = ?'); params.push(status); }
  if (q) { where.push('(full_name LIKE ? OR email LIKE ?)'); params.push(`%${q}%`, `%${q}%`); }
  const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const total = (await queryOne(db, `SELECT COUNT(*) c FROM users ${w}`, params)).c;
  const ob = orderBy({ created: 'created_at', name: 'full_name', email: 'email', role: 'role' }, sortBy, sortDir, 'created');
  const rows = await query(db, `SELECT ${PUBLIC} FROM users ${w} ORDER BY ${ob} LIMIT ? OFFSET ?`, [...params, limit, offset]);
  return { rows, total };
}
export const createResetToken = (db, userId, hash, minutes) =>
  exec(db, 'INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES (?,?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? MINUTE))', [userId, hash, minutes]);
export const findResetToken = (db, hash) => queryOne(db,
  'SELECT id, user_id FROM password_reset_tokens WHERE token_hash = ? AND used_at IS NULL AND expires_at > UTC_TIMESTAMP() FOR UPDATE', [hash]);
export const consumeResetToken = (db, id) => exec(db, 'UPDATE password_reset_tokens SET used_at = UTC_TIMESTAMP() WHERE id = ?', [id]);
export const invalidateResetTokens = (db, userId) => exec(db, 'UPDATE password_reset_tokens SET used_at = UTC_TIMESTAMP() WHERE user_id = ? AND used_at IS NULL', [userId]);
