import { z } from 'zod';
import { phone, text } from './common.js';
import { paginationSchema } from '../utils/pagination.js';

export const updateMeBody = z.object({ fullName: text(120, 2).optional(), phone: phone.optional() }).strict();
export const listQuery = paginationSchema.extend({
  role: z.enum(['CUSTOMER', 'TECHNICIAN', 'ADMIN']).optional(),
  status: z.enum(['ACTIVE', 'DISABLED']).optional(),
  q: z.string().trim().max(100).optional(),
  sortBy: z.enum(['created', 'name', 'email', 'role']).default('created'),
  sortDir: z.enum(['asc', 'desc']).default('desc'),
});
export const statusBody = z.object({ status: z.enum(['ACTIVE', 'DISABLED']) }).strict();
