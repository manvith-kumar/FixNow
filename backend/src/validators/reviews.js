import { z } from 'zod';
import { text } from './common.js';
import { paginationSchema } from '../utils/pagination.js';

export const createBody = z.object({ bookingId: z.number().int().positive(), rating: z.number().int().min(1).max(5), comment: text(1500).optional() }).strict();
export const publicQuery = paginationSchema.extend({ serviceId: z.coerce.number().int().positive().optional(), technicianId: z.coerce.number().int().positive().optional() });
export const adminQuery = paginationSchema.extend({ status: z.enum(['VISIBLE', 'HIDDEN']).optional(), q: z.string().trim().max(100).optional() });
export const moderateBody = z.object({ status: z.enum(['VISIBLE', 'HIDDEN']), note: text(255).optional() }).strict();
