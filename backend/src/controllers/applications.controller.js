import { asyncHandler, ok, created } from '../utils/http.js';
import { AppError } from '../utils/AppError.js';
import { discardUploads } from '../middleware/upload.js';
import * as svc from '../services/applications.service.js';

function checkFiles(req) {
  const files = req.files ?? [];
  if (!files.length) throw AppError.badRequest('At least one document is required');
  if (req.body.docTypes.length !== files.length) throw AppError.badRequest('Provide one document type per uploaded file');
  return files;
}
export const submit = asyncHandler(async (req, res) => {
  try {
    const files = checkFiles(req);
    if (!req.body.docTypes.includes('ID_DOCUMENT')) throw AppError.badRequest('An ID document is required');
    created(res, await svc.submit(req.user, req.body, files));
  } catch (e) { discardUploads(req.files); throw e; }
});
export const addDocuments = asyncHandler(async (req, res) => {
  try { ok(res, await svc.addDocuments(req.user, req.params.id, req.body.docTypes, checkFiles(req))); }
  catch (e) { discardUploads(req.files); throw e; }
});
export const mine = asyncHandler(async (req, res) => ok(res, await svc.mine(req.user.id)));
export const adminList = asyncHandler(async (req, res) => { const { rows, meta } = await svc.adminList(req.query); ok(res, rows, meta); });
export const adminGet = asyncHandler(async (req, res) => ok(res, await svc.adminGet(req.params.id)));
export const decide = asyncHandler(async (req, res) => ok(res, await svc.decide(req.user, req.params.id, req.body, req.ip)));
export const download = asyncHandler(async (req, res) => {
  const d = await svc.documentForDownload(req.user, req.params.id, req.params.docId);
  res.setHeader('Content-Type', d.mimeType);
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(d.name)}"`);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'private, no-store');
  res.sendFile(d.path);
});
