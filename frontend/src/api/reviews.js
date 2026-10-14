import { get, post, patch } from './client.js';
export const publicList = (params) => get('/reviews', params);
export const create = (body) => post('/reviews', body);
export const mine = (params) => get('/reviews/mine', params);
export const adminList = (params) => get('/reviews/admin', params);
export const moderate = (id, status, note) => patch(`/reviews/${id}/moderation`, { status, ...(note ? { note } : {}) });
