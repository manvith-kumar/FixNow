import { ZodError } from 'zod';
import multer from 'multer';
import { env } from '../config/env.js';
import fs from 'node:fs';
import { logger } from '../utils/logger.js';

export function notFoundHandler(req, res) {
  res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: `Route ${req.method} ${req.originalUrl.split('?')[0]} not found` } });
}

export function errorHandler(err, req, res, _next) {
  // never leave rejected uploads on disk
  for (const f of req.files ?? []) { try { fs.rmSync(f.path, { force: true }); } catch { /* ignore */ } }
  let status = 500, code = 'INTERNAL_ERROR', message = 'An unexpected error occurred', details;

  if (err instanceof ZodError) {
    status = 400; code = 'VALIDATION_ERROR'; message = 'Validation failed';
    details = err.issues.map((i) => ({ field: i.path.join('.'), message: i.message }));
  } else if (err?.isAppError) {
    ({ status, code, message, details } = err);
  } else if (err instanceof multer.MulterError) {
    status = 400; code = 'UPLOAD_ERROR';
    message = err.code === 'LIMIT_FILE_SIZE' ? `File exceeds the ${env.MAX_UPLOAD_MB} MB limit` : 'File upload failed';
  } else if (err?.type === 'entity.parse.failed') {
    status = 400; code = 'INVALID_JSON'; message = 'Request body is not valid JSON';
  } else if (err?.type === 'entity.too.large') {
    status = 413; code = 'PAYLOAD_TOO_LARGE'; message = 'Request body is too large';
  } else if (err?.code === 'ER_DUP_ENTRY') {
    status = 409; code = 'DUPLICATE'; message = 'A record with these details already exists';
  } else if (err?.code === 'ER_LOCK_DEADLOCK' || err?.code === 'ER_LOCK_WAIT_TIMEOUT') {
    status = 503; code = 'TRY_AGAIN'; message = 'The system is busy. Please try again.';
  }

  if (status >= 500) logger.error(`${req.method} ${req.originalUrl.split('?')[0]} -> ${status}: ${err?.message}`, env.isProduction ? undefined : { stack: err?.stack });
  const body = { success: false, error: { code, message, ...(details ? { details } : {}) } };
  if (!env.isProduction && status >= 500) body.error.debug = err?.message; // never in production
  res.status(status).json(body);
}
