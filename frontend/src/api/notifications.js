import { get, post } from './client.js';
export const list = (params) => get('/notifications', params);
export const markRead = (id) => post(`/notifications/${id}/read`);
export const markAllRead = () => post('/notifications/read-all');
