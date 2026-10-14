import { useState } from 'react';
import { applicationsApi, catalogueApi } from '../../api/index.js';
import { useToast } from '../../context/ToastContext.jsx';
import { useFetch } from '../../hooks/useFetch.js';
import { useSubmit } from '../../hooks/useSubmit.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { Alert, ApplicationBadge, Async, Button, Card, PageHeader, TextField, TextareaField } from '../../components/ui/index.js';
import { DocumentList } from '../../components/common/DocumentList.jsx';
import { FileRows, rowsError } from '../../components/common/FileRows.jsx';
import { formatDateTime } from '../../utils/format.js';

function ApplyForm({ onDone }) {
  const toast = useToast();
  const services = useFetch(() => catalogueApi.listServices({ pageSize: 100 }));
  const [f, setF] = useState({ fullName: '', phone: '', specialization: '', experienceYears: '', serviceArea: '', bio: '' });
  const [ids, setIds] = useState([]);
  const [rows, setRows] = useState([{ docType: 'ID_DOCUMENT', file: null }]);
  const [errs, setErrs] = useState({});
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = useSubmit(async () => {
    await applicationsApi.submit({ ...f, fullName: f.fullName.trim(), phone: f.phone.trim(), specialization: f.specialization.trim(), serviceArea: f.serviceArea.trim(), bio: f.bio.trim(), experienceYears: Number(f.experienceYears), serviceIds: ids }, rows);
    toast.success('Application submitted. An administrator will review it.'); onDone();
  });
  const go = (e) => {
    e.preventDefault();
    const er = {};
    if (f.fullName.trim().length < 2) er.fullName = 'Enter your full name.';
    if (!/^[+]?[\d\s\-()]{7,20}$/.test(f.phone.trim())) er.phone = 'Enter a valid phone number.';
    if (f.specialization.trim().length < 2) er.specialization = 'Enter your specialization.';
    const y = Number(f.experienceYears); if (f.experienceYears === '' || !Number.isInteger(y) || y < 0 || y > 60) er.experienceYears = 'Enter whole years between 0 and 60.';
    if (f.serviceArea.trim().length < 2) er.serviceArea = 'Enter the area you serve.';
    if (!ids.length) er.serviceIds = 'Select at least one service you can perform.';
    const fr = rowsError(rows, true); if (fr) er.files = fr;
    setErrs(er); if (!Object.keys(er).length) submit.run();
  };
  const fe = (k) => errs[k] || submit.fieldErrors[k];
  const grouped = (services.data ?? []).reduce((m, s) => { (m[s.categoryName] ||= []).push(s); return m; }, {});
  return (
    <form onSubmit={go} noValidate>
      <Card title="Professional details">
        <div className="form-grid">
          <TextField label="Full name" value={f.fullName} onChange={set('fullName')} error={fe('fullName')} required />
          <TextField label="Phone" type="tel" value={f.phone} onChange={set('phone')} error={fe('phone')} required />
          <TextField label="Specialization" value={f.specialization} onChange={set('specialization')} error={fe('specialization')} required hint="For example: plumbing and water heaters" />
          <TextField label="Years of experience" inputMode="numeric" value={f.experienceYears} onChange={set('experienceYears')} error={fe('experienceYears')} required />
          <TextField className="full" label="Service area" value={f.serviceArea} onChange={set('serviceArea')} error={fe('serviceArea')} required hint="Areas or neighbourhoods you can travel to" />
          <TextareaField className="full" label="About you (optional)" value={f.bio} onChange={set('bio')} maxLength={2000} />
        </div>
      </Card>
      <Card title="Services you offer">
        <Async state={services}>
          {() => Object.entries(grouped).map(([cat, list]) => (
            <fieldset key={cat} style={{ border: 0, padding: 0, margin: '0 0 var(--s-4)' }}><legend style={{ fontWeight: 700 }}>{cat}</legend>
              <div className="grid grid-3">{list.map((s) => (
                <label key={s.id} className="check"><input type="checkbox" checked={ids.includes(s.id)} onChange={(e) => setIds(e.target.checked ? [...ids, s.id] : ids.filter((x) => x !== s.id))} /><span>{s.name}</span></label>))}</div>
            </fieldset>))}
        </Async>
        {fe('serviceIds') && <p className="field-error" role="alert">{fe('serviceIds')}</p>}
      </Card>
      <Card title="Documents"><FileRows rows={rows} onChange={setRows} error={fe('files')} />
        <p className="small muted" style={{ marginTop: 'var(--s-3)' }}>Your documents are visible only to you and FixNow administrators.</p></Card>
      {submit.error && <Alert tone="bad">{submit.error}</Alert>}
      <Button type="submit" variant="primary" size="lg" busy={submit.busy} busyLabel="Submitting...">Submit application</Button>
    </form>
  );
}

function AddDocs({ app, onDone }) {
  const toast = useToast();
  const [rows, setRows] = useState([{ docType: 'CERTIFICATE', file: null }]);
  const [err, setErr] = useState('');
  const submit = useSubmit(async () => { await applicationsApi.addDocuments(app.id, rows); toast.success('Documents sent. Your application is back under review.'); onDone(); });
  return (
    <Card title="Send the requested information">
      <FileRows rows={rows} onChange={setRows} error={err} />
      {submit.error && <Alert tone="bad">{submit.error}</Alert>}
      <Button variant="primary" style={{ marginTop: 'var(--s-3)' }} busy={submit.busy} onClick={() => { const e = rowsError(rows, false); setErr(e); if (!e) submit.run(); }}>Send documents</Button>
    </Card>
  );
}

export default function Application() {
  useDocumentTitle('My application');
  const mine = useFetch(() => applicationsApi.mine());
  return (
    <>
      <PageHeader title="Technician application" subtitle="An administrator reviews every application. You can accept jobs only after approval." />
      <Async state={mine} isEmpty={() => false}>
        {({ current, history }) => {
          const canApply = !current || current.status === 'REJECTED';
          return (
            <>
              {current && (
                <Card title="Your application" actions={<ApplicationBadge status={current.status} />}>
                  {current.status === 'APPROVED' && <Alert tone="ok" title="You are approved">You can now accept jobs for the services on your profile.</Alert>}
                  {current.status === 'SUBMITTED' && <Alert tone="info">Submitted {formatDateTime(current.submittedAt)}. We will notify you when a decision is made.</Alert>}
                  {current.status === 'NEEDS_INFO' && <Alert tone="warn" title="More information needed">{current.reviewNotes}</Alert>}
                  {current.status === 'REJECTED' && <Alert tone="bad" title="Not approved">{current.reviewNotes}. You can submit a new application below.</Alert>}
                  <p className="small muted">{current.fullName}, {current.specialization}, {current.experienceYears} years, {current.serviceArea}</p>
                  <h3 style={{ fontSize: '1.05rem' }}>Documents</h3>
                  <DocumentList applicationId={current.id} documents={current.documents} />
                </Card>
              )}
              {current?.status === 'NEEDS_INFO' && <AddDocs app={current} onDone={mine.reload} />}
              {canApply && <ApplyForm onDone={mine.reload} />}
              {history.length > 1 && <Card title="Previous applications"><ul>{history.slice(1).map((h) => <li key={h.id}>{formatDateTime(h.submitted_at)}: <ApplicationBadge status={h.status} />{h.review_notes ? ` ${h.review_notes}` : ''}</li>)}</ul></Card>}
            </>
          );
        }}
      </Async>
    </>
  );
}
