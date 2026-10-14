import { get, post } from './client.js';
/** body: { bookingId, items:[{itemType,description,quantity,unitPrice}], discountAmount?, taxRate?, notes?, revisionNotes?, validUntil? }. No totals: the server calculates them. */
export const create = (body) => post('/quotations', body);
export const forBooking = (bookingId) => get('/quotations', { bookingId });
export const adminList = (params) => get('/quotations', params);
export const getOne = (id) => get(`/quotations/${id}`);
export const approve = (id) => post(`/quotations/${id}/approve`);
export const reject = (id, reason) => post(`/quotations/${id}/reject`, { reason });
