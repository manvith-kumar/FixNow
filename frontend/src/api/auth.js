import { get, post } from './client.js';
export const register = (body) => post('/auth/register', body);
export const login = (body) => post('/auth/login', body);
export const logout = () => post('/auth/logout');
export const me = () => get('/auth/me');
export const forgotPassword = (email) => post('/auth/forgot-password', { email });
export const resetPassword = (token, password) => post('/auth/reset-password', { token, password });
export const changePassword = (body) => post('/auth/change-password', body);
