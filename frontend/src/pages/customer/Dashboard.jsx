import { Link } from 'react-router-dom';
import { bookingsApi } from '../../api/index.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useFetch } from '../../hooks/useFetch.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { Async, BookingBadge, Card, LinkButton, PageHeader, TableWrap } from '../../components/ui/index.js';
import { formatDate } from '../../utils/format.js';

export default function CustomerDashboard() {
  useDocumentTitle('Overview');
  const { user } = useAuth();
  const recent = useFetch(() => bookingsApi.list({ pageSize: 5 }));
  const quotes = useFetch(() => bookingsApi.list({ status: 'QUOTATION_SENT', pageSize: 1 }));
  const unpaid = useFetch(() => bookingsApi.list({ status: 'COMPLETED', paymentStatus: 'UNPAID', pageSize: 1 }));
  const active = useFetch(() => bookingsApi.list({ pageSize: 1 }));
  const n = (r) => r.data !== null ? r.meta?.total ?? 0 : '-';
  return (
    <>
      <PageHeader title={`Hello, ${user.fullName.split(' ')[0]}`} subtitle="Your bookings and anything that needs your decision." actions={<LinkButton to="/customer/book" variant="primary">Book a service</LinkButton>} />
      <div className="grid grid-3" style={{ marginBottom: 'var(--s-4)' }}>
        <div className={`stat ${n(quotes) > 0 ? 'warn' : ''}`}><Link to="/customer/bookings?status=QUOTATION_SENT" style={{ textDecoration: 'none' }}><div className="n">{n(quotes)}</div><div className="l">Quotations waiting for your decision</div></Link></div>
        <div className={`stat ${n(unpaid) > 0 ? 'warn' : ''}`}><div className="n">{n(unpaid)}</div><div className="l">Completed jobs to pay (simulated)</div></div>
        <div className="stat"><div className="n">{n(active)}</div><div className="l">Total bookings</div></div>
      </div>
      <Card title="Recent bookings" actions={<Link to="/customer/bookings">View all</Link>}>
        <Async state={recent} emptyTitle="No bookings yet" empty="Choose a service to book your first inspection." emptyAction={<LinkButton to="/customer/book" variant="primary">Book a service</LinkButton>}>
          {(rows) => (
            <TableWrap label="Recent bookings"><table className="table"><thead><tr><th>Booking</th><th>Service</th><th>Preferred date</th><th>Status</th></tr></thead>
              <tbody>{rows.map((b) => <tr key={b.id}><td><Link to={`/customer/bookings/${b.id}`}>{b.reference}</Link></td><td>{b.service.name}</td><td>{formatDate(b.preferredDate)}</td><td><BookingBadge status={b.status} /></td></tr>)}</tbody></table></TableWrap>
          )}
        </Async>
      </Card>
    </>
  );
}
