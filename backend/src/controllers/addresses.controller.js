import { asyncHandler, ok, created } from '../utils/http.js';
import * as svc from '../services/addresses.service.js';

export const list = asyncHandler(async (req, res) => ok(res, await svc.list(req.user.id)));
export const create = asyncHandler(async (req, res) => created(res, await svc.create(req.user.id, req.body)));
export const update = asyncHandler(async (req, res) => ok(res, await svc.update(req.user.id, req.params.id, req.body)));
export const remove = asyncHandler(async (req, res) => ok(res, await svc.remove(req.user.id, req.params.id)));
export const setDefault = asyncHandler(async (req, res) => ok(res, await svc.setDefault(req.user.id, req.params.id)));
