import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { addressesApi, bookingsApi, catalogueApi } from '../../api/index.js';
import { useToast } from '../../context/ToastContext.jsx';
import { useFetch } from '../../hooks/useFetch.js';
import { useSubmit } from '../../hooks/useSubmit.js';
import { useGeolocation } from '../../hooks/useGeolocation.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { Alert, Button, Card, EmptyState, LoadingState, PageHeader, SelectField, TextField, TextareaField } from '../../components/ui/index.js';
import { AddressForm } from '../../components/common/AddressForm.jsx';
import { addDaysIso, formatMoney, todayIso } from '../../utils/format.js';

export default function BookService() {
  useDocumentTitle('Book a service');
  const [sp] = useSearchParams();
  const nav = useNavigate();
  const toast = useToast();
  const services = useFetch(() => catalogueApi.listServices({ pageSize: 100 }));
  const addresses = useFetch(() => addressesApi.list());
  const [f, setF] = useState({ serviceId: sp.get('serviceId') ?? '', problem: '', addressId: '', date: addDaysIso(1), time: '10:00' });
  const [errs, setErrs] = useState({});
  const [addOpen, setAddOpen] = useState(false);
  const geo = useGeolocation();
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const svc = useMemo(() => (services.data ?? []).find((s) => String(s.id) === String(f.serviceId)), [services.data, f.serviceId]);
  const defaultAddr = addresses.data?.find((a) => a.isDefault)?.id ?? addresses.data?.[0]?.id;
  const addressId = f.addressId || (defaultAddr ? String(defaultAddr) : '');

  const submit = useSubmit(async () => {
    const body = { serviceId: Number(f.serviceId), addressId: Number(addressId), problemDescription: f.problem.trim(), preferredDate: f.date, preferredTime: f.time };
    if (geo.coords) Object.assign(body, geo.coords);
    const res = await bookingsApi.create(body);
    toast.success(`Booking ${res.data.reference} created.`);
    nav(`/customer/bookings/${res.data.id}`, { replace: true });
  });
  const go = (e) => {
    e.preventDefault();
    const er = {};
    if (!f.serviceId) er.serviceId = 'Choose a service.';
    if (f.problem.trim().length < 10) er.problem = 'Describe the problem in at least 10 characters.';
    if (!addressId) er.addressId = 'Add or choose an address.';
    if (!f.date || f.date < todayIso()) er.date = 'Choose today or a later date.';
    if (f.date > addDaysIso(90)) er.date = 'Choose a date within the next 90 days.';
    if (!f.time) er.time = 'Choose a time.';
    setErrs(er); if (!Object.keys(er).length) submit.run();
  };
  const fe = (k) => errs[k] || submit.fieldErrors[k];

  if ((services.loading && !services.data) || (addresses.loading && !addresses.data)) return <LoadingState />;
  return (
    <>
      <PageHeader title="Book a service" subtitle="A technician will inspect first. You approve the itemized quote before any work starts." />
      <form onSubmit={go} noValidate>
        <div className="detail-grid">
          <div>
            <Card title="1. What needs fixing?">
              <SelectField label="Service" value={f.serviceId} onChange={set('serviceId')} placeholder="Choose a service" error={fe('serviceId')} required options={(services.data ?? []).map((s) => ({ value: s.id, label: `${s.categoryName}: ${s.name}` }))} />
              {svc && <p className="small muted">{svc.description} {svc.indicativeStartingPrice && <>Indicative starting price {formatMoney(svc.indicativeStartingPrice)}. {svc.priceDisclaimer}</>}</p>}
              <TextareaField label="Describe the problem" value={f.problem} onChange={set('problem')} error={fe('problem') || fe('problemDescription')} required maxLength={2000} hint="What is happening, where, and since when?" />
            </Card>
            <Card title="2. Where?">
              {addresses.data?.length ? (
                <div className="stack" role="radiogroup" aria-label="Address">
                  {addresses.data.map((a) => (
                    <label className="pick" key={a.id}><input type="radio" name="address" checked={String(a.id) === addressId} onChange={() => setF({ ...f, addressId: String(a.id) })} /><strong>{a.label}</strong>{a.isDefault && <span className="muted small"> (default)</span>}<span style={{ display: 'block', marginLeft: '1.6rem' }} className="small">{[a.line1, a.line2, a.city, a.state, a.postalCode].filter(Boolean).join(', ')}</span></label>
                  ))}
                </div>
              ) : <EmptyState title="No saved address yet">Add the address where the work is needed.</EmptyState>}
              {fe('addressId') && <p className="field-error" role="alert">{fe('addressId')}</p>}
              <div className="row" style={{ marginTop: 'var(--s-3)' }}><Button size="sm" onClick={() => setAddOpen(true)}>Add a new address</Button><Link to="/customer/addresses" className="small">Manage addresses</Link></div>
              <div className="field" style={{ marginTop: 'var(--s-4)' }}>
                <span className="label">Share your exact location (optional)</span>
                <div className="row"><Button size="sm" onClick={geo.request} busy={geo.loading} busyLabel="Locating...">Use my current location</Button>{geo.coords && <Button size="sm" variant="ghost" onClick={geo.clear}>Remove</Button>}</div>
                {geo.coords && <span className="hint">Will be sent with this booking: {geo.coords.latitude}, {geo.coords.longitude}</span>}
                {geo.error && <span className="hint">{geo.error}</span>}
                {!geo.coords && !geo.error && <span className="hint">Your browser will ask for permission. Booking works without it.</span>}
              </div>
            </Card>
            <Card title="3. When?">
              <div className="form-grid">
                <TextField label="Preferred date" type="date" min={todayIso()} max={addDaysIso(90)} value={f.date} onChange={set('date')} error={fe('date') || fe('preferredDate')} required />
                <TextField label="Preferred time" type="time" value={f.time} onChange={set('time')} error={fe('time') || fe('preferredTime')} required />
              </div>
            </Card>
          </div>
          <div>
            <Card title="Before you book">
              <ul className="small stack" style={{ paddingLeft: '1.1rem' }}>
                <li>There is no charge for booking. You pay only after the work is done.</li>
                <li>You will get an itemized quotation after the inspection and can approve or reject it.</li>
                <li>Catalogue prices are indicative, not final.</li>
              </ul>
              {submit.error && <Alert tone="bad">{submit.error}</Alert>}
              <Button type="submit" variant="primary" block size="lg" busy={submit.busy} busyLabel="Creating booking...">Book inspection</Button>
            </Card>
          </div>
        </div>
      </form>
      {addOpen && <AddressForm open onClose={() => setAddOpen(false)} onSaved={(a) => { setAddOpen(false); addresses.reload(); setF((x) => ({ ...x, addressId: String(a.id) })); toast.success('Address saved.'); }} />}
    </>
  );
}
