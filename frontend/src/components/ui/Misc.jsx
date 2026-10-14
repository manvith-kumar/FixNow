import { useState } from 'react';

export function PageHeader({ title, subtitle, actions }) {
  return <div className="page-head"><div><h1>{title}</h1>{subtitle && <p>{subtitle}</p>}</div>{actions && <div className="row">{actions}</div>}</div>;
}
export function Tabs({ tabs, value, onChange, label = 'Sections' }) {
  return (
    <div className="tabs" role="tablist" aria-label={label}>
      {tabs.map((t) => <button key={t.value} role="tab" type="button" className="tab" aria-selected={value === t.value} onClick={() => onChange(t.value)}>{t.label}</button>)}
    </div>
  );
}
export const Stars = ({ value }) => <span className="stars" role="img" aria-label={`${value} out of 5 stars`}>{'\u2605'.repeat(value)}{'\u2606'.repeat(5 - value)}</span>;
export function StarInput({ value, onChange, label = 'Rating' }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="star-input" role="radiogroup" aria-label={label}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={`${n} star${n > 1 ? 's' : ''}`}
          className={(hover || value) >= n ? 'on' : ''} onMouseEnter={() => setHover(n)} onMouseLeave={() => setHover(0)} onClick={() => onChange(n)}>{'\u2605'}</button>
      ))}
    </div>
  );
}
export const Card = ({ title, actions, children, flush, className = '' }) => (
  <section className={`panel ${flush ? 'panel-flush' : ''} ${className}`}>
    {(title || actions) && <div className="panel-head" style={flush ? { padding: 'var(--s-4) var(--s-5) 0' } : undefined}>{title && <h2 style={{ fontSize: '1.25rem' }}>{title}</h2>}{actions}</div>}
    {children}
  </section>
);
export function Dl({ items }) {
  return <dl className="dl">{items.filter(Boolean).map(([k, v]) => <div key={k} style={{ display: 'contents' }}><dt>{k}</dt><dd>{v ?? '-'}</dd></div>)}</dl>;
}
export const Logo = ({ size = 32 }) => (
  <svg className="brand-mark" width={size} height={size} viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" rx="14" fill="#0F4C6B" /><path d="M38 12a14 14 0 0 0-12.6 20L12 45.4 18.6 52 32 38.6A14 14 0 0 0 52 26l-8 8-7-1-1-7 8-8a14 14 0 0 0-6-4z" fill="#F5B800" /></svg>
);

/** Horizontally scrollable table container. tabIndex + region role make the scrollable area reachable and operable with the keyboard (WCAG 2.1.1). */
export const TableWrap = ({ label = 'Table', children, ...rest }) => (
  <div className="table-wrap" role="region" aria-label={label} tabIndex={0} {...rest}>{children}</div>
);
