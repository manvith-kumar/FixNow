import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { idParam } from '../validators/common.js';
import * as c from '../controllers/addresses.controller.js';
import * as v from '../validators/addresses.js';

const r = Router();
r.use(authenticate, requireRole('CUSTOMER'));
r.get('/', c.list);
r.post('/', validate({ body: v.addressBody }), c.create);
r.patch('/:id', validate({ params: idParam, body: v.addressUpdate }), c.update);
r.post('/:id/default', validate({ params: idParam }), c.setDefault);
r.delete('/:id', validate({ params: idParam }), c.remove);
export default r;
