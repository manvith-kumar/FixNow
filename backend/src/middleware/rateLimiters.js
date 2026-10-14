import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';

const make = (windowMs, max, message) => rateLimit({
  windowMs, max: env.isTest ? 10_000 : max, standardHeaders: true, legacyHeaders: false,
  message: { success: false, error: { code: 'RATE_LIMITED', message } },
});
export const apiLimiter = make(60_000, 300, 'Too many requests. Please slow down.');
export const authLimiter = make(15 * 60_000, env.AUTH_RATE_LIMIT_MAX, 'Too many attempts. Please try again later.');
export const paymentLimiter = make(60_000, 20, 'Too many payment attempts. Please wait a moment.');
