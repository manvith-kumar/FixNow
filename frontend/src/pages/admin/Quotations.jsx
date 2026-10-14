import { useState } from 'react';
import { Link } from 'react-router-dom';
import { quotationsApi } from '../../api/index.js';
import { useFetch } from '../../hooks/useFetch.js';
import { usePagedList } from '../../hooks/usePagedList.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { Async, Button, DataTable, Modal, PageHeader, QuoteBadge, SelectField, TextField, CheckField } from '../../components/ui/index.js';
import { QuotationView } from '../../components/booking/QuotationView.jsx';
import { QUOTE_STATUS } from '../../utils/status.js';
import { formatDateTime, formatMoney } from '../../utils/format.js';

function Versions({ row, onClose }) {
  const v = useFetch(() => quotationsApi.forBooking(row.bookingId), [row.bookingId]);
  return (
    <Modal open onClose={onClose} wide title={`Quotation history for ${row.bookingReference}`} footer={<><Link className="btn" to={`/admin/bookings/${row.bookingId}`}>Open booking</Link><Button onClick={onClose}>Close</Button></>}>
      <Async state={v}>{(rows) => rows.map((q) => <div key={q.id} style={{ marginBottom: 'var(--s-4)' }}><QuotationView quotation={q} old={!q.isCurrent} /></div>)}</Async>
    </Modal>
  );
}
export default function Quotations() {
  useDocumentTitle('Quotations');
  const list = usePagedList((p) => quotationsApi.adminList({ ...p, currentOnly: p.currentOnly ? 'true' : undefined }), { q: '', status: '', currentOnly: false });
  const [view, setView] = useState(null);
  const columns = [
    { key: 'ref', header: 'Booking', render: (q) => <Link to={`/admin/bookings/${q.bookingId}`}>{q.bookingReference}</Link> },
    { key: 'svc', header: 'Service', render: (q) => q.serviceName },
    { key: 'v', header: 'Version', className: 'num', render: (q) => `v${q.versionNumber}${q.isCurrent ? ' (current)' : ''}` },
    { key: 'cust', header: 'Customer', render: (q) => q.customerName },
    { key: 'tech', header: 'Technician', render: (q) => q.technicianName ?? '-' },
    { key: 'tot', header: 'Total', className: 'num', render: (q) => formatMoney(q.totalAmount) },
    { key: 'st', header: 'Status', render: (q) => <QuoteBadge status={q.status} /> },
    { key: 'at', header: 'Created', render: (q) => formatDateTime(q.createdAt) },
    { key: 'a', header: '', className: 'actions', render: (q) => <Button size="sm" onClick={() => setView(q)}>View</Button> },
  ];
  return (
    <>
      <PageHeader title="Quotations" subtitle="Every version of every quotation. Customers decide; administrators can review." />
      <div className="panel panel-flush">
        <div style={{ padding: 'var(--s-4) var(--s-5) 0' }}><form className="filters" onSubmit={(e) => e.preventDefault()} role="search">
          <TextField className="wide" label="Search" placeholder="Booking reference or service" value={list.filters.q} onChange={(e) => list.setFilter('q', e.target.value)} />
          <SelectField label="Status" value={list.filters.status} placeholder="All" options={Object.entries(QUOTE_STATUS).map(([value, m]) => ({ value, label: m.label }))} onChange={(e) => list.setFilter('status', e.target.value)} />
          <CheckField label="Current versions only" checked={list.filters.currentOnly} onChange={(e) => list.setFilter('currentOnly', e.target.checked)} />
          <Button onClick={list.reset}>Reset</Button></form></div>
        <DataTable list={list} columns={columns} caption="Quotations" emptyTitle="No quotations found" />
      </div>
      {view && <Versions row={view} onClose={() => setView(null)} />}
    </>
  );
}
