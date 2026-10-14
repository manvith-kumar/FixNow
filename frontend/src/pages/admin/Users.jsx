import { useState } from 'react';
import { usersApi } from '../../api/index.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { usePagedList } from '../../hooks/usePagedList.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { Badge, Button, ConfirmDialog, DataTable, PageHeader, SelectField, TextField } from '../../components/ui/index.js';
import { formatDateTime } from '../../utils/format.js';
import { ROLE_LABEL } from '../../utils/status.js';
import { getErrorMessage } from '../../utils/errors.js';

export default function Users() {
  useDocumentTitle('Users');
  const { user: me } = useAuth();
  const toast = useToast();
  const list = usePagedList((p) => usersApi.list(p), { q: '', role: '', status: '' });
  const [target, setTarget] = useState(null);
  const columns = [
    { key: 'name', header: 'Name', render: (u) => <><strong>{u.fullName}</strong><div className="muted small">{u.email}</div></> },
    { key: 'role', header: 'Role', render: (u) => ROLE_LABEL[u.role] },
    { key: 'status', header: 'Status', render: (u) => <Badge tone={u.status === 'ACTIVE' ? 'ok' : 'bad'}>{u.status === 'ACTIVE' ? 'Active' : 'Disabled'}</Badge> },
    { key: 'phone', header: 'Phone', render: (u) => u.phone ?? '-' },
    { key: 'last', header: 'Last login', render: (u) => formatDateTime(u.lastLoginAt) },
    { key: 'joined', header: 'Joined', render: (u) => formatDateTime(u.createdAt) },
    { key: 'act', header: '', className: 'actions', render: (u) => u.id === me.id ? <span className="muted small">You</span> : <Button size="sm" variant={u.status === 'ACTIVE' ? 'danger' : 'secondary'} onClick={() => setTarget(u)}>{u.status === 'ACTIVE' ? 'Disable' : 'Enable'}</Button> },
  ];
  const next = target?.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE';
  return (
    <>
      <PageHeader title="Users" subtitle="Disabling an account signs the person out and blocks login." />
      <div className="panel panel-flush">
        <div style={{ padding: 'var(--s-4) var(--s-5) 0' }}><form className="filters" onSubmit={(e) => e.preventDefault()} role="search">
          <TextField className="wide" label="Search" placeholder="Name or email" value={list.filters.q} onChange={(e) => list.setFilter('q', e.target.value)} />
          <SelectField label="Role" value={list.filters.role} placeholder="All roles" options={Object.entries(ROLE_LABEL).map(([value, label]) => ({ value, label }))} onChange={(e) => list.setFilter('role', e.target.value)} />
          <SelectField label="Status" value={list.filters.status} placeholder="Any" options={[{ value: 'ACTIVE', label: 'Active' }, { value: 'DISABLED', label: 'Disabled' }]} onChange={(e) => list.setFilter('status', e.target.value)} />
          <Button onClick={list.reset}>Reset</Button></form></div>
        <DataTable list={list} columns={columns} caption="Users" emptyTitle="No users found" />
      </div>
      <ConfirmDialog open={!!target} danger={next === 'DISABLED'} onClose={() => setTarget(null)} title={`${next === 'DISABLED' ? 'Disable' : 'Enable'} ${target?.fullName}?`} confirmLabel={next === 'DISABLED' ? 'Disable account' : 'Enable account'}
        message={next === 'DISABLED' ? 'They will be signed out and unable to log in until you enable the account again.' : 'They will be able to log in again.'}
        onConfirm={async () => { try { await usersApi.setStatus(target.id, next); toast.success(`Account ${next === 'DISABLED' ? 'disabled' : 'enabled'}.`); setTarget(null); list.reload(); } catch (e) { throw new Error(getErrorMessage(e)); } }} />
    </>
  );
}
