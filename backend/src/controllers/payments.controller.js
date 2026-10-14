import { asyncHandler, ok } from '../utils/http.js';
import * as svc from '../services/payments.service.js';

export const pay = asyncHandler(async (req, res) => {
  const result = await svc.pay(req.user, req.body);
  // A declined simulated payment is persisted as a FAILED attempt and reported with 402.
  res.status(result.outcome === 'SUCCESS' ? 201 : 402).json({ success: result.outcome === 'SUCCESS', data: result });
});
export const get = asyncHandler(async (req, res) => ok(res, await svc.get(req.user, req.params.id)));
export const list = asyncHandler(async (req, res) => { const { rows, meta } = await svc.list(req.user, req.query); ok(res, rows, meta); });
