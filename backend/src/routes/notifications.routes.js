import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { idParam, boolish } from '../validators/common.js';
import { paginationSchema } from '../utils/pagination.js';
import { asyncHandler, ok } from '../utils/http.js';
import * as svc from '../services/notification.service.js';

const r = Router();
r.use(authenticate); // every notification query is scoped by req.user.id => ownership enforced
r.get('/', validate({ query: paginationSchema.extend({ unreadOnly: boolish.optional() }) }),
  asyncHandler(async (req, res) => { const { rows, meta } = await svc.list(req.user.id, req.query); ok(res, rows, meta); }));
r.post('/read-all', asyncHandler(async (req, res) => ok(res, await svc.markAllRead(req.user.id))));
r.post('/:id/read', validate({ params: idParam }), asyncHandler(async (req, res) => ok(res, await svc.markRead(req.user.id, req.params.id))));
export default r;
