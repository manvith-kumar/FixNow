import { get, post, patch } from './client.js';
export const listCategories = (params) => get('/categories', params);
export const createCategory = (body) => post('/categories', body);
export const updateCategory = (id, body) => patch(`/categories/${id}`, body);
export const listServices = (params) => get('/services', params);
export const getService = (id) => get(`/services/${id}`);
export const createService = (body) => post('/services', body);
export const updateService = (id, body) => patch(`/services/${id}`, body);
