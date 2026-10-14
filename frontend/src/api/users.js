import { get, patch } from './client.js';
export const updateMe = (body) => patch('/users/me', body);
export const list = (params) => get('/users', params);
export const getOne = (id) => get(`/users/${id}`);
export const setStatus = (id, status) => patch(`/users/${id}/status`, { status });
