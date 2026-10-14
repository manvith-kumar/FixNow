import { Link } from 'react-router-dom';

const VARIANT = { primary: 'btn-primary', brand: 'btn-brand', secondary: '', danger: 'btn-danger', ghost: 'btn-ghost', dangerSolid: 'btn-danger solid' };

/** Button with built-in busy state. While `busy` it is disabled and announces progress, which also blocks double submits. */
export function Button({ variant = 'secondary', size, block, busy, busyLabel, disabled, className = '', children, type = 'button', ...rest }) {
  const cls = ['btn', VARIANT[variant], size && `btn-${size}`, block && 'btn-block', className].filter(Boolean).join(' ');
  return (
    <button type={type} className={cls} disabled={disabled || busy} aria-busy={busy || undefined} {...rest}>
      {busy && <span className="spinner" aria-hidden="true" />}
      {busy && busyLabel ? busyLabel : children}
    </button>
  );
}
export function LinkButton({ to, variant = 'secondary', size, block, className = '', children, ...rest }) {
  const cls = ['btn', VARIANT[variant], size && `btn-${size}`, block && 'btn-block', className].filter(Boolean).join(' ');
  return <Link to={to} className={cls} {...rest}>{children}</Link>;
}
