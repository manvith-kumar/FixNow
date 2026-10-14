import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { AppError } from '../utils/AppError.js';
import { idParam } from '../validators/common.js';
import * as c from '../controllers/quotations.controller.js';
import * as v from '../validators/quotations.js';

const r = Router();
r.use(authenticate);
r.post('/', requireRole('TECHNICIAN'), validate({ body: v.createBody }), c.create);
const needBookingId = (req, _res, next) => (!req.query.bookingId && req.user.role !== 'ADMIN' ? next(AppError.badRequest('bookingId is required')) : next());
r.get('/', validate({ query: v.listQuery }), needBookingId, c.list);
r.get('/:id', validate({ params: idParam }), c.get);
r.post('/:id/approve', requireRole('CUSTOMER'), validate({ params: idParam }), c.approve);
r.post('/:id/reject', requireRole('CUSTOMER'), validate({ params: idParam, body: v.rejectBody }), c.reject);
export default r;
