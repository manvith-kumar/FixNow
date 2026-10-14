import { z } from 'zod';
import { text, timeOnly } from './common.js';
import { paginationSchema } from '../utils/pagination.js';

export const updateMeBody = z.object({
  specialization: text(150, 2).optional(), experienceYears: z.number().int().min(0).max(60).optional(),
  serviceArea: text(190, 2).optional(), bio: text(2000).optional(), serviceIds: z.array(z.number().int().positive()).max(50).optional(),
}).strict();
const slot = z.object({ dayOfWeek: z.number().int().min(0).max(6), startTime: timeOnly, endTime: timeOnly, isAvailable: z.boolean().default(true) })
  .refine((s) => s.endTime > s.startTime, { message: 'End time must be after start time', path: ['endTime'] });
export const availabilityBody = z.object({ slots: z.array(slot).max(50) }).strict();
export const adminListQuery = paginationSchema.extend({
  status: z.enum(['NOT_APPLIED', 'PENDING', 'NEEDS_INFO', 'APPROVED', 'REJECTED']).optional(), q: z.string().trim().max(100).optional(),
  sortBy: z.enum(['name', 'created', 'experience']).default('created'), sortDir: z.enum(['asc', 'desc']).default('desc'),
});
export const activeBody = z.object({ isActive: z.boolean() }).strict();
