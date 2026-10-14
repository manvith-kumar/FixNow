import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { idParam } from '../validators/common.js';
import * as c from '../controllers/technicians.controller.js';
import * as v from '../validators/technicians.js';

export const techniciansRouter = Router();
techniciansRouter.use(authenticate);
techniciansRouter.get('/me', requireRole('TECHNICIAN'), c.getMe);
techniciansRouter.patch('/me', requireRole('TECHNICIAN'), validate({ body: v.updateMeBody }), c.updateMe);
techniciansRouter.get('/me/earnings', requireRole('TECHNICIAN'), c.earnings);
techniciansRouter.get('/', requireRole('ADMIN'), validate({ query: v.adminListQuery }), c.adminList);
techniciansRouter.get('/:id', requireRole('ADMIN'), validate({ params: idParam }), c.adminGet);
techniciansRouter.patch('/:id/active', requireRole('ADMIN'), validate({ params: idParam, body: v.activeBody }), c.adminSetActive);

export const availabilityRouter = Router();
availabilityRouter.use(authenticate, requireRole('TECHNICIAN'));
availabilityRouter.get('/', c.getAvailability);
availabilityRouter.put('/', validate({ body: v.availabilityBody }), c.setAvailability);
