import { useState } from 'react';
import { Link } from 'react-router-dom';
import { reviewsApi } from '../../api/index.js';
import { useToast } from '../../context/ToastContext.jsx';
import { usePagedList } from '../../hooks/usePagedList.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { Badge, Button, DataTable, PageHeader, ReasonDialog, SelectField, Stars, TextField } from '../../components/ui/index.js';
import { formatDateTime } from '../../utils/format.js';
import { getErrorMessage } from '../../utils/errors.js';

export default function Reviews() {
  useDocumentTitle('Reviews');
  const toast = useToast();
  const list = usePagedList((p) => reviewsApi.adminList(p), { q: '', status: '' });
  const [hide, setHide] = useState(null);
  const show = async (r) => { try { await reviewsApi.moderate(r.id, 'VISIBLE'); toast.success('Review is visible again.'); list.reload(); } catch (e) { toast.error(getErrorMessage(e)); } };
  const columns = [
    { key: 'r', header: 'Rating', render: (r) => <Stars value={r.rating} /> },
    { key: 'c', header: 'Review', render: (r) => <span style={{ display: 'block', maxWidth: '26rem' }}>{r.comment || <span className="muted">No comment</span>}{r.moderationNote && <span className="small muted" style={{ display: 'block' }}>Moderator note: {r.moderationNote}</span>}</span> },
    { key: 'who', header: 'Customer', render: (r) => r.reviewer },
    { key: 'svc', header: 'Service', render: (r) => <>{r.serviceName}<div className="small muted">{r.technicianName}</div></> },
    { key: 'b', header: 'Booking', render: (r) => <Link to={`/admin/bookings/${r.bookingId}`}>{r.bookingReference}</Link> },
    { key: 'st', header: 'Visibility', render: (r) => <Badge tone={r.status === 'VISIBLE' ? 'ok' : 'muted'}>{r.status === 'VISIBLE' ? 'Visible' : 'Hidden'}</Badge> },
    { key: 'at', header: 'Date', render: (r) => formatDateTime(r.createdAt) },
    { key: 'a', header: '', className: 'actions', render: (r) => (r.status === 'VISIBLE' ? <Button size="sm" variant="danger" onClick={() => setHide(r)}>Hide</Button> : <Button size="sm" onClick={() => show(r)}>Show</Button>) },
  ];
  return (
    <>
      <PageHeader title="Review moderation" subtitle="Hidden reviews are not shown publicly." />
      <div className="panel panel-flush">
        <div style={{ padding: 'var(--s-4) var(--s-5) 0' }}><form className="filters" onSubmit={(e) => e.preventDefault()} role="search">
          <TextField className="wide" label="Search" placeholder="Comment, customer or service" value={list.filters.q} onChange={(e) => list.setFilter('q', e.target.value)} />
          <SelectField label="Visibility" value={list.filters.status} placeholder="All" options={[{ value: 'VISIBLE', label: 'Visible' }, { value: 'HIDDEN', label: 'Hidden' }]} onChange={(e) => list.setFilter('status', e.target.value)} />
          <Button onClick={list.reset}>Reset</Button></form></div>
        <DataTable list={list} columns={columns} caption="Reviews" emptyTitle="No reviews yet" emptyText="Reviews appear after customers rate completed bookings." />
      </div>
      <ReasonDialog open={!!hide} onClose={() => setHide(null)} title="Hide this review?" message="It will no longer appear publicly. The customer's record is kept." label="Moderation note (optional)" required={false} confirmLabel="Hide review"
        onSubmit={async (note) => { try { await reviewsApi.moderate(hide.id, 'HIDDEN', note || undefined); toast.success('Review hidden.'); setHide(null); list.reload(); } catch (e) { throw new Error(getErrorMessage(e)); } }} />
    </>
  );
}
