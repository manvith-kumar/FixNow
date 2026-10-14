import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler, ok } from '../utils/http.js';
import { paginationSchema } from '../utils/pagination.js';
import { dateOnly } from '../validators/common.js';
import * as svc from '../services/admin.service.js';

const r = Router();
r.use(authenticate, requireRole('ADMIN'));
r.get('/dashboard', asyncHandler(async (_req, res) => ok(res, await svc.dashboard())));
r.get('/reports', (_req, res) => ok(res, svc.REPORT_TYPES));
const reportQuery = z.object({ from: dateOnly.optional(), to: dateOnly.optional(), format: z.enum(['json', 'csv']).default('json') });
r.get('/reports/:type', validate({ query: reportQuery, params: z.object({ type: z.string().max(40) }) }), asyncHandler(async (req, res) => {
  if (req.query.format === 'csv') {
    const { filename, csv } = await svc.reportCsv(req.params.type, req.query);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(csv);
  }
  ok(res, await svc.report(req.params.type, req.query));
}));
r.get('/settings', asyncHandler(async (_req, res) => ok(res, await svc.getSettings())));
r.put('/settings', validate({ body: z.object({ values: z.record(z.string(), z.union([z.string(), z.number()]).transform(String)) }).strict() }),
  asyncHandler(async (req, res) => ok(res, await svc.updateSettings(req.user, req.body.values, req.ip))));
r.get('/audit-logs', validate({ query: paginationSchema.extend({ action: z.string().max(80).optional(), entityType: z.string().max(40).optional() }) }),
  asyncHandler(async (req, res) => { const { rows, meta } = await svc.auditLogs(req.query); ok(res, rows, meta); }));
export default r;
