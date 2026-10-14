import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { formatMoney } from '../../utils/format.js';
import { LinkButton } from '../ui/index.js';

/** Where "Book" leads: customers go straight to the booking form; everyone else is routed through login. */
export function BookLink({ serviceId, size, children = 'Book this service', variant = 'primary' }) {
  const { user } = useAuth();
  if (user && user.role !== 'CUSTOMER') return null; // technicians/admins do not book
  return <LinkButton to={`/customer/book?serviceId=${serviceId}`} variant={variant} size={size}>{children}</LinkButton>;
}

export function ServiceCard({ service }) {
  return (
    <article className="svc-card">
      <h3><Link to={`/services/${service.id}`}>{service.name}</Link></h3>
      <div className="cat">{service.categoryName}</div>
      <p>{service.description}</p>
      {service.indicativeStartingPrice && (
        <div className="price">From <b>{formatMoney(service.indicativeStartingPrice)}</b> <span className="muted">(indicative)</span></div>
      )}
      <div className="row">
        <BookLink serviceId={service.id} size="sm" />
        <Link to={`/services/${service.id}`} className="small">Details</Link>
      </div>
    </article>
  );
}
