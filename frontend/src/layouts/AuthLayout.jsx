export function AuthLayout({ title, intro, aside, children }) {
  return (
    <div className="auth-wrap">
      <section className="auth-aside" aria-label="About FixNow">
        <h1>{aside?.title ?? 'Know the price before the work starts.'}</h1>
        {aside?.body ?? <p>A technician inspects first, then sends an itemized quotation. Nothing begins until you approve it.</p>}
        <ul>{(aside?.points ?? ['Book a service in a few minutes', 'Approve or reject the itemized quote', 'Follow every step of your booking']).map((p) => <li key={p}>{p}</li>)}</ul>
      </section>
      <section className="auth-main"><div className="auth-card"><h2>{title}</h2>{intro && <p className="muted">{intro}</p>}{children}</div></section>
    </div>
  );
}
