import { Link } from 'react-router-dom';
import { adminApi } from '../../api/index.js';
import { useFetch } from '../../hooks/useFetch.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { Async, Card, PageHeader, SimulatedBanner } from '../../components/ui/index.js';
import { BOOKING_STATUS, BOOKING_STATUS_LIST } from '../../utils/status.js';
import { formatMoney } from '../../utils/format.js';

export default function AdminDashboard() {
  useDocumentTitle('Dashboard');
  const d = useFetch(() => adminApi.dashboard());
  return (
    <>
      <PageHeader title="Dashboard" subtitle="Live figures from the database." />
      <Async state={d} isEmpty={() => false}>
        {(m) => {
          const max = Math.max(1, ...Object.values(m.bookingsByStatus));
          return (
            <>
              <div className="grid grid-4" style={{ marginBottom: 'var(--s-4)' }}>
                <div className="stat"><div className="n">{m.totalUsers}</div><div className="l">Total users</div></div>
                <div className="stat"><div className="n">{m.activeCustomers}</div><div className="l">Active customers</div></div>
                <div className="stat"><div className="n">{m.approvedTechnicians}</div><div className="l">Approved technicians</div></div>
                <div className={`stat ${m.pendingApplications > 0 ? 'warn' : ''}`}><Link to="/admin/applications?status=SUBMITTED" style={{ textDecoration: 'none' }}><div className="n">{m.pendingApplications}</div><div className="l">Applications awaiting review</div></Link></div>
                <div className="stat"><div className="n">{m.totalBookings}</div><div className="l">Total bookings</div></div>
                <div className={`stat ${m.quotationsAwaitingDecision > 0 ? 'warn' : ''}`}><Link to="/admin/quotations" style={{ textDecoration: 'none' }}><div className="n">{m.quotationsAwaitingDecision}</div><div className="l">Quotations awaiting a decision</div></Link></div>
                <div className="stat"><div className="n">{m.completedBookings}</div><div className="l">Completed bookings</div></div>
                <div className="stat sim"><div className="n">{formatMoney(m.payments.simulatedCollectedTotal)}</div><div className="l">Simulated payments collected</div></div>
              </div>
              <div className="grid grid-2" style={{ alignItems: 'start' }}>
                <Card title="Bookings by status">
                  <div className="bar-list">{BOOKING_STATUS_LIST.map((s) => { const n = m.bookingsByStatus[s] ?? 0; return (
                    <div className="bar" key={s}><span>{BOOKING_STATUS[s].short}</span><span className="track"><span className="fill" style={{ width: `${(n / max) * 100}%`, display: 'block' }} /></span><span className="mono-num">{n}</span></div>); })}</div>
                </Card>
                <Card title="Payment records (simulated)">
                  <SimulatedBanner>Simulated data only. No real money is involved.</SimulatedBanner>
                  <dl className="dl" style={{ marginTop: 'var(--s-3)' }}><dt>Records</dt><dd>{m.payments.records}</dd><dt>Successful</dt><dd>{m.payments.successful}</dd><dt>Declined</dt><dd>{m.payments.failed}</dd><dt>Collected total</dt><dd>{formatMoney(m.payments.simulatedCollectedTotal)}</dd></dl>
                  <p className="small muted">{m.revenueDefinition}</p>
                  <Link to="/admin/payments">View payment records</Link>
                </Card>
              </div>
            </>
          );
        }}
      </Async>
    </>
  );
}
