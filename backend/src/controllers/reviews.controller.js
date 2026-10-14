import { asyncHandler, ok, created } from '../utils/http.js';
import * as svc from '../services/reviews.service.js';

export const create = asyncHandler(async (req, res) => created(res, await svc.create(req.user, req.body)));
export const publicList = asyncHandler(async (req, res) => { const { rows, meta } = await svc.publicList(req.query); ok(res, rows, meta); });
export const mine = asyncHandler(async (req, res) => { const { rows, meta } = await svc.mine(req.user, req.query); ok(res, rows, meta); });
export const adminList = asyncHandler(async (req, res) => { const { rows, meta } = await svc.adminList(req.query); ok(res, rows, meta); });
export const moderate = asyncHandler(async (req, res) => ok(res, await svc.moderate(req.user, req.params.id, req.body, req.ip)));
