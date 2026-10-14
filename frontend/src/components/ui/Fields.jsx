import { useId } from 'react';

function FieldShell({ id, label, hint, error, required, children, className = '' }) {
  return (
    <div className={`field ${className}`}>
      {label && <label htmlFor={id}>{label}{required && <span className="req" aria-hidden="true"> *</span>}</label>}
      {children}
      {hint && !error && <span className="hint" id={`${id}-hint`}>{hint}</span>}
      {error && <span className="field-error" id={`${id}-err`} role="alert">{error}</span>}
    </div>
  );
}
const aria = (id, hint, error) => ({ 'aria-invalid': error ? 'true' : undefined, 'aria-describedby': error ? `${id}-err` : hint ? `${id}-hint` : undefined });

export function TextField({ label, hint, error, required, className, ...rest }) {
  const id = useId();
  return <FieldShell {...{ id, label, hint, error, required, className }}><input id={id} className="input" required={required} {...aria(id, hint, error)} {...rest} /></FieldShell>;
}
export function TextareaField({ label, hint, error, required, className, ...rest }) {
  const id = useId();
  return <FieldShell {...{ id, label, hint, error, required, className }}><textarea id={id} className="textarea" required={required} {...aria(id, hint, error)} {...rest} /></FieldShell>;
}
export function SelectField({ label, hint, error, required, className, options = [], placeholder, children, ...rest }) {
  const id = useId();
  return (
    <FieldShell {...{ id, label, hint, error, required, className }}>
      <select id={id} className="select" required={required} {...aria(id, hint, error)} {...rest}>
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        {children}
      </select>
    </FieldShell>
  );
}
export function CheckField({ label, error, children, ...rest }) {
  const id = useId();
  return (
    <div className="field">
      <label className="check" htmlFor={id}><input id={id} type="checkbox" {...rest} /><span>{label ?? children}</span></label>
      {error && <span className="field-error" role="alert">{error}</span>}
    </div>
  );
}
