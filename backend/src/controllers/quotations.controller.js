import { asyncHandler, ok, created } from '../utils/http.js';
import * as svc from '../services/quotations.service.js';

export const create = asyncHandler(async (req, res) => created(res, await svc.create(req.user, req.body)));
export const get = asyncHandler(async (req, res) => ok(res, await svc.get(req.user, req.params.id)));
export const approve = asyncHandler(async (req, res) => ok(res, await svc.approve(req.user, req.params.id)));
export const reject = asyncHandler(async (req, res) => ok(res, await svc.reject(req.user, req.params.id, req.body.reason)));
export const list = asyncHandler(async (req, res) => {
  if (req.query.bookingId) return ok(res, await svc.listForBooking(req.user, req.query.bookingId));
  const { rows, meta } = await svc.adminList(req.query); ok(res, rows, meta);
});
