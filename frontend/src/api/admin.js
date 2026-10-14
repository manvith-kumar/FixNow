import { get, put, http } from './client.js';
export const dashboard = () => get('/admin/dashboard');
export const reportTypes = () => get('/admin/reports');
export const report = (type, params) => get(`/admin/reports/${type}`, params);
export async function reportCsv(type, params) {
  const res = await http.get(`/admin/reports/${type}`, { params: { ...params, format: 'csv' }, responseType: 'blob' });
  return res.data;
}
export const getSettings = () => get('/admin/settings');
export const updateSettings = (values) => put('/admin/settings', { values });
export const auditLogs = (params) => get('/admin/audit-logs', params);
export const publicSettings = () => get('/settings/public');
