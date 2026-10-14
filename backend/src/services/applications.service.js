import fs from 'node:fs';
import path from 'node:path';
import { env } from '../config/env.js';
import { pool, withTransaction, exec } from '../db/pool.js';
import { AppError } from '../utils/AppError.js';
import { paging, pageMeta } from '../utils/pagination.js';
import * as repo from '../repositories/applications.repository.js';
import * as tech from '../repositories/technicians.repository.js';
import { finalizeUploads, discardStored } from '../middleware/upload.js';
import { notify, notifyAdmins } from './notification.service.js';
import { audit } from './audit.service.js';

const parseIds = (v) => (typeof v === 'string' ? JSON.parse(v) : v) ?? [];
export const mapApp = (a, docs) => ({
  id: a.id, userId: a.user_id, email: a.email, fullName: a.full_name, phone: a.phone, specialization: a.specialization,
  experienceYears: a.experience_years, serviceArea: a.service_area, bio: a.bio, serviceIds: parseIds(a.service_ids), status: a.status,
  reviewNotes: a.review_notes, reviewerName: a.reviewer_name ?? undefined, reviewedAt: a.reviewed_at, submittedAt: a.submitted_at,
  ...(docs ? { documents: docs.map((d) => ({ id: d.id, docType: d.doc_type, originalName: d.original_name, mimeType: d.mime_type, sizeBytes: d.size_bytes, uploadedAt: d.uploaded_at })) } : {}),
});

async function withDocs(a) { return mapApp(a, await repo.documents(pool, a.id)); }

export async function submit(user, data, files) {
  // files were already validated by multer; finalise (magic-byte check + safe name) before touching the DB
  const metas = finalizeUploads(files);
  try {
    const id = await withTransaction(async (conn) => {
      const profile = await tech.findProfileByUser(conn, user.id, true);
      if (!profile) throw AppError.forbidden('Technician profile not found');
      if (profile.approval_status === 'APPROVED') throw AppError.conflict('Your application has already been approved', 'ALREADY_APPROVED');
      if (await repo.hasOpen(conn, user.id)) throw AppError.conflict('You already have an application under review', 'APPLICATION_OPEN');
      const valid = await tech.activeServiceIds(conn, data.serviceIds);
      if (valid.length !== new Set(data.serviceIds).size) throw AppError.badRequest('One or more selected services are invalid or inactive');
      const appId = await repo.insert(conn, user.id, data);
      for (let i = 0; i < metas.length; i++) await repo.insertDocument(conn, appId, user.id, data.docTypes[i], metas[i]);
      await exec(conn, "UPDATE technician_profiles SET approval_status='PENDING', specialization=?, experience_years=?, service_area=?, bio=? WHERE id=?",
        [data.specialization, data.experienceYears, data.serviceArea, data.bio ?? null, profile.id]);
      await exec(conn, 'UPDATE users SET full_name = ?, phone = ? WHERE id = ?', [data.fullName, data.phone, user.id]);
      await notify(conn, { userId: user.id, type: 'APPLICATION_SUBMITTED', title: 'Application submitted', message: 'Your technician application has been received and is awaiting review.', resourceType: 'application', resourceId: appId });
      await notifyAdmins(conn, { type: 'APPLICATION_SUBMITTED', title: 'New technician application', message: `${data.fullName} submitted a technician application.`, resourceType: 'application', resourceId: appId });
      return appId;
    });
    return withDocs(await repo.get(pool, id));
  } catch (err) { discardStored(metas); throw err; }
}

export async function addDocuments(user, appId, docTypes, files) {
  const metas = finalizeUploads(files);
  try {
    await withTransaction(async (conn) => {
      const a = await repo.lock(conn, appId);
      if (!a || a.user_id !== user.id) throw AppError.notFound('Application not found');
      if (!['SUBMITTED', 'NEEDS_INFO'].includes(a.status)) throw AppError.conflict('Documents can only be added to an open application', 'APPLICATION_CLOSED');
      for (let i = 0; i < metas.length; i++) await repo.insertDocument(conn, appId, user.id, docTypes[i], metas[i]);
      if (a.status === 'NEEDS_INFO') {
        await repo.resubmit(conn, appId);
        await exec(conn, "UPDATE technician_profiles SET approval_status='PENDING' WHERE user_id = ?", [user.id]);
        await notifyAdmins(conn, { type: 'APPLICATION_RESUBMITTED', title: 'Application updated', message: `${a.full_name} supplied the requested information.`, resourceType: 'application', resourceId: appId });
      }
    });
  } catch (err) { discardStored(metas); throw err; }
  return withDocs(await repo.get(pool, appId));
}

export async function mine(userId) {
  const a = await repo.latestByUser(pool, userId);
  return a ? { current: await withDocs(await repo.get(pool, a.id)), history: await repo.historyByUser(pool, userId) } : { current: null, history: [] };
}
export async function adminList(q) {
  const { rows, total } = await repo.adminList(pool, { ...q, ...paging(q) });
  return { rows: rows.map((r) => mapApp(r)), meta: pageMeta(q, total) };
}
export async function adminGet(id) {
  const a = await repo.get(pool, id);
  if (!a) throw AppError.notFound('Application not found');
  return withDocs(a);
}

export async function decide(actor, appId, { decision, notes }, ip) {
  await withTransaction(async (conn) => {
    const a = await repo.lock(conn, appId);
    if (!a) throw AppError.notFound('Application not found');
    if (a.status !== 'SUBMITTED') throw AppError.conflict(`Application is ${a.status} and cannot be reviewed again`, 'INVALID_APPLICATION_STATE');
    if (a.user_id === actor.id) throw AppError.forbidden('You cannot review your own application');
    const profile = await tech.findProfileByUser(conn, a.user_id, true);
    if (decision === 'APPROVE') {
      const ids = await tech.activeServiceIds(conn, parseIds(a.service_ids));
      await repo.setStatus(conn, appId, 'APPROVED', actor.id, notes ?? null);
      await tech.setApproval(conn, profile.id, 'APPROVED');
      await tech.replaceServices(conn, profile.id, ids);
      await notify(conn, { userId: a.user_id, type: 'APPLICATION_APPROVED', title: 'Application approved', message: 'Congratulations! Your technician account is approved. You can now accept jobs.', resourceType: 'application', resourceId: appId });
    } else if (decision === 'REJECT') {
      await repo.setStatus(conn, appId, 'REJECTED', actor.id, notes);
      await tech.setApproval(conn, profile.id, 'REJECTED');
      await notify(conn, { userId: a.user_id, type: 'APPLICATION_REJECTED', title: 'Application not approved', message: `Your application was not approved. Reason: ${notes}`, resourceType: 'application', resourceId: appId });
    } else {
      await repo.setStatus(conn, appId, 'NEEDS_INFO', actor.id, notes);
      await tech.setApproval(conn, profile.id, 'NEEDS_INFO');
      await notify(conn, { userId: a.user_id, type: 'APPLICATION_NEEDS_INFO', title: 'More information needed', message: `We need more information: ${notes}`, resourceType: 'application', resourceId: appId });
    }
    await audit(conn, actor, `APPLICATION_${decision}`, 'technician_application', appId, { notes }, ip);
  });
  return adminGet(appId);
}

/** Returns an absolute path only for documents that belong to the application and live inside the upload dir. */
export async function documentForDownload(user, appId, docId) {
  const a = await repo.get(pool, appId);
  if (!a || (user.role !== 'ADMIN' && a.user_id !== user.id)) throw AppError.notFound('Document not found');
  const d = await repo.documentFile(pool, appId, docId);
  if (!d) throw AppError.notFound('Document not found');
  const full = path.resolve(env.uploadDir, d.stored_name);
  if (!full.startsWith(path.resolve(env.uploadDir) + path.sep) || !fs.existsSync(full)) throw AppError.notFound('Document file is unavailable');
  return { path: full, mimeType: d.mime_type, name: d.original_name };
}
