import { useEffect, useState } from 'react';
import { catalogueApi, techniciansApi } from '../../api/index.js';
import { useToast } from '../../context/ToastContext.jsx';
import { useFetch } from '../../hooks/useFetch.js';
import { useSubmit } from '../../hooks/useSubmit.js';
import { Alert, ApplicationBadge, Async, Button, Card, TextField, TextareaField } from '../../components/ui/index.js';
import ProfilePage from '../shared/ProfilePage.jsx';

function Professional() {
  const toast = useToast();
  const me = useFetch(() => techniciansApi.getMe());
  const services = useFetch(() => catalogueApi.listServices({ pageSize: 100 }));
  const [f, setF] = useState({ specialization: '', experienceYears: '', serviceArea: '', bio: '' });
  const [ids, setIds] = useState([]);
  useEffect(() => { if (me.data) { setF({ specialization: me.data.specialization ?? '', experienceYears: String(me.data.experienceYears ?? ''), serviceArea: me.data.serviceArea ?? '', bio: me.data.bio ?? '' }); setIds(me.data.services.map((s) => s.id)); } }, [me.data]);
  const approved = me.data?.approvalStatus === 'APPROVED';
  const save = useSubmit(async () => {
    const body = { specialization: f.specialization.trim(), serviceArea: f.serviceArea.trim(), experienceYears: Number(f.experienceYears) };
    if (f.bio.trim()) body.bio = f.bio.trim();
    if (approved) body.serviceIds = ids;
    await techniciansApi.updateMe(body); toast.success('Professional profile saved.'); me.reload();
  });
  return (
    <Async state={me} isEmpty={() => false}>
      {(p) => (
        <Card title="Professional profile" actions={<ApplicationBadge status={p.approvalStatus} />}>
          <form onSubmit={(e) => { e.preventDefault(); save.run(); }} noValidate>
            <div className="form-grid">
              <TextField label="Specialization" value={f.specialization} onChange={(e) => setF({ ...f, specialization: e.target.value })} error={save.fieldErrors.specialization} />
              <TextField label="Years of experience" inputMode="numeric" value={f.experienceYears} onChange={(e) => setF({ ...f, experienceYears: e.target.value })} error={save.fieldErrors.experienceYears} />
              <TextField className="full" label="Service area" value={f.serviceArea} onChange={(e) => setF({ ...f, serviceArea: e.target.value })} error={save.fieldErrors.serviceArea} />
              <TextareaField className="full" label="About you" value={f.bio} onChange={(e) => setF({ ...f, bio: e.target.value })} maxLength={2000} />
            </div>
            <div className="field"><span className="label">Services you offer</span>
              {approved ? <div className="grid grid-3">{(services.data ?? []).map((s) => <label key={s.id} className="check"><input type="checkbox" checked={ids.includes(s.id)} onChange={(e) => setIds(e.target.checked ? [...ids, s.id] : ids.filter((x) => x !== s.id))} /><span>{s.name}</span></label>)}</div>
                : <p className="muted small">You can edit your services after your application is approved. Current: {p.services.map((s) => s.name).join(', ') || 'none'}.</p>}</div>
            {save.error && <Alert tone="bad">{save.error}</Alert>}
            <Button type="submit" variant="primary" busy={save.busy} disabled={!p.userId}>Save professional profile</Button>
          </form>
        </Card>
      )}
    </Async>
  );
}
export default function TechnicianProfile() { return <><ProfilePage /><div style={{ marginTop: 'var(--s-4)' }}><Professional /></div></>; }
