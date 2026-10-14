import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { upload } from '../middleware/upload.js';
import { idParam } from '../validators/common.js';
import * as c from '../controllers/applications.controller.js';
import * as v from '../validators/applications.js';

const r = Router();
r.use(authenticate);
r.post('/', requireRole('TECHNICIAN'), upload.array('documents', 5), validate({ body: v.submitBody }), c.submit);
r.get('/mine', requireRole('TECHNICIAN'), c.mine);
r.post('/:id/documents', requireRole('TECHNICIAN'), upload.array('documents', 5), validate({ params: idParam, body: v.docsBody }), c.addDocuments);
r.get('/', requireRole('ADMIN'), validate({ query: v.listQuery }), c.adminList);
r.get('/:id', requireRole('ADMIN'), validate({ params: idParam }), c.adminGet);
r.post('/:id/decision', requireRole('ADMIN'), validate({ params: idParam, body: v.decisionBody }), c.decide);
r.get('/:id/documents/:docId/download', requireRole('ADMIN', 'TECHNICIAN'), validate({ params: v.docParams }), c.download);
export default r;
