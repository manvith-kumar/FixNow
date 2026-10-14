import { useState } from 'react';
import { adminApi } from '../../api/index.js';
import { useToast } from '../../context/ToastContext.jsx';
import { useFetch } from '../../hooks/useFetch.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { Alert, Async, Button, Card, PageHeader, SelectField, SimulatedBanner, TextField, TableWrap } from '../../components/ui/index.js';
import { addDaysIso, todayIso } from '../../utils/format.js';
import { saveBlob } from '../../utils/download.js';
import { getErrorMessage } from '../../utils/errors.js';

const LABELS = { 'booking-volume': 'Booking volume by date and status', 'service-demand': 'Service and category demand', 'technician-workload': 'Technician workload', 'completed-cancelled': 'Completed and cancelled bookings', 'quotation-rates': 'Quotation approval and rejection rates', 'payments-summary': 'Simulated payment summary' };

export default function Reports() {
  useDocumentTitle('Reports');
  const toast = useToast();
  const [type, setType] = useState('booking-volume');
  const [from, setFrom] = useState(addDaysIso(-29));
  const [to, setTo] = useState(todayIso());
  const [busy, setBusy] = useState(false);
  const bad = from > to;
  const rep = useFetch(() => adminApi.report(type, { from, to }), [type, from, to], { enabled: !bad });
  const csv = async () => { setBusy(true); try { saveBlob(await adminApi.reportCsv(type, { from, to }), `fixnow-${type}-${from}_${to}.csv`); } catch (e) { toast.error(getErrorMessage(e)); } finally { setBusy(false); } };
  return (
    <>
      <PageHeader title="Reports" subtitle="Dates are UTC calendar days, applied to the date each record was created." />
      <div className="panel">
        <form className="filters" onSubmit={(e) => e.preventDefault()}>
          <SelectField label="Report" value={type} onChange={(e) => setType(e.target.value)} options={Object.entries(LABELS).map(([value, label]) => ({ value, label }))} />
          <TextField label="From" type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
          <TextField label="To" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          <Button onClick={csv} busy={busy} disabled={bad || !rep.data}>Download CSV</Button>
        </form>
        {bad && <Alert tone="bad">The start date must not be after the end date.</Alert>}
      </div>
      {type === 'payments-summary' && <div style={{ margin: 'var(--s-4) 0' }}><SimulatedBanner>These figures come from simulated payments. Declined attempts are counted separately and never as collected.</SimulatedBanner></div>}
      {!bad && (
        <Card title={LABELS[type]}>
          <Async state={rep} isEmpty={(d) => !d} >
            {(r) => !r.rows.length ? <p className="muted">No records in this date range.</p> : (
              <TableWrap label="Report results"><table className="table"><caption className="sr-only">{LABELS[type]}</caption><thead><tr>{r.columns.map((c) => <th key={c.key}>{c.label}</th>)}</tr></thead>
                <tbody>{r.rows.map((row, i) => <tr key={i}>{r.columns.map((c) => <td key={c.key} className={typeof row[c.key] === 'number' || /^\d+(\.\d+)?$/.test(String(row[c.key])) ? 'num' : ''}>{String(row[c.key] ?? '')}</td>)}</tr>)}</tbody></table></TableWrap>
            )}
          </Async>
        </Card>
      )}
    </>
  );
}
