import { asyncHandler, ok, created } from '../utils/http.js';
import * as auth from '../services/auth.service.js';
import * as users from '../repositories/users.repository.js';
import { pool } from '../db/pool.js';
import { publicUser } from '../services/auth.service.js';

export const register = asyncHandler(async (req, res) => { const { token, user } = await auth.register(req.body); created(res, { token, user }); });
export const login = asyncHandler(async (req, res) => ok(res, await auth.login(req.body)));
export const logout = asyncHandler(async (req, res) => { await auth.logout(req.user.id); ok(res, { message: 'Logged out' }); });
export const me = asyncHandler(async (req, res) => {
  const u = await users.findById(pool, req.user.id);
  ok(res, { user: { id: u.id, email: u.email, fullName: u.full_name, phone: u.phone, role: u.role, status: u.status } });
});
export const forgot = asyncHandler(async (req, res) => ok(res, await auth.forgotPassword(req.body.email)));
export const reset = asyncHandler(async (req, res) => ok(res, await auth.resetPassword(req.body)));
export const changePassword = asyncHandler(async (req, res) => ok(res, await auth.changePassword(req.user.id, req.body)));
export { publicUser };
