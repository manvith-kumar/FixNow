import { useState } from 'react';
import { addressesApi } from '../../api/index.js';
import { useSubmit } from '../../hooks/useSubmit.js';
import { useGeolocation } from '../../hooks/useGeolocation.js';
import { Alert, Button, CheckField, Modal, TextField } from '../ui/index.js';

export function AddressForm({ open, onClose, address, onSaved }) {
  const [f, setF] = useState({ label: address?.label ?? 'Home', line1: address?.line1 ?? '', line2: address?.line2 ?? '', city: address?.city ?? '', state: address?.state ?? '', postalCode: address?.postalCode ?? '', country: address?.country ?? 'India', isDefault: address?.isDefault ?? false });
  const [coords, setCoords] = useState(address?.latitude != null ? { latitude: address.latitude, longitude: address.longitude } : null);
  const [errs, setErrs] = useState({});
  const geo = useGeolocation();
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const submit = useSubmit(async () => {
    const body = { label: f.label.trim(), line1: f.line1.trim(), city: f.city.trim(), country: f.country.trim(), isDefault: f.isDefault };
    if (address) { Object.assign(body, { line2: f.line2.trim() || null, state: f.state.trim() || null, postalCode: f.postalCode.trim() || null, latitude: coords?.latitude ?? null, longitude: coords?.longitude ?? null }); }
    else { if (f.line2.trim()) body.line2 = f.line2.trim(); if (f.state.trim()) body.state = f.state.trim(); if (f.postalCode.trim()) body.postalCode = f.postalCode.trim(); if (coords) Object.assign(body, coords); }
    const res = address ? await addressesApi.update(address.id, body) : await addressesApi.create(body);
    onSaved(res.data);
  });
  const go = () => {
    const e = {};
    if (!f.label.trim()) e.label = 'Give the address a label.';
    if (f.line1.trim().length < 3) e.line1 = 'Enter the street address.';
    if (f.city.trim().length < 2) e.city = 'Enter the city.';
    if (f.country.trim().length < 2) e.country = 'Enter the country.';
    setErrs(e); if (!Object.keys(e).length) submit.run();
  };
  const useGeo = () => { geo.request(); };
  const shown = geo.coords ?? coords;
  const fe = (k) => errs[k] || submit.fieldErrors[k];
  return (
    <Modal open={open} onClose={onClose} title={address ? 'Edit address' : 'Add an address'} footer={<><Button onClick={onClose} disabled={submit.busy}>Cancel</Button><Button variant="primary" busy={submit.busy} onClick={() => { if (geo.coords) setCoords(geo.coords); go(); }}>Save address</Button></>}>
      <div className="form-grid">
        <TextField label="Label" value={f.label} onChange={set('label')} error={fe('label')} required />
        <TextField label="Country" value={f.country} onChange={set('country')} error={fe('country')} required />
        <TextField className="full" label="Address line 1" value={f.line1} onChange={set('line1')} error={fe('line1')} required autoComplete="address-line1" />
        <TextField className="full" label="Address line 2 (optional)" value={f.line2} onChange={set('line2')} autoComplete="address-line2" />
        <TextField label="City" value={f.city} onChange={set('city')} error={fe('city')} required />
        <TextField label="State" value={f.state} onChange={set('state')} />
        <TextField label="Postal code" value={f.postalCode} onChange={set('postalCode')} />
      </div>
      <div className="field">
        <span className="label">Location (optional)</span>
        <div className="row">
          <Button size="sm" onClick={useGeo} busy={geo.loading} busyLabel="Locating...">Use my current location</Button>
          {shown && <Button size="sm" variant="ghost" onClick={() => { geo.clear(); setCoords(null); }}>Remove</Button>}
        </div>
        {shown && <span className="hint">Saved coordinates: {shown.latitude}, {shown.longitude}</span>}
        {geo.error && <span className="hint">{geo.error}</span>}
      </div>
      <CheckField label="Make this my default address" checked={f.isDefault} onChange={set('isDefault')} />
      {submit.error && <Alert tone="bad">{submit.error}</Alert>}
    </Modal>
  );
}
