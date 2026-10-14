import { bookingLabel } from '../../utils/status.js';
import { formatDateTime } from '../../utils/format.js';

export function StatusTimeline({ history }) {
  if (!history?.length) return <p className="muted">No history yet.</p>;
  return (
    <ol className="timeline" aria-label="Booking history">
      {history.map((h) => (
        <li key={h.id}>
          <strong>{bookingLabel(h.toStatus)}</strong>
          <div className="when">{formatDateTime(h.createdAt)}{h.actorName ? ` by ${h.actorName}` : ''}</div>
          {h.note && <div className="small">{h.note}</div>}
        </li>
      ))}
    </ol>
  );
}
