import { asyncHandler, ok } from '../utils/http.js';
import * as svc from '../services/technicians.service.js';

export const getMe = asyncHandler(async (req, res) => ok(res, await svc.getMe(req.user.id)));
export const updateMe = asyncHandler(async (req, res) => ok(res, await svc.updateMe(req.user.id, req.body)));
export const earnings = asyncHandler(async (req, res) => ok(res, await svc.earnings(req.user.id)));
export const adminList = asyncHandler(async (req, res) => { const { rows, meta } = await svc.adminList(req.query); ok(res, rows, meta); });
export const adminGet = asyncHandler(async (req, res) => ok(res, await svc.adminGet(req.params.id)));
export const adminSetActive = asyncHandler(async (req, res) => ok(res, await svc.adminSetActive(req.user, req.params.id, req.body.isActive, req.ip)));
export const getAvailability = asyncHandler(async (req, res) => ok(res, await svc.getAvailability(req.user.id)));
export const setAvailability = asyncHandler(async (req, res) => ok(res, await svc.setAvailability(req.user.id, req.body.slots)));
