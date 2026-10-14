import { Link } from 'react-router-dom';
import { paymentsApi } from '../../api/index.js';
import { usePagedList } from '../../hooks/usePagedList.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { Button, DataTable, PageHeader, PaymentBadge, SelectField, SimulatedBanner, TextField } from '../../components/ui/index.js';
import { formatDateTime, formatMoney } from '../../utils/format.js';
import { methodLabel } from '../../utils/status.js';

export default function PaymentsListPage({ role, bookingPath, subtitle }) {
  useDocumentTitle('Payments');
  const list = usePagedList((p) => paymentsApi.list(p), { q: '', status: '', from: '', to: '' });
  const columns = [
    { key: 'ref', header: 'Booking', render: (p) => <Link to={bookingPath(p.bookingId)}>{p.bookingReference}</Link> },
    { key: 'svc', header: 'Service', render: (p) => p.serviceName },
    ...(role === 'ADMIN' ? [{ key: 'cust', header: 'Customer', render: (p) => p.customerName }, { key: 'tech', header: 'Technician', render: (p) => p.technicianName ?? '-' }] : []),
    { key: 'amt', header: 'Amount', className: 'num', render: (p) => formatMoney(p.amount, p.currency) },
    { key: 'method', header: 'Method', render: (p) => methodLabel(p.method) },
    { key: 'status', header: 'Result', render: (p) => <PaymentBadge status={p.status} /> },
    { key: 'txn', header: 'Reference', render: (p) => <span className="mono-num small">{p.transactionReference}</span> },
    { key: 'at', header: 'Date', render: (p) => formatDateTime(p.createdAt) },
  ];
  return (
    <>
      <PageHeader title="Payments" subtitle={subtitle} />
      <SimulatedBanner>Every payment on this page is simulated. No real money was charged or collected.</SimulatedBanner>
      <div className="panel panel-flush" style={{ marginTop: 'var(--s-4)' }}>
        <div style={{ padding: 'var(--s-4) var(--s-5) 0' }}>
          <form className="filters" onSubmit={(e) => e.preventDefault()} role="search">
            <TextField className="wide" label="Search" placeholder="Booking or transaction reference" value={list.filters.q} onChange={(e) => list.setFilter('q', e.target.value)} />
            {role !== 'TECHNICIAN' && <SelectField label="Result" value={list.filters.status} placeholder="All" options={[{ value: 'SUCCESS', label: 'Successful' }, { value: 'FAILED', label: 'Declined' }]} onChange={(e) => list.setFilter('status', e.target.value)} />}
            <TextField label="From" type="date" value={list.filters.from} onChange={(e) => list.setFilter('from', e.target.value)} />
            <TextField label="To" type="date" value={list.filters.to} onChange={(e) => list.setFilter('to', e.target.value)} />
            <Button onClick={list.reset}>Reset</Button>
          </form>
        </div>
        <DataTable list={list} columns={columns} caption="Payments" emptyTitle="No payments yet" emptyText="Simulated payments appear here once a completed booking is paid." />
      </div>
    </>
  );
}
