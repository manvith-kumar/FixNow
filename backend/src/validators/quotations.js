import { z } from 'zod';
import { text, dateOnly, decimalStr } from './common.js';
import { paginationSchema } from '../utils/pagination.js';

const item = z.object({
  itemType: z.enum(['LABOUR', 'PART', 'MATERIAL', 'ADDITIONAL']), description: text(255, 2),
  quantity: decimalStr, unitPrice: decimalStr,
}).strict();
export const createBody = z.object({
  bookingId: z.number().int().positive(), items: z.array(item).min(1).max(50),
  discountAmount: decimalStr.optional(), taxRate: decimalStr.optional(), // totals are NOT accepted: .strict() rejects totalAmount etc.
  notes: text(2000).optional(), revisionNotes: text(1000, 3).optional(), validUntil: dateOnly.optional(),
}).strict();
export const rejectBody = z.object({ reason: text(500, 5) }).strict();
export const listQuery = paginationSchema.extend({
  bookingId: z.coerce.number().int().positive().optional(), status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'SUPERSEDED', 'WITHDRAWN']).optional(),
  q: z.string().trim().max(100).optional(), currentOnly: z.enum(['true', 'false']).optional().transform((v) => v === 'true'),
  sortBy: z.enum(['created', 'total', 'status']).default('created'), sortDir: z.enum(['asc', 'desc']).default('desc'),
});
