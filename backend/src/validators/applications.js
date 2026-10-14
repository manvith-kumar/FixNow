import { z } from 'zod';
import { text, phone } from './common.js';
import { paginationSchema } from '../utils/pagination.js';

const DOC_TYPES = ['ID_DOCUMENT', 'CERTIFICATE', 'PROOF_OF_EXPERIENCE', 'OTHER'];
/** multipart fields arrive as strings: accept JSON arrays or comma separated lists. */
const list = (inner) => z.preprocess((v) => {
  if (Array.isArray(v)) return v;
  if (typeof v !== 'string' || v === '') return [];
  if (v.trim().startsWith('[')) { try { return JSON.parse(v); } catch { return v; } }
  return v.split(',').map((s) => s.trim()).filter(Boolean);
}, z.array(inner));

export const submitBody = z.object({
  fullName: text(120, 2), phone, specialization: text(150, 2),
  experienceYears: z.coerce.number().int().min(0).max(60), serviceArea: text(190, 2), bio: text(2000).optional(),
  serviceIds: list(z.coerce.number().int().positive()).pipe(z.array(z.number()).min(1, 'Select at least one service').max(50)),
  docTypes: list(z.enum(DOC_TYPES)),
}).strict();
export const docsBody = z.object({ docTypes: list(z.enum(DOC_TYPES)) }).strict();
export const decisionBody = z.object({ decision: z.enum(['APPROVE', 'REJECT', 'REQUEST_INFO']), notes: text(1000).optional() }).strict()
  .refine((d) => d.decision === 'APPROVE' || (d.notes && d.notes.length >= 5), { message: 'Notes (at least 5 characters) are required to reject or request information', path: ['notes'] });
export const listQuery = paginationSchema.extend({
  status: z.enum(['SUBMITTED', 'NEEDS_INFO', 'APPROVED', 'REJECTED']).optional(), q: z.string().trim().max(100).optional(),
  sortBy: z.enum(['submitted', 'name', 'status']).default('submitted'), sortDir: z.enum(['asc', 'desc']).default('desc'),
});
export const docParams = z.object({ id: z.coerce.number().int().positive(), docId: z.coerce.number().int().positive() });
