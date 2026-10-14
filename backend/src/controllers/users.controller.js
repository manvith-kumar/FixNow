import { asyncHandler, ok } from '../utils/http.js';
import * as svc from '../services/users.service.js';

export const updateMe = asyncHandler(async (req, res) => ok(res, await svc.updateMe(req.user.id, req.body)));
export const list = asyncHandler(async (req, res) => { const { rows, meta } = await svc.adminList(req.query); ok(res, rows, meta); });
export const get = asyncHandler(async (req, res) => ok(res, await svc.adminGet(req.params.id)));
export const setStatus = asyncHandler(async (req, res) => ok(res, await svc.adminSetStatus(req.user, req.params.id, req.body.status, req.ip)));
