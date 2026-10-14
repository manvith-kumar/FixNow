import { Link } from 'react-router-dom';
import { reviewsApi } from '../../api/index.js';
import { useFetch } from '../../hooks/useFetch.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { Async, Badge, Card, PageHeader, Stars } from '../../components/ui/index.js';
import { formatDate } from '../../utils/format.js';

export default function MyReviewsPage({ role }) {
  useDocumentTitle('My reviews');
  const list = useFetch(() => reviewsApi.mine({ pageSize: 50 }));
  const customer = role === 'CUSTOMER';
  return (
    <>
      <PageHeader title={customer ? 'Reviews you wrote' : 'Reviews about you'} subtitle={customer ? 'You can review a booking once it is completed, from the booking page.' : 'Visible customer reviews for your completed jobs.'} />
      <Async state={list} emptyTitle="No reviews yet" empty={customer ? 'Complete a booking to leave your first review.' : 'Reviews appear here after customers rate your completed jobs.'}>
        {(rows) => rows.map((r) => (
          <Card key={r.id}><div className="row-between"><span><Stars value={r.rating} /> <strong>{r.serviceName}</strong></span>{customer && r.status === 'HIDDEN' && <Badge tone="muted">Hidden by moderator</Badge>}</div>
            <p style={{ margin: '.5rem 0' }}>{r.comment || 'No written comment.'}</p>
            <span className="small muted">{customer ? `Technician ${r.technicianName}` : `By ${r.reviewer}`}, booking <Link to={customer ? `/customer/bookings/${r.bookingId}` : `/technician/jobs/${r.bookingId}`}>{r.bookingReference}</Link>, {formatDate(r.createdAt)}</span></Card>
        ))}
      </Async>
    </>
  );
}
