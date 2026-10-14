import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { LinkButton } from '../../components/ui/index.js';
import { homeFor } from '../../utils/status.js';

const Err = ({ code, title, children, actions }) => (
  <div className="error-page"><div><div className="code" aria-hidden="true">{code}</div><h1>{title}</h1><p className="muted">{children}</p><div className="row" style={{ justifyContent: 'center' }}>{actions}</div></div></div>
);
export function NotFound() {
  useDocumentTitle('Page not found');
  return <Err code="404" title="We could not find that page" actions={<><LinkButton to="/" variant="primary">Go to home</LinkButton><LinkButton to="/services">Browse services</LinkButton></>}>The link may be old or mistyped.</Err>;
}
export function Unauthorized() {
  useDocumentTitle('Not allowed');
  const { user } = useAuth();
  return (
    <Err code="403" title="You do not have access to that page" actions={user ? <LinkButton to={homeFor(user.role)} variant="primary">Back to my dashboard</LinkButton> : <><LinkButton to="/login" variant="primary">Log in</LinkButton><Link to="/">Home</Link></>}>
      {user ? 'This area belongs to a different type of account.' : 'Log in to continue.'}
    </Err>
  );
}
export function ServerError() {
  useDocumentTitle('Server error');
  return <Err code="500" title="The server had a problem" actions={<LinkButton to="/" variant="primary">Back to home</LinkButton>}>Please try again in a moment. If it keeps happening, contact support.</Err>;
}
