import { get, post, patch, del } from './client.js';
export const list = () => get('/addresses');
export const create = (body) => post('/addresses', body);
export const update = (id, body) => patch(`/addresses/${id}`, body);
export const setDefault = (id) => post(`/addresses/${id}/default`);
export const remove = (id) => del(`/addresses/${id}`);
