import { get, put, patch } from './client.js';
export const getMe = () => get('/technicians/me');
export const updateMe = (body) => patch('/technicians/me', body);
export const earnings = () => get('/technicians/me/earnings');
export const adminList = (params) => get('/technicians', params);
export const adminGet = (id) => get(`/technicians/${id}`);
export const adminSetActive = (id, isActive) => patch(`/technicians/${id}/active`, { isActive });
export const getAvailability = () => get('/availability');
export const setAvailability = (slots) => put('/availability', { slots });
