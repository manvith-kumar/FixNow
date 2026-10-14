import { useEffect, useState } from 'react';
import { adminApi } from '../../api/index.js';
import { useToast } from '../../context/ToastContext.jsx';
import { useFetch } from '../../hooks/useFetch.js';
import { useSubmit } from '../../hooks/useSubmit.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { Alert, Async, Button, Card, PageHeader, TextField } from '../../components/ui/index.js';

const FIELDS = [
  { key: 'platform_name', label: 'Platform name', hint: '2 to 60 characters.' },
  { key: 'support_email', label: 'Support email', type: 'email', hint: 'Shown on the Contact page.' },
  { key: 'currency', label: 'Currency code (informational)', hint: 'Not used for calculations: quotations and simulated payments are recorded and shown in INR in this release.' },
  { key: 'default_tax_rate', label: 'Default tax rate (%)', hint: 'Suggested when technicians create quotations. 0 to 30.' },
  { key: 'quotation_validity_days', label: 'Quotation validity (days)', hint: 'How long a new quotation stays valid. 1 to 90.' },
];
export default function Settings() {
  useDocumentTitle('Settings');
  const toast = useToast();
  const s = useFetch(() => adminApi.getSettings());
  const [v, setV] = useState({});
  useEffect(() => { if (s.data) setV(Object.fromEntries(s.data.map((x) => [x.key, x.value]))); }, [s.data]);
  const save = useSubmit(async () => { const res = await adminApi.updateSettings(v); s.setData(res.data); toast.success('Settings saved.'); });
  return (
    <>
      <PageHeader title="System settings" subtitle="Only the settings the system supports are listed. Changes are recorded in the audit log." />
      <Async state={s} isEmpty={() => false}>
        {() => (
          <Card>
            <form onSubmit={(e) => { e.preventDefault(); save.run(); }} noValidate style={{ maxWidth: '34rem' }}>
              {FIELDS.map((f) => <TextField key={f.key} label={f.label} type={f.type} hint={f.hint} value={v[f.key] ?? ''} onChange={(e) => setV({ ...v, [f.key]: e.target.value })} />)}
              {save.error && <Alert tone="bad">{save.error}</Alert>}
              <Button type="submit" variant="primary" busy={save.busy}>Save settings</Button>
            </form>
          </Card>
        )}
      </Async>
    </>
  );
}
