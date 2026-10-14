import { useState } from 'react';
import { bookingsApi } from '../../api/index.js';
import { useSubmit } from '../../hooks/useSubmit.js';
import { Alert, Button, Modal, TextareaField } from '../ui/index.js';

export function InspectionForm({ open, onClose, booking, onSaved }) {
  const i = booking.inspection ?? {};
  const [f, setF] = useState({ diagnosis: i.diagnosis ?? '', observedCondition: i.observedCondition ?? '', labourNotes: i.labourNotes ?? '', requiredParts: i.requiredParts ?? '', additionalWork: i.additionalWork ?? '', notes: i.notes ?? '' });
  const [errs, setErrs] = useState({});
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = useSubmit(async () => {
    const body = { diagnosis: f.diagnosis.trim(), observedCondition: f.observedCondition.trim() };
    for (const k of ['labourNotes', 'requiredParts', 'additionalWork', 'notes']) if (f[k].trim()) body[k] = f[k].trim();
    onSaved((await bookingsApi.saveInspection(booking.id, body)).data);
  });
  const go = () => {
    const e = {};
    if (f.diagnosis.trim().length < 3) e.diagnosis = 'Enter your diagnosis.';
    if (f.observedCondition.trim().length < 3) e.observedCondition = 'Describe what you observed.';
    setErrs(e);
    if (!Object.keys(e).length) submit.run();
  };
  const fe = (k) => errs[k] || submit.fieldErrors[k];
  return (
    <Modal open={open} onClose={onClose} wide title="Inspection findings"
      footer={<><Button onClick={onClose} disabled={submit.busy}>Cancel</Button><Button variant="primary" busy={submit.busy} onClick={go}>Save inspection</Button></>}>
      <p className="muted small">Saving marks the inspection as complete and lets you send a quotation.</p>
      {submit.error && <Alert tone="bad">{submit.error}</Alert>}
      <TextareaField label="Diagnosis" value={f.diagnosis} onChange={set('diagnosis')} error={fe('diagnosis')} required maxLength={3000} />
      <TextareaField label="Observed condition" value={f.observedCondition} onChange={set('observedCondition')} error={fe('observedCondition')} required maxLength={3000} />
      <div className="form-grid">
        <TextareaField label="Labour notes" value={f.labourNotes} onChange={set('labourNotes')} maxLength={3000} />
        <TextareaField label="Parts or materials needed" value={f.requiredParts} onChange={set('requiredParts')} maxLength={3000} />
        <TextareaField label="Additional work" value={f.additionalWork} onChange={set('additionalWork')} maxLength={3000} />
        <TextareaField label="Other notes" value={f.notes} onChange={set('notes')} maxLength={3000} />
      </div>
    </Modal>
  );
}
