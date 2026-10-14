import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { idParam } from '../validators/common.js';
import { paginationSchema } from '../utils/pagination.js';
import * as c from '../controllers/reviews.controller.js';
import * as v from '../validators/reviews.js';

const r = Router();
r.get('/', validate({ query: v.publicQuery }), c.publicList); // public: VISIBLE reviews only, reviewer first name only
r.post('/', authenticate, requireRole('CUSTOMER'), validate({ body: v.createBody }), c.create);
r.get('/mine', authenticate, requireRole('CUSTOMER', 'TECHNICIAN'), validate({ query: paginationSchema }), c.mine);
r.get('/admin', authenticate, requireRole('ADMIN'), validate({ query: v.adminQuery }), c.adminList);
r.patch('/:id/moderation', authenticate, requireRole('ADMIN'), validate({ params: idParam, body: v.moderateBody }), c.moderate);
export default r;
