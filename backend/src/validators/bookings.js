import { z } from 'zod';
import { text, dateOnly, timeOnly, latitude, longitude } from './common.js';
import { paginationSchema } from '../utils/pagination.js';

const STATUSES = ['PENDING', 'ASSIGNED', 'INSPECTING', 'INSPECTION_COMPLETED', 'QUOTATION_SENT', 'QUOTATION_APPROVED', 'QUOTATION_REJECTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];
export const createBody = z.object({
  serviceId: z.number().int().positive(), addressId: z.number().int().positive(),
  problemDescription: text(2000, 10), preferredDate: dateOnly, preferredTime: timeOnly,
  latitude: latitude.optional(), longitude: longitude.optional(),
}).strict().refine((d) => (d.latitude === undefined) === (d.longitude === undefined), { message: 'Provide both latitude and longitude, or neither', path: ['latitude'] });
export const listQuery = paginationSchema.extend({
  status: z.enum(STATUSES).optional(), q: z.string().trim().max(100).optional(), serviceId: z.coerce.number().int().positive().optional(),
  technicianId: z.coerce.number().int().positive().optional(), customerId: z.coerce.number().int().positive().optional(),
  paymentStatus: z.enum(['UNPAID', 'PAID']).optional(), from: dateOnly.optional(), to: dateOnly.optional(),
  sortBy: z.enum(['created', 'date', 'status', 'reference']).default('created'), sortDir: z.enum(['asc', 'desc']).default('desc'),
});
export const statusBody = z.object({ status: z.enum(['INSPECTING', 'IN_PROGRESS']) }).strict();
export const cancelBody = z.object({ reason: text(500, 3).optional() }).strict();
export const completeBody = z.object({ completionNotes: text(2000, 3) }).strict();
export const assignBody = z.object({ technicianId: z.number().int().positive() }).strict();
export const inspectionBody = z.object({
  diagnosis: text(3000, 3), observedCondition: text(3000, 3), labourNotes: text(3000).optional(),
  requiredParts: text(3000).optional(), additionalWork: text(3000).optional(), notes: text(3000).optional(),
}).strict();
