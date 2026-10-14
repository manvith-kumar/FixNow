import { QuoteBadge, TableWrap } from '../ui/index.js';
import { formatDate, formatDateTime, formatMoney } from '../../utils/format.js';
import { itemTypeLabel } from '../../utils/status.js';

/** Renders a quotation exactly as the backend calculated it. No totals are computed in the browser. */
export function QuotationView({ quotation: q, old = false }) {
  if (!q) return null;
  const hasDiscount = Number(q.discountAmount) > 0;
  return (
    <div className={`quote ${old ? 'is-old' : ''}`}>
      <div className="quote-head">
        <strong>Quotation version {q.versionNumber}</strong>
        <span className="row"><QuoteBadge status={q.status} /><span className="small muted">Sent {formatDateTime(q.createdAt)}</span></span>
      </div>
      <TableWrap label="Quotation line items">
        <table className="table">
          <caption className="sr-only">Quotation line items</caption>
          <thead><tr><th scope="col">Item</th><th scope="col">Type</th><th scope="col" className="num">Qty</th><th scope="col" className="num">Unit price</th><th scope="col" className="num">Amount</th></tr></thead>
          <tbody>{(q.items ?? []).map((i) => (
            <tr key={i.id}><td>{i.description}</td><td>{itemTypeLabel(i.itemType)}</td><td className="num">{i.quantity}</td><td className="num">{formatMoney(i.unitPrice)}</td><td className="num">{formatMoney(i.lineTotal)}</td></tr>
          ))}</tbody>
        </table>
      </TableWrap>
      <div className="quote-totals">
        <div><span>Subtotal</span><span>{formatMoney(q.subtotal)}</span></div>
        {hasDiscount && <div><span>Discount</span><span>- {formatMoney(q.discountAmount)}</span></div>}
        {Number(q.taxAmount) > 0 && <div><span>Tax ({Number(q.taxRate)}%)</span><span>{formatMoney(q.taxAmount)}</span></div>}
        <div className="grand"><span>Total</span><span>{formatMoney(q.totalAmount)}</span></div>
      </div>
      <div className="quote-note">
        {q.validUntil && <div><strong>Valid until:</strong> {formatDate(q.validUntil)}</div>}
        {q.notes && <div><strong>Technician notes:</strong> {q.notes}</div>}
        {q.revisionNotes && <div><strong>Why this was revised:</strong> {q.revisionNotes}</div>}
        {q.decisionReason && <div><strong>Decision reason:</strong> {q.decisionReason}</div>}
        {q.decidedAt && <div className="muted">Decided {formatDateTime(q.decidedAt)}</div>}
      </div>
    </div>
  );
}

/** Earlier versions stay available (never overwritten). `versions` is newest first. */
export function QuotationHistory({ versions, currentId }) {
  const older = (versions ?? []).filter((v) => v.id !== currentId);
  if (!older.length) return null;
  return (
    <div style={{ marginTop: 'var(--s-4)' }}>
      <h3 style={{ fontSize: '1.05rem' }}>Earlier versions</h3>
      {older.map((v) => (
        <details key={v.id} className="version">
          <summary>Version {v.versionNumber}<QuoteBadge status={v.status} /><span className="muted small">Total {formatMoney(v.totalAmount)}</span></summary>
          <div className="inner"><QuotationView quotation={v} old /></div>
        </details>
      ))}
    </div>
  );
}
