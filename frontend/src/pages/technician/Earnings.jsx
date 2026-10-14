import { Link } from 'react-router-dom';
import { techniciansApi } from '../../api/index.js';
import { useFetch } from '../../hooks/useFetch.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { Async, Card, PageHeader, SimulatedBanner, TableWrap } from '../../components/ui/index.js';
import { formatDateTime, formatMoney } from '../../utils/format.js';

export default function Earnings() {
  useDocumentTitle('Earnings');
  const e = useFetch(() => techniciansApi.earnings());
  return (
    <>
      <PageHeader title="Earnings" subtitle="Payments for your completed jobs." />
      <SimulatedBanner>{'Earnings come from SIMULATED demo payments. No real money was transferred.'}</SimulatedBanner>
      <Async state={e} isEmpty={() => false}>
        {(d) => (
          <>
            <div className="grid grid-2" style={{ margin: 'var(--s-4) 0' }}>
              <div className="stat sim"><div className="n">{formatMoney(d.totalAmount)}</div><div className="l">Total (simulated)</div></div>
              <div className="stat"><div className="n">{d.paymentCount}</div><div className="l">Paid jobs</div></div>
            </div>
            <Card title="Payment history" flush>
              {d.payments.length === 0 ? <p className="muted" style={{ padding: 'var(--s-5)' }}>No paid jobs yet.</p> : (
                <TableWrap label="Payment history"><table className="table"><thead><tr><th>Booking</th><th>Service</th><th className="num">Amount</th><th>Reference</th><th>Date</th></tr></thead>
                  <tbody>{d.payments.map((p) => <tr key={p.id}><td><Link to={`/technician/jobs/${p.bookingId}`}>{p.bookingReference}</Link></td><td>{p.serviceName}</td><td className="num">{formatMoney(p.amount, p.currency)}</td><td className="mono-num small">{p.transactionReference}</td><td>{formatDateTime(p.paidAt)}</td></tr>)}</tbody></table></TableWrap>
              )}
            </Card>
          </>
        )}
      </Async>
    </>
  );
}
