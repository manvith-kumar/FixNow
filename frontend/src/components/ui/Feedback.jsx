import { Button } from './Button.jsx';
import { getErrorMessage } from '../../utils/errors.js';

export const Spinner = ({ large }) => <span className={`spinner ${large ? 'spinner-lg' : ''}`} role="status" aria-label="Loading" />;

export function LoadingState({ label = 'Loading...' }) {
  return <div className="state" role="status" aria-live="polite"><Spinner large /><p>{label}</p></div>;
}
/** `as` sets the heading level: use "h1" when the state IS the whole page (for example "not found"). */
export function EmptyState({ title = 'Nothing here yet', children, action, as: Heading = 'h3' }) {
  return <div className="state"><Heading>{title}</Heading>{children && <p>{children}</p>}{action}</div>;
}
export function ErrorState({ error, onRetry, title = 'Could not load this page' }) {
  return (
    <div className="state" role="alert">
      <h3>{title}</h3>
      <p>{typeof error === 'string' ? error : getErrorMessage(error)}</p>
      {onRetry && <Button onClick={onRetry}>Try again</Button>}
    </div>
  );
}
export function Alert({ tone = 'info', title, children, onClose }) {
  if (!children && !title) return null;
  return (
    <div className={`alert alert-${tone}`} role={tone === 'bad' ? 'alert' : 'status'}>
      <div>{title && <strong>{title}</strong>}{children}</div>
      {onClose && <button type="button" className="icon-btn" aria-label="Dismiss" onClick={onClose}>&times;</button>}
    </div>
  );
}
export const SimulatedBanner = ({ children }) => (
  <div className="sim-banner" role="note">{children ?? 'Simulated payment: no real money is charged and no card or bank details are collected.'}</div>
);

/** Renders loading / error / empty / content for a useFetch result so every page handles all four states. */
export function Async({ state, empty, emptyTitle, emptyAction, isEmpty, children, loadingLabel }) {
  const { data, loading, error, reload } = state;
  if (loading && (data === null || data === undefined)) return <LoadingState label={loadingLabel} />;
  if (error && (data === null || data === undefined)) return <ErrorState error={error} onRetry={reload} />;
  // No data, no error and not loading means the request has not started yet: never hand `null` to the render callback.
  if (data === null || data === undefined) return <LoadingState label={loadingLabel} />;
  const emptyNow = isEmpty ? isEmpty(data) : Array.isArray(data) && data.length === 0;
  if (emptyNow && (empty || emptyTitle)) return <EmptyState title={emptyTitle} action={emptyAction}>{empty}</EmptyState>;
  return <>{error && <Alert tone="bad">{getErrorMessage(error)}</Alert>}{children(data)}</>;
}
