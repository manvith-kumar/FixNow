import { useEffect, useState } from 'react';
import { techniciansApi } from '../../api/index.js';
import { useToast } from '../../context/ToastContext.jsx';
import { useFetch } from '../../hooks/useFetch.js';
import { useSubmit } from '../../hooks/useSubmit.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { Alert, Async, Button, Card, PageHeader } from '../../components/ui/index.js';
import { DAY_NAMES } from '../../utils/format.js';

export default function Availability() {
  useDocumentTitle('Availability');
  const toast = useToast();
  const load = useFetch(() => techniciansApi.getAvailability());
  const [slots, setSlots] = useState([]);
  const [local, setLocal] = useState('');
  useEffect(() => { if (load.data) setSlots(load.data.map((s) => ({ dayOfWeek: s.dayOfWeek, startTime: s.startTime, endTime: s.endTime, isAvailable: s.isAvailable }))); }, [load.data]);
  const save = useSubmit(async () => { const res = await techniciansApi.setAvailability(slots); setSlots(res.data); toast.success('Availability saved.'); });
  const upd = (i, p) => setSlots((a) => a.map((s, x) => (x === i ? { ...s, ...p } : s)));
  const go = () => {
    for (const s of slots) if (!s.startTime || !s.endTime || s.endTime <= s.startTime) { setLocal('Each slot needs an end time after its start time.'); return; }
    const byDay = {};
    for (const s of slots) (byDay[s.dayOfWeek] ||= []).push(s);
    for (const d of Object.values(byDay)) { const o = [...d].sort((a, b) => a.startTime.localeCompare(b.startTime)); for (let i = 1; i < o.length; i++) if (o[i].startTime < o[i - 1].endTime) { setLocal('Slots on the same day must not overlap.'); return; } }
    setLocal(''); save.run();
  };
  return (
    <>
      <PageHeader title="Availability" subtitle="Your usual weekly hours. This is shown for planning and does not block you from accepting jobs." />
      <Async state={load} isEmpty={() => false}>
        {() => (
          <Card title="Weekly hours" actions={<Button size="sm" onClick={() => setSlots([...slots, { dayOfWeek: 1, startTime: '09:00', endTime: '17:00', isAvailable: true }])} disabled={slots.length >= 50}>Add time slot</Button>}>
            {!slots.length && <p className="muted">No hours set yet. Add a time slot.</p>}
            {slots.map((s, i) => (
              <div className="slot-row" key={i}>
                <select className="select day" aria-label={`Slot ${i + 1} day`} value={s.dayOfWeek} onChange={(e) => upd(i, { dayOfWeek: Number(e.target.value) })}>{DAY_NAMES.map((d, n) => <option key={d} value={n}>{d}</option>)}</select>
                <input className="input" type="time" aria-label={`Slot ${i + 1} start`} value={s.startTime} onChange={(e) => upd(i, { startTime: e.target.value })} />
                <input className="input" type="time" aria-label={`Slot ${i + 1} end`} value={s.endTime} onChange={(e) => upd(i, { endTime: e.target.value })} />
                <label className="check"><input type="checkbox" checked={s.isAvailable} onChange={(e) => upd(i, { isAvailable: e.target.checked })} />Available</label>
                <Button size="sm" variant="ghost" onClick={() => setSlots(slots.filter((_, x) => x !== i))} aria-label={`Remove slot ${i + 1}`}>Remove</Button>
              </div>
            ))}
            {(local || save.error) && <Alert tone="bad">{local || save.error}</Alert>}
            <div className="form-actions"><Button variant="primary" busy={save.busy} onClick={go}>Save availability</Button></div>
          </Card>
        )}
      </Async>
    </>
  );
}
