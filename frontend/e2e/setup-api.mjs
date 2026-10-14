// Fast state setup for browser tests: talks to the backend API directly (not through the UI).
export function createSetupApi(API) {
  const call = async (p, { method = 'GET', token, body } = {}) => {
    const r = await fetch(API + p, { method, headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
    const j = await r.json().catch(() => null);
    if (!r.ok) { const e = new Error(`${method} ${p} -> ${r.status} ${JSON.stringify(j?.error ?? j)}`); e.status = r.status; e.code = j?.error?.code; throw e; }
    return j;
  };
  const stamp = Date.now(); let n = 0;
  const uniq = (prefix) => `${prefix}.${stamp}.${n++}@t.dev`;
  const login = async (email, password = 'Password@123') => (await call('/auth/login', { method: 'POST', body: { email, password } })).data;
  const register = async (role, name) => { const email = uniq(role.toLowerCase().slice(0, 4)); const d = (await call('/auth/register', { method: 'POST', body: { email, password: 'Secret123', fullName: name, role } })).data; return { ...d, email, password: 'Secret123' }; };
  const futureDate = (d = 2) => new Date(Date.now() + d * 864e5).toISOString().slice(0, 10);
  async function submitApplication(token, serviceIds, name = 'Setup Tech') {
    const fd = new FormData();
    const f = { fullName: name, phone: '+911234567890', specialization: 'Plumbing', experienceYears: '4', serviceArea: 'Guntur', serviceIds: JSON.stringify(serviceIds), docTypes: 'ID_DOCUMENT' };
    for (const [k, v] of Object.entries(f)) fd.append(k, v);
    fd.append('documents', new Blob([Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF')], { type: 'application/pdf' }), 'id.pdf');
    const r = await fetch(API + '/technician-applications', { method: 'POST', headers: { authorization: `Bearer ${token}` }, body: fd });
    const j = await r.json(); if (!r.ok) throw new Error(`application failed ${JSON.stringify(j)}`); return j.data;
  }
  async function approvedTechnician(adminToken, serviceIds, name = 'Setup Tech') {
    const t = await register('TECHNICIAN', name); const app = await submitApplication(t.token, serviceIds, name);
    await call(`/technician-applications/${app.id}/decision`, { method: 'POST', token: adminToken, body: { decision: 'APPROVE' } });
    const profile = (await call('/technicians/me', { token: t.token })).data; return { ...t, profileId: profile.id };
  }
  async function customerWithAddress(name = 'Setup Customer') {
    const c = await register('CUSTOMER', name);
    const addr = (await call('/addresses', { method: 'POST', token: c.token, body: { label: 'Home', line1: '5 Setup Street', city: 'Guntur' } })).data;
    return { ...c, address: addr };
  }
  const book = async (c, serviceId, extra = {}) => (await call('/bookings', { method: 'POST', token: c.token, body: { serviceId, addressId: c.address.id, problemDescription: 'Setup booking: the tap leaks badly', preferredDate: futureDate(), preferredTime: '10:00', ...extra } })).data;
  const items = [{ itemType: 'LABOUR', description: 'Setup labour', quantity: '1', unitPrice: '500.00' }];
  /** Drive a booking to the requested state with API calls. States: PENDING, ASSIGNED, QUOTATION_SENT, QUOTATION_APPROVED, IN_PROGRESS, COMPLETED, PAID */
  async function jobAt(state, { customer, tech, serviceId }) {
    const b = await book(customer, serviceId); if (state === 'PENDING') return b;
    await call(`/bookings/${b.id}/accept`, { method: 'POST', token: tech.token }); if (state === 'ASSIGNED') return b;
    await call(`/bookings/${b.id}/inspection`, { method: 'POST', token: tech.token, body: { diagnosis: 'Setup diagnosis', observedCondition: 'Setup condition' } });
    const q = (await call('/quotations', { method: 'POST', token: tech.token, body: { bookingId: b.id, items, taxRate: '0' } })).data; if (state === 'QUOTATION_SENT') return { ...b, quotationId: q.id };
    await call(`/quotations/${q.id}/approve`, { method: 'POST', token: customer.token }); if (state === 'QUOTATION_APPROVED') return { ...b, quotationId: q.id };
    await call(`/bookings/${b.id}/status`, { method: 'POST', token: tech.token, body: { status: 'IN_PROGRESS' } }); if (state === 'IN_PROGRESS') return { ...b, quotationId: q.id };
    await call(`/bookings/${b.id}/complete`, { method: 'POST', token: tech.token, body: { completionNotes: 'Setup completion' } }); if (state === 'COMPLETED') return { ...b, quotationId: q.id };
    await call('/payments', { method: 'POST', token: customer.token, body: { bookingId: b.id, method: 'DEMO_CARD' } }); return { ...b, quotationId: q.id };
  }
  return { call, login, register, submitApplication, approvedTechnician, customerWithAddress, book, jobAt, futureDate, uniq };
}
