import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { catalogueApi, reviewsApi } from '../../api/index.js';
import { useFetch } from '../../hooks/useFetch.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { Button, LinkButton, Stars } from '../../components/ui/index.js';
import { ServiceCard } from '../../components/common/ServiceCard.jsx';
import { formatDate } from '../../utils/format.js';

function JobCard() {
  return (
    <aside className="jobcard" aria-label="Example of a FixNow job card">
      <div className="jc-top"><b>Job card</b><span className="tag-example">Example, not a real booking</span></div>
      <ul className="jc-steps">
        <li><span className="tick" aria-hidden="true">&#10003;</span>Booked: kitchen tap leaking</li>
        <li><span className="tick" aria-hidden="true">&#10003;</span>Technician inspected: worn washer</li>
        <li className="now"><span className="tick" aria-hidden="true">!</span>Your decision on the quote</li>
        <li className="todo"><span className="tick" aria-hidden="true" />Repair, then pay</li>
      </ul>
      <table><tbody>
        <tr><td>Labour, 2 hrs</td><td>&#8377;600.00</td></tr>
        <tr><td>Washer set</td><td>&#8377;149.50</td></tr>
        <tr><td>Tax (18%)</td><td>&#8377;134.91</td></tr>
      </tbody></table>
      <div className="jc-total"><span>Total</span><span>&#8377;884.41</span></div>
      <div className="jc-sign" aria-hidden="true"><span>Reject</span><span className="yes">Approve</span></div>
    </aside>
  );
}

const STEPS = [
  ['Book', 'Choose a service, describe the problem and pick an address and time.'],
  ['Inspection', 'A technician accepts your job and inspects the problem.'],
  ['Itemized quote', 'You receive a line-by-line quotation. Approve it, or reject it and get a revised one.'],
  ['Repair and pay', 'Work starts only after approval. When it is done you pay the approved amount.'],
];

export default function Home() {
  useDocumentTitle('');
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const cats = useFetch(() => catalogueApi.listCategories());
  const featured = useFetch(() => catalogueApi.listServices({ featured: true, pageSize: 6 }));
  const reviews = useFetch(() => reviewsApi.publicList({ pageSize: 3 }));
  const submit = (e) => { e.preventDefault(); nav(`/services${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ''}`); };

  return (
    <>
      <section className="hero">
        <div className="container hero-grid">
          <div>
            <h1>Repairs you approve before they start.</h1>
            <p className="lede">Book a plumber, electrician or appliance technician. They inspect first and send an itemized quote. You pay only the amount you approved.</p>
            <form className="search-bar" onSubmit={submit} role="search">
              <label className="sr-only" htmlFor="home-search">Search services</label>
              <input id="home-search" className="input" placeholder="What needs fixing?" value={q} onChange={(e) => setQ(e.target.value)} />
              <Button type="submit" variant="primary" size="lg">Find a service</Button>
            </form>
            <div className="hero-links"><Link to="/how-it-works">See how a booking works</Link><span className="muted">or</span><Link to="/register?role=TECHNICIAN">apply as a technician</Link></div>
          </div>
          <JobCard />
        </div>
      </section>

      <section className="section band" aria-labelledby="cat-h">
        <div className="container">
          <div className="section-head"><h2 id="cat-h">Choose a category</h2><p>Every service is a starting point: the final price is decided after inspection.</p></div>
          {cats.error ? <p className="muted">Categories could not be loaded. <button className="link-btn" onClick={cats.reload}>Try again</button></p> : (
            <div className="cat-grid">
              {(cats.data ?? []).map((c) => (
                <Link key={c.id} to={`/services?categoryId=${c.id}`} className="cat-card"><h3>{c.name}</h3><p>{c.description}</p></Link>
              ))}
              {cats.loading && !cats.data && <p className="muted">Loading categories...</p>}
            </div>)}
        </div>
      </section>

      {(featured.data?.length ?? 0) > 0 && (
        <section className="section" aria-labelledby="feat-h">
          <div className="container">
            <div className="row-between section-head" style={{ maxWidth: 'none' }}><h2 id="feat-h">Popular services</h2><Link to="/services">View all services</Link></div>
            <div className="svc-grid">{featured.data.map((s) => <ServiceCard key={s.id} service={s} />)}</div>
            <p className="small muted" style={{ marginTop: 'var(--s-3)' }}>Prices shown are indicative starting prices, not final quotations.</p>
          </div>
        </section>
      )}

      <section className="section band" aria-labelledby="how-h">
        <div className="container">
          <div className="section-head"><h2 id="how-h">How a booking works</h2><p>The quote comes after the inspection, so nobody is guessing the price.</p></div>
          <ol className="steps">{STEPS.map(([t, d]) => <li key={t}><h3>{t}</h3><p>{d}</p></li>)}</ol>
        </div>
      </section>

      <section className="section" aria-labelledby="trust-h">
        <div className="container">
          <div className="section-head"><h2 id="trust-h">What protects you</h2></div>
          <ul className="trust-list">
            <li><strong>Technicians are reviewed first</strong>They must apply with documents and be approved by a FixNow administrator before they can accept any job.</li>
            <li><strong>You approve the price</strong>Work cannot start until you approve the current quotation. If the scope changes, you get a new quote to approve.</li>
            <li><strong>Every version is kept</strong>Revised quotations never overwrite the earlier ones, so you can compare what changed.</li>
            <li><strong>Track every step</strong>See the status timeline, notifications and the technician assigned to your booking.</li>
          </ul>
          <p className="small muted">In this release payments are simulated: no real money moves and no card details are collected.</p>
        </div>
      </section>

      {(reviews.data?.length ?? 0) > 0 && (
        <section className="section band" aria-labelledby="rev-h">
          <div className="container">
            <div className="section-head"><h2 id="rev-h">Recent customer reviews</h2></div>
            <div className="grid grid-3">{reviews.data.map((r) => (
              <figure key={r.id} className="panel" style={{ margin: 0 }}><Stars value={r.rating} /><blockquote style={{ margin: '.5rem 0' }}>{r.comment || 'No written comment.'}</blockquote><figcaption className="small muted">{r.reviewer}, {r.serviceName}, {formatDate(r.createdAt)}</figcaption></figure>
            ))}</div>
          </div>
        </section>
      )}

      <section className="section"><div className="container">
        <div className="cta-band"><div><h2>Ready to get it fixed?</h2><p>Create a free account and book your first inspection.</p></div><LinkButton to="/register" variant="primary" size="lg">Create your account</LinkButton></div>
      </div></section>
    </>
  );
}
