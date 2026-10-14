import { z } from 'zod';
import { dateOnly } from './common.js';
import { paginationSchema } from '../utils/pagination.js';
import { DEMO_METHODS } from '../integrations/paymentGateway.js';

// Note: no amount, no status, no card fields. Unknown keys (e.g. status: "PAID", cardNumber) are rejected by .strict().
export const payBody = z.object({ bookingId: z.number().int().positive(), method: z.enum(DEMO_METHODS) }).strict();
export const listQuery = paginationSchema.extend({
  status: z.enum(['SUCCESS', 'FAILED']).optional(), q: z.string().trim().max(100).optional(), from: dateOnly.optional(), to: dateOnly.optional(),
  sortBy: z.enum(['created', 'amount']).default('created'), sortDir: z.enum(['asc', 'desc']).default('desc'),
});
