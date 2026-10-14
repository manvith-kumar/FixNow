import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from './Button.jsx';
import { TextareaField } from './Fields.jsx';
import { Alert } from './Feedback.jsx';

const FOCUSABLE = 'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';

/** Accessible dialog: focus moves in, Tab is trapped, Escape closes, focus returns to the opener. */
let scrollLocks = 0; // several dialogs can be open at once; release the scroll lock only when the last one closes
let savedOverflow = '';

export function Modal({ open, title, onClose, children, footer, wide, dismissible = true }) {
  const ref = useRef(null);
  const titleId = useId();
  // Keep the latest callbacks in refs so a parent re-render never re-runs the focus/scroll-lock effect
  // (which would move focus to the first field while the user is typing).
  const onCloseRef = useRef(onClose);
  const dismissibleRef = useRef(dismissible);
  onCloseRef.current = onClose;
  dismissibleRef.current = dismissible;

  useEffect(() => {
    if (!open) return undefined;
    const opener = document.activeElement;
    const node = ref.current;
    const first = node?.querySelector('[data-autofocus]') || node?.querySelector(FOCUSABLE);
    first?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape' && dismissibleRef.current) { e.stopPropagation(); onCloseRef.current?.(); }
      if (e.key === 'Tab' && node) {
        const items = [...node.querySelectorAll(FOCUSABLE)];
        if (!items.length) return;
        const a = items[0], z = items[items.length - 1];
        if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); }
        else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    if (scrollLocks++ === 0) { savedOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden'; }
    return () => {
      document.removeEventListener('keydown', onKey);
      if (--scrollLocks === 0) document.body.style.overflow = savedOverflow;
      opener?.focus?.();
    };
  }, [open]);
  if (!open) return null;
  return createPortal(
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget && dismissible) onClose?.(); }}>
      <div className={`modal ${wide ? 'modal-wide' : ''}`} role="dialog" aria-modal="true" aria-labelledby={titleId} ref={ref}>
        <div className="modal-head"><h2 id={titleId}>{title}</h2>{dismissible && <button type="button" className="icon-btn" aria-label="Close dialog" onClick={onClose}>&times;</button>}</div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>, document.body);
}

/** Confirmation before a consequential action. `onConfirm` may be async; the dialog shows progress and any error. */
export function ConfirmDialog({ open, title, message, confirmLabel = 'Confirm', cancelLabel = 'Keep as is', danger, onConfirm, onClose, children }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { if (open) { setError(''); setBusy(false); } }, [open]);
  const go = async () => {
    if (busy) return;
    setBusy(true); setError('');
    try { await onConfirm(); } catch (e) { setError(e?.message || 'Action failed'); } finally { setBusy(false); }
  };
  return (
    <Modal open={open} title={title} onClose={busy ? undefined : onClose} dismissible={!busy}
      footer={<><Button onClick={onClose} disabled={busy}>{cancelLabel}</Button><Button variant={danger ? 'dangerSolid' : 'primary'} busy={busy} onClick={go} data-autofocus>{confirmLabel}</Button></>}>
      {error && <Alert tone="bad">{error}</Alert>}
      {message && <p>{message}</p>}{children}
    </Modal>
  );
}

/** Asks for a written reason (reject quotation, cancel booking, reject application...). */
export function ReasonDialog({ open, title, message, label = 'Reason', minLength = 5, confirmLabel = 'Confirm', danger = true, required = true, onSubmit, onClose }) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) { setReason(''); setError(''); setBusy(false); } }, [open]);
  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    const t = reason.trim();
    if (required && t.length < minLength) { setError(`Please enter at least ${minLength} characters.`); return; }
    setBusy(true); setError('');
    try { await onSubmit(t); } catch (err) { setError(err?.message || 'Action failed'); } finally { setBusy(false); }
  };
  return (
    <Modal open={open} title={title} onClose={busy ? undefined : onClose} dismissible={!busy}>
      <form onSubmit={submit} noValidate>
        {message && <p>{message}</p>}
        <TextareaField label={label} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} data-autofocus required={required} />
        {error && <Alert tone="bad">{error}</Alert>}
        <div className="form-actions"><Button onClick={onClose} disabled={busy}>Cancel</Button><Button type="submit" variant={danger ? 'dangerSolid' : 'primary'} busy={busy}>{confirmLabel}</Button></div>
      </form>
    </Modal>
  );
}
