import { useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { applicationsApi } from '../../api/index.js';
import { useToast } from '../../context/ToastContext.jsx';
import { useFetch } from '../../hooks/useFetch.js';
import { usePagedList } from '../../hooks/usePagedList.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { Alert, ApplicationBadge, Async, Button, Card, ConfirmDialog, DataTable, Dl, PageHeader, ReasonDialog, SelectField, TextField } from '../../components/ui/index.js';
import { DocumentList } from '../../components/common/DocumentList.jsx';
import { formatDateTime } from '../../utils/format.js';
import { getErrorMessage } from '../../utils/errors.js';

export function ApplicationsList() {
  useDocumentTitle('Technician applications');
  const [sp] = useSearchParams();
  const initial = useMemo(() => ({ q: '', status: sp.get('status') ?? '' }), [sp]);
  const list = usePagedList((p) => applicationsApi.adminList(p), initial);
  const columns = [
    { key: 'name', header: 'Applicant', render: (a) => <><Link to={`/admin/applications/${a.id}`}><strong>{a.fullName}</strong></Link><div className="muted small">{a.email}</div></> },
    { key: 'spec', header: 'Specialization', render: (a) => a.specialization },
    { key: 'exp', header: 'Experience', render: (a) => `${a.experienceYears} yrs` },
    { key: 'area', header: 'Area', render: (a) => a.serviceArea },
    { key: 'status', header: 'Status', render: (a) => <ApplicationBadge status={a.status} /> },
    { key: 'when', header: 'Submitted', render: (a) => formatDateTime(a.submittedAt) },
  ];
  return (
    <>
      <PageHeader title="Technician applications" subtitle="Review documents, then approve, reject or ask for more information." />
      <div className="panel panel-flush">
        <div style={{ padding: 'var(--s-4) var(--s-5) 0' }}><form className="filters" onSubmit={(e) => e.preventDefault()} role="search">
          <TextField className="wide" label="Search" placeholder="Name, email or specialization" value={list.filters.q} onChange={(e) => list.setFilter('q', e.target.value)} />
          <SelectField label="Status" value={list.filters.status} placeholder="All" options={[{ value: 'SUBMITTED', label: 'Under review' }, { value: 'NEEDS_INFO', label: 'More information needed' }, { value: 'APPROVED', label: 'Approved' }, { value: 'REJECTED', label: 'Rejected' }]} onChange={(e) => list.setFilter('status', e.target.value)} />
          <Button onClick={list.reset}>Reset</Button></form></div>
        <DataTable list={list} columns={columns} caption="Applications" emptyTitle="No applications found" />
      </div>
    </>
  );
}

export function ApplicationDetail() {
  const { id } = useParams();
  const toast = useToast();
  const app = useFetch(() => applicationsApi.adminGet(id), [id]);
  useDocumentTitle(app.data ? `Application: ${app.data.fullName}` : 'Application');
  const [dlg, setDlg] = useState('');
  const close = () => setDlg('');
  const decide = (decision, msg) => async (notes) => {
    try { await applicationsApi.decide(id, decision, notes || undefined); close(); toast.success(msg); app.reload(); } catch (e) { throw new Error(getErrorMessage(e)); }
  };
  return (
    <>
      <p className="small"><Link to="/admin/applications">Back to applications</Link></p>
      <Async state={app} loadingLabel="Loading application...">
        {(a) => (
          <>
            <PageHeader title={a.fullName} subtitle={a.email} actions={<ApplicationBadge status={a.status} />} />
            <div className="detail-grid">
              <div>
                <Card title="Application"><Dl items={[['Phone', a.phone], ['Specialization', a.specialization], ['Experience', `${a.experienceYears} years`], ['Service area', a.serviceArea], ['About', a.bio], ['Services requested', `${a.serviceIds.length} selected`], ['Submitted', formatDateTime(a.submittedAt)]]} /></Card>
                <Card title="Documents"><DocumentList applicationId={a.id} documents={a.documents} /></Card>
              </div>
              <div>
                <Card title="Decision">
                  {a.status === 'SUBMITTED' ? (
                    <div className="stack">
                      <Button variant="primary" block onClick={() => setDlg('approve')}>Approve</Button>
                      <Button block onClick={() => setDlg('info')}>Request more information</Button>
                      <Button variant="danger" block onClick={() => setDlg('reject')}>Reject</Button>
                    </div>
                  ) : a.status === 'NEEDS_INFO' ? <Alert tone="info">Waiting for the applicant to send the requested information.</Alert> : <p className="muted">This application has been decided.</p>}
                  {a.reviewedAt && <Dl items={[['Reviewed', formatDateTime(a.reviewedAt)], ['Reviewer', a.reviewerName], ['Notes', a.reviewNotes]]} />}
                </Card>
              </div>
            </div>
            <ConfirmDialog open={dlg === 'approve'} onClose={close} title={`Approve ${a.fullName}?`} confirmLabel="Approve technician" cancelLabel="Not yet" onConfirm={decide('APPROVE', 'Application approved. The technician has been notified.')}
              message="They will be able to accept jobs for the services they requested." />
            <ReasonDialog open={dlg === 'reject'} onClose={close} title="Reject this application" label="Reason (shown to the applicant)" minLength={5} confirmLabel="Reject application" onSubmit={decide('REJECT', 'Application rejected.')} />
            <ReasonDialog open={dlg === 'info'} onClose={close} danger={false} title="Request more information" label="What do you need? (shown to the applicant)" minLength={5} confirmLabel="Send request" onSubmit={decide('REQUEST_INFO', 'Information requested.')} />
          </>
        )}
      </Async>
    </>
  );
}
