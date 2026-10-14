import multer from 'multer';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';

fs.mkdirSync(env.uploadDir, { recursive: true });

// Only these types are accepted. The extension is derived from the verified content, never from the client filename.
const ALLOWED = { 'application/pdf': '.pdf', 'image/jpeg': '.jpg', 'image/png': '.png' };

export const upload = multer({
  storage: multer.diskStorage({
    destination: env.uploadDir,
    filename: (_req, _file, cb) => cb(null, `${crypto.randomUUID()}.upload`), // temporary; renamed after content check
  }),
  limits: { fileSize: env.maxUploadBytes, files: 5 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED[file.mimetype]) return cb(AppError.badRequest('Only PDF, JPG and PNG files are allowed'));
    cb(null, true);
  },
});

/** Detect real file type from magic bytes. */
export function sniffMime(filePath) {
  const fd = fs.openSync(filePath, 'r');
  const buf = Buffer.alloc(8);
  fs.readSync(fd, buf, 0, 8, 0);
  fs.closeSync(fd);
  if (buf.slice(0, 4).toString() === '%PDF') return 'application/pdf';
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  return null;
}

/** Validates uploaded temp files; renames to safe random names with the verified extension. Returns metadata. */
export function finalizeUploads(files = []) {
  const done = [];
  try {
    for (const f of files) {
      const real = sniffMime(f.path);
      if (!real || real !== f.mimetype) throw AppError.badRequest(`File "${path.basename(f.originalname)}" content does not match its declared type`);
      const stored = `${crypto.randomUUID()}${ALLOWED[real]}`;
      fs.renameSync(f.path, path.join(env.uploadDir, stored));
      done.push({ originalName: path.basename(f.originalname).replace(/[^\w.\- ]/g, '_').slice(0, 200), storedName: stored, mimeType: real, sizeBytes: f.size });
    }
  } catch (err) {
    discardUploads(files); discardStored(done);
    throw err;
  }
  return done;
}
export function discardUploads(files = []) { for (const f of files) fs.rmSync(f.path, { force: true }); }
export function discardStored(metas = []) { for (const m of metas) fs.rmSync(path.join(env.uploadDir, m.storedName), { force: true }); }
