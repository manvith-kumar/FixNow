import { useState } from 'react';
import { techniciansApi } from '../../api/index.js';
import { useToast } from '../../context/ToastContext.jsx';
import { useFetch } from '../../hooks/useFetch.js';
import { usePagedList } from '../../hooks/usePagedList.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { ActiveBadge, ApplicationBadge, Async, Button, ConfirmDialog, DataTable, Dl, Modal, PageHeader, SelectField, TextField } from '../../components/ui/index.js';
import { DAY_NAMES } from '../../utils/format.js';
import { getErrorMessage } from '../../utils/errors.js';

const row = (label, value) => [label, value]; // [label, value] pairs for <Dl>

function Details({ id, onClose }) {
  const d = useFetch(() => techniciansApi.adminGet(id), [id]);
  return (
    <Modal open onClose={onClose} title="Technician details" wide footer={<Button onClick={onClose}>Close</Button>}>
      <Async state={d} isEmpty={() => false}>
        {(t) => (<>
          <Dl items={[
            row('Name', t.fullName), row('Email', t.email), row('Phone', t.phone), row('Approval', <ApplicationBadge status={t.approvalStatus} />),
            row('Account', <ActiveBadge active={t.isActive && t.userStatus === 'ACTIVE'} />), row('Specialization', t.specialization), row('Experience', `${t.experienceYears} years`),
            row('Service area', t.serviceArea), row('About', t.bio), row('Services', t.services.map((s) => s.name).join(', ') || 'None'),
            row('Weekly hours', t.availability.length ? t.availability.map((a) => `${DAY_NAMES[a.dayOfWeek]} ${a.startTime}-${a.endTime}${a.isAvailable ? '' : ' (off)'}`).join('; ') : 'Not set'),
          ]} />
        </>)}
      </Async>
    </Modal>
  );
}

export default function Technicians() {
  useDocumentTitle('Technicians');
  const toast = useToast();
  const list = usePagedList((p) => techniciansApi.adminList(p), { q: '', status: '' });
  const [detail, setDetail] = useState(null);
  const [toggle, setToggle] = useState(null);
  const columns = [
    { key: 'name', header: 'Technician', render: (t) => <><strong>{t.fullName}</strong><div className="muted small">{t.email}</div></> },
    { key: 'spec', header: 'Specialization', render: (t) => t.specialization ?? '-' },
    { key: 'appr', header: 'Approval', render: (t) => <ApplicationBadge status={t.approvalStatus} /> },
    { key: 'act', header: 'Account', render: (t) => <ActiveBadge active={t.isActive && t.userStatus === 'ACTIVE'} /> },
    { key: 'open', header: 'Open jobs', className: 'num', render: (t) => t.openJobs },
    { key: 'done', header: 'Completed', className: 'num', render: (t) => t.completedJobs },
    { key: 'rate', header: 'Rating', className: 'num', render: (t) => t.avgRating ?? '-' },
    { key: 'a', header: '', className: 'actions', render: (t) => <span className="row" style={{ justifyContent: 'flex-end' }}><Button size="sm" onClick={() => setDetail(t.id)}>Details</Button>{t.approvalStatus === 'APPROVED' && <Button size="sm" variant={t.isActive ? 'danger' : 'secondary'} onClick={() => setToggle(t)}>{t.isActive ? 'Deactivate' : 'Activate'}</Button>}</span> },
  ];
  return (
    <>
      <PageHeader title="Technicians" subtitle="A deactivated technician cannot accept or work on jobs." />
      <div className="panel panel-flush">
        <div style={{ padding: 'var(--s-4) var(--s-5) 0' }}><form className="filters" onSubmit={(e) => e.preventDefault()} role="search">
          <TextField className="wide" label="Search" placeholder="Name, email or specialization" value={list.filters.q} onChange={(e) => list.setFilter('q', e.target.value)} />
          <SelectField label="Approval" value={list.filters.status} placeholder="All" options={['NOT_APPLIED', 'PENDING', 'NEEDS_INFO', 'APPROVED', 'REJECTED'].map((v) => ({ value: v, label: { NOT_APPLIED: 'Not applied', PENDING: 'Under review', NEEDS_INFO: 'More info needed', APPROVED: 'Approved', REJECTED: 'Rejected' }[v] }))} onChange={(e) => list.setFilter('status', e.target.value)} />
          <Button onClick={list.reset}>Reset</Button></form></div>
        <DataTable list={list} columns={columns} caption="Technicians" emptyTitle="No technicians found" />
      </div>
      {detail && <Details id={detail} onClose={() => setDetail(null)} />}
      <ConfirmDialog open={!!toggle} danger={toggle?.isActive} onClose={() => setToggle(null)} title={`${toggle?.isActive ? 'Deactivate' : 'Activate'} ${toggle?.fullName}?`} confirmLabel={toggle?.isActive ? 'Deactivate' : 'Activate'}
        message={toggle?.isActive ? 'They will no longer be able to accept jobs or act on existing ones.' : 'They will be able to accept jobs again.'}
        onConfirm={async () => { try { await techniciansApi.adminSetActive(toggle.id, !toggle.isActive); toast.success('Technician updated.'); setToggle(null); list.reload(); } catch (e) { throw new Error(getErrorMessage(e)); } }} />
    </>
  );
}
