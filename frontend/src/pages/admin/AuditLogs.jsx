import { adminApi } from '../../api/index.js';
import { usePagedList } from '../../hooks/usePagedList.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { Button, DataTable, PageHeader, TextField } from '../../components/ui/index.js';
import { formatDateTime, humanize } from '../../utils/format.js';

const brief = (d) => { if (!d) return '-'; const o = typeof d === 'string' ? (() => { try { return JSON.parse(d); } catch { return d; } })() : d; return typeof o === 'string' ? o : Object.entries(o).map(([k, val]) => `${k}: ${typeof val === 'object' ? JSON.stringify(val) : val}`).join(', '); };
export default function AuditLogs() {
  useDocumentTitle('Audit log');
  const list = usePagedList((p) => adminApi.auditLogs({ page: p.page, pageSize: p.pageSize, action: p.action, entityType: p.entityType }), { action: '', entityType: '' }, { pageSize: 25 });
  const columns = [
    { key: 'at', header: 'When', render: (l) => formatDateTime(l.createdAt) },
    { key: 'who', header: 'Who', render: (l) => <>{l.actorName ?? 'System'}<div className="small muted">{l.actorRole}</div></> },
    { key: 'act', header: 'Action', render: (l) => humanize(l.action) },
    { key: 'ent', header: 'Record', render: (l) => `${humanize(l.entityType)}${l.entityId ? ` #${l.entityId}` : ''}` },
    { key: 'd', header: 'Details', render: (l) => <span className="small">{brief(l.details)}</span> },
  ];
  return (
    <>
      <PageHeader title="Audit log" subtitle="Administrative actions recorded by the system." />
      <div className="panel panel-flush">
        <div style={{ padding: 'var(--s-4) var(--s-5) 0' }}><form className="filters" onSubmit={(e) => e.preventDefault()}>
          <TextField label="Action (exact, e.g. SETTINGS_UPDATED)" value={list.filters.action} onChange={(e) => list.setFilter('action', e.target.value.trim())} />
          <TextField label="Record type (e.g. booking)" value={list.filters.entityType} onChange={(e) => list.setFilter('entityType', e.target.value.trim())} />
          <Button onClick={list.reset}>Reset</Button></form></div>
        <DataTable list={list} columns={columns} caption="Audit log" emptyTitle="No audit entries" />
      </div>
    </>
  );
}
