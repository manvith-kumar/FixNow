import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { LoadingState } from '../components/ui/index.js';

/**
 * Frontend route guard (a convenience, NOT the security boundary: the API enforces roles on every request).
 * Anonymous -> /login (remembering the destination). Wrong role -> /unauthorized.
 */
export function ProtectedRoute({ roles }) {
  const { status, user, signedOut } = useAuth();
  const location = useLocation();
  if (status === 'loading') return <LoadingState label="Restoring your session..." />;
  // A deliberate log out goes home. A missing/expired session goes to /login and remembers where the person was headed.
  if (status !== 'authenticated') return signedOut ? <Navigate to="/" replace /> : <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/unauthorized" replace />;
  return <Outlet />;
}

/**
 * Login/register pages bounce signed-in users onward. This is the ONLY place that performs the post-login redirect:
 * pages must not navigate themselves after signing in, or their redirect would race with this one.
 * `target(user, location)` decides the destination.
 */
export function GuestRoute({ children, target }) {
  const { status, user } = useAuth();
  const location = useLocation();
  if (status === 'loading') return <LoadingState />;
  if (status === 'authenticated') return <Navigate to={target(user, location)} replace />;
  return children;
}
