import { exec, query, queryOne } from '../db/pool.js';

export const listByUser = (db, userId) => query(db, 'SELECT * FROM addresses WHERE user_id = ? ORDER BY is_default DESC, created_at DESC', [userId]);
export const findOwned = (db, id, userId, forUpdate = false) =>
  queryOne(db, `SELECT * FROM addresses WHERE id = ? AND user_id = ? ${forUpdate ? 'FOR UPDATE' : ''}`, [id, userId]);
export const countByUser = async (db, userId) => (await queryOne(db, 'SELECT COUNT(*) c FROM addresses WHERE user_id = ?', [userId])).c;
export const clearDefault = (db, userId) => exec(db, 'UPDATE addresses SET is_default = 0 WHERE user_id = ?', [userId]);
export async function insert(db, userId, d) {
  const r = await exec(db, `INSERT INTO addresses (user_id, label, line1, line2, city, state, postal_code, country, latitude, longitude, is_default)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)`, [userId, d.label, d.line1, d.line2 ?? null, d.city, d.state ?? null, d.postalCode ?? null, d.country, d.latitude ?? null, d.longitude ?? null, d.isDefault ? 1 : 0]);
  return r.insertId;
}
export const update = (db, id, d) => exec(db, `UPDATE addresses SET label=?, line1=?, line2=?, city=?, state=?, postal_code=?, country=?, latitude=?, longitude=?, is_default=? WHERE id=?`,
  [d.label, d.line1, d.line2 ?? null, d.city, d.state ?? null, d.postalCode ?? null, d.country, d.latitude ?? null, d.longitude ?? null, d.isDefault ? 1 : 0, id]);
export const remove = (db, id) => exec(db, 'DELETE FROM addresses WHERE id = ?', [id]);
export const setDefault = (db, id) => exec(db, 'UPDATE addresses SET is_default = 1 WHERE id = ?', [id]);
export const pickNewDefault = (db, userId) => exec(db, 'UPDATE addresses SET is_default = 1 WHERE user_id = ? ORDER BY created_at DESC LIMIT 1', [userId]);
export const bookingCount = async (db, id) => (await queryOne(db, 'SELECT COUNT(*) c FROM bookings WHERE address_id = ?', [id])).c;
