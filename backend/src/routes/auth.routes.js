import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { authLimiter } from '../middleware/rateLimiters.js';
import * as c from '../controllers/auth.controller.js';
import * as v from '../validators/auth.js';

const r = Router();
r.post('/register', authLimiter, validate({ body: v.registerBody }), c.register);
r.post('/login', authLimiter, validate({ body: v.loginBody }), c.login);
r.post('/logout', authenticate, c.logout);
r.get('/me', authenticate, c.me);
r.post('/forgot-password', authLimiter, validate({ body: v.forgotBody }), c.forgot);
r.post('/reset-password', authLimiter, validate({ body: v.resetBody }), c.reset);
r.post('/change-password', authenticate, authLimiter, validate({ body: v.changePasswordBody }), c.changePassword);
export default r;
