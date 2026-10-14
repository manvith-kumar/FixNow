import { pool } from '../db/pool.js';
import { AppError } from '../utils/AppError.js';
import { paging, pageMeta } from '../utils/pagination.js';
import * as users from '../repositories/users.repository.js';
import { audit } from './audit.service.js';

const map = (u) => ({ id: u.id, email: u.email, fullName: u.full_name, phone: u.phone, role: u.role, status: u.status, lastLoginAt: u.last_login_at, createdAt: u.created_at });

export async function updateMe(userId, body) {
  await users.updateProfile(pool, userId, body);
  return map(await users.findById(pool, userId));
}
export async function adminList(q) {
  const { rows, total } = await users.list(pool, { ...q, ...paging(q) });
  return { rows: rows.map(map), meta: pageMeta(q, total) };
}
export async function adminGet(id) {
  const u = await users.findById(pool, id);
  if (!u) throw AppError.notFound('User not found');
  return map(u);
}
export async function adminSetStatus(actor, id, status, ip) {
  if (actor.id === id) throw AppError.conflict('You cannot change your own account status', 'SELF_MODIFICATION');
  const u = await users.findById(pool, id);
  if (!u) throw AppError.notFound('User not found');
  await users.setStatus(pool, id, status);
  await audit(pool, actor, `USER_${status}`, 'user', id, { email: u.email }, ip);
  return map(await users.findById(pool, id));
}
