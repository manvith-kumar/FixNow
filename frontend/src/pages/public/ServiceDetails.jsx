import { Link, useParams } from 'react-router-dom';
import { catalogueApi, reviewsApi } from '../../api/index.js';
import { useFetch } from '../../hooks/useFetch.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { Async, Stars, EmptyState } from '../../components/ui/index.js';
import { BookLink } from '../../components/common/ServiceCard.jsx';
import { formatMoney, formatDate } from '../../utils/format.js';
import { getStatus } from '../../utils/errors.js';

export default function ServiceDetails() {
  const { id } = useParams();
  const svc = useFetch(() => catalogueApi.getService(id), [id]);
  const reviews = useFetch(() => reviewsApi.publicList({ serviceId: id, pageSize: 5 }), [id]);
  useDocumentTitle(svc.data?.name ?? 'Service');
  if (svc.error && getStatus(svc.error) === 404) return <div className="container"><EmptyState as="h1" title="Service not found" action={<Link to="/services">Browse all services</Link>}>It may have been removed or is not available right now.</EmptyState></div>;
  return (
    <div className="container section-tight">
      <p className="small"><Link to="/services">All services</Link></p>
      <Async state={svc}>
        {(s) => (
          <div className="detail-grid">
            <div>
              <h1>{s.name}</h1>
              <p className="muted">{s.categoryName}</p>
              <p style={{ fontSize: 'var(--text-lg)' }}>{s.description}</p>
              <h2 style={{ fontSize: '1.4rem', marginTop: 'var(--s-6)' }}>What happens after you book</h2>
              <ol className="stack"><li>A reviewed technician accepts your booking.</li><li>They inspect the problem and record what they find.</li><li>You receive an itemized quotation and approve or reject it.</li><li>Work starts only after you approve. You then pay the approved amount.</li></ol>
              <h2 style={{ fontSize: '1.4rem', marginTop: 'var(--s-6)' }}>Customer reviews</h2>
              {s.reviewCount ? <p><Stars value={Math.round(Number(s.avgRating))} /> <span className="muted">{s.avgRating} average from {s.reviewCount} review{s.reviewCount > 1 ? 's' : ''}</span></p> : <p className="muted">No reviews yet for this service.</p>}
              {(reviews.data ?? []).map((r) => <div key={r.id} className="panel"><Stars value={r.rating} /><p style={{ margin: '.4rem 0' }}>{r.comment || 'No written comment.'}</p><span className="small muted">{r.reviewer}, {formatDate(r.createdAt)}</span></div>)}
            </div>
            <aside className="panel">
              {s.indicativeStartingPrice ? <><div className="muted small">Indicative starting price</div><div style={{ font: '700 2rem var(--font-display)' }}>{formatMoney(s.indicativeStartingPrice)}</div></> : <div className="muted">Price set after inspection</div>}
              <p className="small muted" style={{ marginTop: '.5rem' }}>{s.priceDisclaimer}</p>
              <BookLink serviceId={s.id} />
            </aside>
          </div>
        )}
      </Async>
    </div>
  );
}
