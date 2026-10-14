import { exec, query, queryOne, pool } from '../db/pool.js';
import { AppError } from '../utils/AppError.js';
import { pageMeta, paging } from '../utils/pagination.js';

/** Persist a notification. Pass the transaction connection so it commits/rolls back with the business event. */
export async function notify(db, { userId, type, title, message, resourceType = null, resourceId = null }) {
  if (!userId) return;
  await exec(db, `INSERT INTO notifications (user_id, type, title, message, resource_type, resource_id) VALUES (?,?,?,?,?,?)`,
    [userId, type, title, String(message).slice(0, 500), resourceType, resourceId]);
}
export async function notifyAdmins(db, payload) {
  const admins = await query(db, "SELECT id FROM users WHERE role='ADMIN' AND status='ACTIVE'");
  for (const a of admins) await notify(db, { ...payload, userId: a.id });
}

export async function list(userId, { page, pageSize, unreadOnly }) {
  const where = unreadOnly ? 'WHERE user_id = ? AND is_read = 0' : 'WHERE user_id = ?';
  const total = (await queryOne(pool, `SELECT COUNT(*) c FROM notifications ${where}`, [userId])).c;
  const { limit, offset } = paging({ page, pageSize });
  const rows = await query(pool, `SELECT id, type, title, message, resource_type, resource_id, is_read, created_at, read_at
    FROM notifications ${where} ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`, [userId, limit, offset]);
  const unread = (await queryOne(pool, 'SELECT COUNT(*) c FROM notifications WHERE user_id=? AND is_read=0', [userId])).c;
  return { rows, meta: { ...pageMeta({ page, pageSize }, total), unread } };
}
export async function markRead(userId, id) {
  const res = await exec(pool, 'UPDATE notifications SET is_read=1, read_at=COALESCE(read_at, UTC_TIMESTAMP()) WHERE id=? AND user_id=?', [id, userId]);
  if (!res.affectedRows) throw AppError.notFound('Notification not found');
  return queryOne(pool, 'SELECT id, is_read, read_at FROM notifications WHERE id=?', [id]);
}
export async function markAllRead(userId) {
  const res = await exec(pool, 'UPDATE notifications SET is_read=1, read_at=UTC_TIMESTAMP() WHERE user_id=? AND is_read=0', [userId]);
  return { updated: res.affectedRows };
}
