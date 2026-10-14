import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { idParam } from '../validators/common.js';
import * as c from '../controllers/users.controller.js';
import * as v from '../validators/users.js';

const r = Router();
r.use(authenticate);
r.patch('/me', validate({ body: v.updateMeBody }), c.updateMe);
r.get('/', requireRole('ADMIN'), validate({ query: v.listQuery }), c.list);
r.get('/:id', requireRole('ADMIN'), validate({ params: idParam }), c.get);
r.patch('/:id/status', requireRole('ADMIN'), validate({ params: idParam, body: v.statusBody }), c.setStatus);
export default r;
