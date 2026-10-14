import { Router } from 'express';
import { authenticate, optionalAuth, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { idParam } from '../validators/common.js';
import * as c from '../controllers/catalogue.controller.js';
import * as v from '../validators/catalogue.js';

export const categoriesRouter = Router();
categoriesRouter.get('/', optionalAuth, validate({ query: v.categoryQuery }), c.listCategories);
categoriesRouter.post('/', authenticate, requireRole('ADMIN'), validate({ body: v.categoryBody }), c.createCategory);
categoriesRouter.patch('/:id', authenticate, requireRole('ADMIN'), validate({ params: idParam, body: v.categoryUpdate }), c.updateCategory);

export const servicesRouter = Router();
servicesRouter.get('/', optionalAuth, validate({ query: v.serviceQuery }), c.listServices);
servicesRouter.get('/:id', optionalAuth, validate({ params: idParam }), c.getService);
servicesRouter.post('/', authenticate, requireRole('ADMIN'), validate({ body: v.serviceBody }), c.createService);
servicesRouter.patch('/:id', authenticate, requireRole('ADMIN'), validate({ params: idParam, body: v.serviceUpdate }), c.updateService);
