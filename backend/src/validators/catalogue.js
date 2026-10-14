import { z } from 'zod';
import { text, boolish } from './common.js';
import { paginationSchema } from '../utils/pagination.js';

export const categoryBody = z.object({
  name: text(100, 2), description: text(2000).optional(), icon: text(60).optional(), imageUrl: text(255).optional(), isActive: z.boolean().default(true),
}).strict();
export const categoryUpdate = categoryBody.partial();
const price = z.union([z.string(), z.number()]).refine((v) => /^\d{1,8}(\.\d{1,2})?$/.test(String(v)), 'Invalid price').transform(String).nullable();
export const serviceBody = z.object({
  categoryId: z.number().int().positive(), name: text(120, 2), description: text(4000).optional(), imageUrl: text(255).optional(),
  indicativeStartingPrice: price.optional(), isFeatured: z.boolean().default(false), isActive: z.boolean().default(true),
}).strict();
export const serviceUpdate = serviceBody.partial();
export const serviceQuery = paginationSchema.extend({
  categoryId: z.coerce.number().int().positive().optional(), q: z.string().trim().max(100).optional(), featured: boolish.optional(), all: boolish.optional(),
  sortBy: z.enum(['name', 'price', 'created']).default('name'), sortDir: z.enum(['asc', 'desc']).default('asc'),
});
export const categoryQuery = z.object({ q: z.string().trim().max(100).optional(), all: boolish.optional() });
