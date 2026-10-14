import { useState } from 'react';
import { paymentsApi } from '../../api/index.js';
import { useSubmit } from '../../hooks/useSubmit.js';
import { Alert, Button, SimulatedBanner } from '../ui/index.js';
import { DEMO_METHODS, methodLabel } from '../../utils/status.js';
import { formatDateTime, formatMoney } from '../../utils/format.js';

/** SIMULATED payment. The browser only sends the booking and a demo method; the server decides the amount and the result. */
export function PaymentPanel({ booking, onPaid }) {
  const [method, setMethod] = useState('DEMO_CARD');
  const [declined, setDeclined] = useState(null);
  const amount = booking.currentQuotation?.totalAmount;
  const pay = useSubmit(async () => {
    setDeclined(null);
    const res = await paymentsApi.pay(booking.id, method);
    if (res.outcome === 'SUCCESS') onPaid(res.payment); else setDeclined(res.payment);
  });
  return (
    <div>
      <SimulatedBanner />
      <p style={{ marginTop: 'var(--s-3)' }}>Amount due: <strong>{formatMoney(amount)}</strong> <span className="muted small">(your approved quotation)</span></p>
      <fieldset style={{ border: 0, padding: 0, margin: 0 }} className="stack">
        <legend className="label" style={{ fontWeight: 700, marginBottom: 8 }}>Demo payment method</legend>
        {DEMO_METHODS.map((m) => (
          <label key={m.value} className="pick"><input type="radio" name="method" value={m.value} checked={method === m.value} onChange={() => setMethod(m.value)} />{m.label}<span className="muted small" style={{ display: 'block', marginLeft: '1.6rem' }}>{m.hint}</span></label>
        ))}
      </fieldset>
      {declined && <Alert tone="bad" title="Simulated payment declined">{declined.failureReason || 'The demo payment failed.'} Nothing was charged and your booking is still unpaid. Reference {declined.transactionReference}.</Alert>}
      {pay.error && <Alert tone="bad">{pay.error}</Alert>}
      <Button variant="primary" block style={{ marginTop: 'var(--s-4)' }} busy={pay.busy} busyLabel="Processing demo payment..." onClick={pay.run}>Pay {formatMoney(amount)} (simulated)</Button>
    </div>
  );
}

export function Receipt({ payment }) {
  if (!payment) return null;
  return (
    <div className="receipt">
      <strong>Payment received (simulated)</strong>
      <p className="small" style={{ margin: '.25rem 0 .5rem' }}>No real money was charged.</p>
      <dl className="dl">
        <dt>Amount</dt><dd>{formatMoney(payment.amount, payment.currency)}</dd>
        <dt>Method</dt><dd>{methodLabel(payment.method)}</dd>
        <dt>Reference</dt><dd>{payment.transactionReference}</dd>
        <dt>Paid</dt><dd>{formatDateTime(payment.paidAt ?? payment.createdAt)}</dd>
      </dl>
    </div>
  );
}
