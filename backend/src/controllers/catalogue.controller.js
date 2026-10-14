import { asyncHandler, ok, created } from '../utils/http.js';
import * as svc from '../services/catalogue.service.js';

const isAdmin = (req) => req.user?.role === 'ADMIN';
export const listCategories = asyncHandler(async (req, res) => ok(res, await svc.listCategories({ activeOnly: !(isAdmin(req) && req.query.all), q: req.query.q })));
export const createCategory = asyncHandler(async (req, res) => created(res, await svc.createCategory(req.user, req.body, req.ip)));
export const updateCategory = asyncHandler(async (req, res) => ok(res, await svc.updateCategory(req.user, req.params.id, req.body, req.ip)));
export const listServices = asyncHandler(async (req, res) => {
  const { rows, meta } = await svc.listServices(req.query, { adminView: isAdmin(req) && req.query.all === true });
  ok(res, rows, meta);
});
export const getService = asyncHandler(async (req, res) => ok(res, await svc.getService(req.params.id, { adminView: isAdmin(req) })));
export const createService = asyncHandler(async (req, res) => created(res, await svc.createService(req.user, req.body, req.ip)));
export const updateService = asyncHandler(async (req, res) => ok(res, await svc.updateService(req.user, req.params.id, req.body, req.ip)));
