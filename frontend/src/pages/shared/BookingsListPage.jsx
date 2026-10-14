import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { bookingsApi } from '../../api/index.js';
import { usePagedList } from '../../hooks/usePagedList.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { BookingBadge, Button, DataTable, PageHeader, PaymentBadge, SelectField, TextField } from '../../components/ui/index.js';
import { BOOKING_STATUS, BOOKING_STATUS_LIST } from '../../utils/status.js';
import { formatDate, formatMoney, formatTime } from '../../utils/format.js';

const INITIAL = { q: '', status: '', from: '', to: '', paymentStatus: '' };
/** One list for all roles; the API scopes the rows (customer: own, technician: assigned, admin: all). */
export default function BookingsListPage({ role, title, subtitle, detailPath, actions, fixedFilters = {} }) {
  useDocumentTitle(title);
  const [sp] = useSearchParams();
  const initial = useMemo(() => ({ ...INITIAL, status: BOOKING_STATUS[sp.get('status')] ? sp.get('status') : '' }), [sp]);
  const list = usePagedList((p) => bookingsApi.list({ ...p, ...fixedFilters }), initial);
  const columns = [
    { key: 'ref', header: 'Booking', render: (b) => <Link to={detailPath(b.id)}>{b.reference}</Link> },
    { key: 'svc', header: 'Service', render: (b) => <>{b.service.name}<div className="muted small">{b.service.categoryName}</div></> },
    { key: 'when', header: 'Preferred time', render: (b) => `${formatDate(b.preferredDate)}, ${formatTime(b.preferredTime)}` },
    ...(role !== 'CUSTOMER' ? [{ key: 'cust', header: 'Customer', render: (b) => b.customer?.fullName ?? '-' }] : []),
    ...(role !== 'TECHNICIAN' ? [{ key: 'tech', header: 'Technician', render: (b) => b.technician?.fullName ?? <span className="muted">Not assigned</span> }] : []),
    { key: 'status', header: 'Status', render: (b) => <BookingBadge status={b.status} /> },
    { key: 'quote', header: 'Quote', className: 'num', render: (b) => (b.currentQuotation ? formatMoney(b.currentQuotation.totalAmount) : '-') },
    { key: 'pay', header: 'Payment', render: (b) => (b.status === 'COMPLETED' ? <PaymentBadge status={b.paymentStatus === 'PAID' ? 'SUCCESS' : 'FAILED'} /> : '-') },
  ];
  return (
    <>
      <PageHeader title={title} subtitle={subtitle} actions={actions} />
      <div className="panel panel-flush">
        <div style={{ padding: 'var(--s-4) var(--s-5) 0' }}>
          <form className="filters" onSubmit={(e) => e.preventDefault()} role="search">
            <TextField className="wide" label="Search" placeholder="Reference, service or customer" value={list.filters.q} onChange={(e) => list.setFilter('q', e.target.value)} />
            <SelectField label="Status" value={list.filters.status} placeholder="All statuses" options={BOOKING_STATUS_LIST.map((s) => ({ value: s, label: BOOKING_STATUS[s].short }))} onChange={(e) => list.setFilter('status', e.target.value)} />
            {role === 'ADMIN' && <SelectField label="Payment" value={list.filters.paymentStatus} placeholder="Any" options={[{ value: 'UNPAID', label: 'Unpaid' }, { value: 'PAID', label: 'Paid (simulated)' }]} onChange={(e) => list.setFilter('paymentStatus', e.target.value)} />}
            <TextField label="Created from" type="date" value={list.filters.from} onChange={(e) => list.setFilter('from', e.target.value)} />
            <TextField label="Created to" type="date" value={list.filters.to} onChange={(e) => list.setFilter('to', e.target.value)} />
            <Button onClick={list.reset}>Reset</Button>
          </form>
        </div>
        <DataTable list={list} columns={columns} caption={title} emptyTitle="No bookings found" emptyText="Bookings that match these filters will appear here." />
      </div>
    </>
  );
}
