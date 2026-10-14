import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { paymentLimiter } from '../middleware/rateLimiters.js';
import { idParam } from '../validators/common.js';
import * as c from '../controllers/payments.controller.js';
import * as v from '../validators/payments.js';

const r = Router();
r.use(authenticate);
r.post('/', requireRole('CUSTOMER'), paymentLimiter, validate({ body: v.payBody }), c.pay);
r.get('/', validate({ query: v.listQuery }), c.list);
r.get('/:id', validate({ params: idParam }), c.get);
export default r;
