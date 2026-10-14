import bcrypt from 'bcryptjs';
import { env } from '../config/env.js';
import { pool, withTransaction, exec } from '../db/pool.js';
import { AppError } from '../utils/AppError.js';
import { randomToken, sha256 } from '../utils/ids.js';
import { logger } from '../utils/logger.js';
import { signToken } from '../middleware/auth.js';
import * as users from '../repositories/users.repository.js';

const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10); // equalises timing for unknown emails
const sanitize = (u) => ({ id: u.id, email: u.email, fullName: u.full_name, phone: u.phone, role: u.role, status: u.status });
export { sanitize as publicUser };

export async function register({ email, password, fullName, phone, role }) {
  if (await users.findByEmail(pool, email)) throw AppError.conflict('An account with this email already exists', 'EMAIL_TAKEN');
  const passwordHash = await bcrypt.hash(password, env.BCRYPT_ROUNDS);
  const id = await withTransaction(async (conn) => {
    const userId = await users.create(conn, { email, passwordHash, fullName, phone, role });
    if (role === 'TECHNICIAN') await exec(conn, "INSERT INTO technician_profiles (user_id, approval_status) VALUES (?, 'NOT_APPLIED')", [userId]);
    return userId;
  });
  const row = await users.findByEmail(pool, email);
  return { token: signToken(row), user: sanitize(row), id };
}

export async function login({ email, password }) {
  const user = await users.findByEmail(pool, email);
  const ok = await bcrypt.compare(password, user?.password_hash ?? DUMMY_HASH);
  if (!user || !ok) throw new AppError(401, 'INVALID_CREDENTIALS', 'Incorrect email or password');
  if (user.status !== 'ACTIVE') throw new AppError(403, 'ACCOUNT_DISABLED', 'This account has been disabled. Please contact support.');
  await users.touchLogin(pool, user.id);
  return { token: signToken(user), user: sanitize(user) };
}

/** Stateless JWTs are revoked by bumping token_version, which invalidates every outstanding token for the user. */
export async function logout(userId) { await users.bumpTokenVersion(pool, userId); }

export async function forgotPassword(email) {
  const user = await users.findByEmail(pool, email);
  const generic = { message: 'If an account exists for that email, password reset instructions have been prepared.' };
  if (!user || user.status !== 'ACTIVE') return generic;
  const token = randomToken();
  await users.invalidateResetTokens(pool, user.id);
  await users.createResetToken(pool, user.id, sha256(token), env.PASSWORD_RESET_TTL_MINUTES);
  // No email provider is wired in this release: the development "outbox" is the server console.
  if (!env.isProduction) logger.info(`[DEV OUTBOX] Password reset for ${user.email}: ${env.FRONTEND_ORIGIN.split(',')[0]}/reset-password?token=${token}`);
  else logger.warn('Password reset requested but no email provider is configured; no email was sent.');
  if (!env.isProduction && env.DEV_EXPOSE_RESET_TOKEN) generic.devResetToken = token; // development only
  return generic;
}

export async function resetPassword({ token, password }) {
  const hash = await bcrypt.hash(password, env.BCRYPT_ROUNDS);
  await withTransaction(async (conn) => {
    const row = await users.findResetToken(conn, sha256(token));
    if (!row) throw AppError.badRequest('This reset link is invalid or has expired');
    await users.consumeResetToken(conn, row.id);
    await users.setPassword(conn, row.user_id, hash);
  });
  return { message: 'Password updated. Please log in with your new password.' };
}

export async function changePassword(userId, { currentPassword, newPassword }) {
  const user = await pool.query('SELECT * FROM users WHERE id = ?', [userId]).then(([r]) => r[0]);
  if (!(await bcrypt.compare(currentPassword, user.password_hash))) throw new AppError(400, 'INVALID_CREDENTIALS', 'Current password is incorrect');
  await users.setPassword(pool, userId, await bcrypt.hash(newPassword, env.BCRYPT_ROUNDS));
  const fresh = await users.findByEmail(pool, user.email);
  return { token: signToken(fresh) };
}
