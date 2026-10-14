import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { bookingsApi } from '../../api/index.js';
import { useToast } from '../../context/ToastContext.jsx';
import { usePagedList } from '../../hooks/usePagedList.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { Alert, Button, ConfirmDialog, DataTable, PageHeader } from '../../components/ui/index.js';
import { formatDate, formatTime } from '../../utils/format.js';
import { getErrorCode, getErrorMessage } from '../../utils/errors.js';

export default function AvailableJobs() {
  useDocumentTitle('Available jobs');
  const toast = useToast();
  const nav = useNavigate();
  const list = usePagedList((p) => bookingsApi.available(p), {});
  const [target, setTarget] = useState(null);
  const notApproved = getErrorCode(list.error) === 'TECHNICIAN_NOT_APPROVED';
  const accept = async () => {
    try { const res = await bookingsApi.accept(target.id); toast.success('Job accepted. It is now in My jobs.'); setTarget(null); nav(`/technician/jobs/${res.data.id}`); }
    catch (e) {
      if (getErrorCode(e) === 'JOB_ALREADY_TAKEN') { setTarget(null); toast.error('Another technician accepted this job first.'); list.reload(); return; }
      throw new Error(getErrorMessage(e));
    }
  };
  const columns = [
    { key: 'ref', header: 'Booking', render: (b) => b.reference },
    { key: 'svc', header: 'Service', render: (b) => <>{b.service.name}<div className="muted small">{b.service.categoryName}</div></> },
    { key: 'prob', header: 'Problem', render: (b) => <span style={{ display: 'block', maxWidth: '24rem' }}>{b.problemDescription}</span> },
    { key: 'area', header: 'Area', render: (b) => [b.address?.city, b.address?.state].filter(Boolean).join(', ') },
    { key: 'when', header: 'Preferred time', render: (b) => `${formatDate(b.preferredDate)}, ${formatTime(b.preferredTime)}` },
    { key: 'act', header: '', className: 'actions', render: (b) => <Button size="sm" variant="primary" onClick={() => setTarget(b)}>Accept job</Button> },
  ];
  return (
    <>
      <PageHeader title="Available jobs" subtitle="Open bookings for the services you offer. The customer's address and contact details are shown after you accept." />
      {notApproved ? <Alert tone="warn" title="Approval required">Only approved, active technicians can see and accept jobs. <Link to="/technician/application">Check your application</Link>.</Alert> : (
        <div className="panel panel-flush"><DataTable list={list} columns={columns} caption="Available jobs" emptyTitle="No open jobs right now" emptyText="New bookings for your services will appear here and in your notifications." /></div>
      )}
      <ConfirmDialog open={!!target} onClose={() => setTarget(null)} title="Accept this job?" confirmLabel="Accept job" cancelLabel="Not now" onConfirm={accept}>
        {target && <p>{target.service.name} in {target.address?.city}, {formatDate(target.preferredDate)} at {formatTime(target.preferredTime)}. You will be responsible for the inspection and quotation.</p>}
      </ConfirmDialog>
    </>
  );
}
