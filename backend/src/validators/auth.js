import { z } from 'zod';
import { email, password, phone, text } from './common.js';

export const registerBody = z.object({
  email, password, fullName: text(120, 2), phone: phone.optional(),
  role: z.enum(['CUSTOMER', 'TECHNICIAN']).default('CUSTOMER'), // ADMIN can never be self-assigned
}).strict();
export const loginBody = z.object({ email, password: z.string().min(1).max(72) }).strict();
export const forgotBody = z.object({ email }).strict();
export const resetBody = z.object({ token: z.string().min(20).max(200), password }).strict();
export const changePasswordBody = z.object({ currentPassword: z.string().min(1).max(72), newPassword: password }).strict();
