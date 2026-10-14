import { get, http } from './client.js';
export const list = (params) => get('/payments', params);
export const getOne = (id) => get(`/payments/${id}`);
/**
 * SIMULATED payment. Resolves to { outcome: 'SUCCESS'|'FAILED', payment } for both 201 (paid) and 402 (declined demo attempt).
 * Other errors (409 already paid, 404, ...) are thrown.
 */
export async function pay(bookingId, method) {
  try {
    const res = await http.post('/payments', { bookingId, method });
    return res.data.data;
  } catch (err) {
    if (err.response?.status === 402 && err.response.data?.data) return err.response.data.data;
    throw err;
  }
}
