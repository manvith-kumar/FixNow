import { asyncHandler, ok, created } from '../utils/http.js';
import * as svc from '../services/bookings.service.js';
import * as quotes from '../services/quotations.service.js';

export const create = asyncHandler(async (req, res) => created(res, await svc.create(req.user, req.body)));
export const list = asyncHandler(async (req, res) => { const { rows, meta } = await svc.list(req.user, req.query); ok(res, rows, meta); });
export const available = asyncHandler(async (req, res) => { const { rows, meta } = await svc.availableJobs(req.user, req.query); ok(res, rows, meta); });
export const get = asyncHandler(async (req, res) => ok(res, await svc.get(req.user, req.params.id)));
export const accept = asyncHandler(async (req, res) => ok(res, await svc.accept(req.user, req.params.id, req.ip)));
export const assign = asyncHandler(async (req, res) => ok(res, await svc.adminAssign(req.user, req.params.id, req.body.technicianId, req.ip)));
export const status = asyncHandler(async (req, res) => ok(res, await svc.technicianStatus(req.user, req.params.id, req.body.status)));
export const cancel = asyncHandler(async (req, res) => ok(res, await svc.cancel(req.user, req.params.id, req.body.reason, req.ip)));
export const inspection = asyncHandler(async (req, res) => ok(res, await svc.saveInspection(req.user, req.params.id, req.body)));
export const complete = asyncHandler(async (req, res) => ok(res, await svc.completeJob(req.user, req.params.id, req.body.completionNotes)));
export const quotationHistory = asyncHandler(async (req, res) => ok(res, await quotes.listForBooking(req.user, req.params.id)));
