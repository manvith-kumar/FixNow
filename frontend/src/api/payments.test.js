import { describe, it, expect } from 'vitest';
import { http } from './client.js';
import { pay } from './payments.js';

const adapter = (status, data) => async (config) => { const res = { data, status, statusText: '', headers: {}, config }; if (status >= 400) { const e = new Error('x'); e.response = res; throw e; } return res; };
describe('payments api', () => {
  it('sends only bookingId and method (never amount or status)', async () => {
    let body; http.defaults.adapter = async (c) => { body = JSON.parse(c.data); return { data: { success: true, data: { outcome: 'SUCCESS', payment: { id: 1 } } }, status: 201, headers: {}, config: c }; };
    const r = await pay(7, 'DEMO_CARD');
    expect(body).toEqual({ bookingId: 7, method: 'DEMO_CARD' }); expect(r.outcome).toBe('SUCCESS');
  });
  it('treats a 402 simulated decline as a normal result and rethrows other errors', async () => {
    http.defaults.adapter = adapter(402, { success: false, data: { outcome: 'FAILED', payment: { status: 'FAILED' } } });
    expect((await pay(7, 'DEMO_FAILING_CARD')).outcome).toBe('FAILED');
    http.defaults.adapter = adapter(409, { success: false, error: { code: 'ALREADY_PAID', message: 'paid' } });
    await expect(pay(7, 'DEMO_CARD')).rejects.toBeTruthy();
  });
});
