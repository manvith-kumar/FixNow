import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { homeFor } from '../utils/status.js';
import { LinkButton, Logo } from '../components/ui/index.js';

const NAV = [['/services', 'Services'], ['/how-it-works', 'How it works'], ['/about', 'About'], ['/contact', 'Contact']];

export function PublicLayout() {
  const { user, isAuthenticated, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  useEffect(() => { setOpen(false); window.scrollTo?.(0, 0); }, [pathname]);
  return (
    <>
      <a className="skip-link" href="#main">Skip to content</a>
      <header className={`site-header ${open ? 'open' : ''}`}>
        <div className="container inner">
          <Link to="/" className="brand" aria-label="FixNow home"><Logo />FixNow</Link>
          <nav className="main-nav" aria-label="Main">{NAV.map(([to, label]) => <NavLink key={to} to={to}>{label}</NavLink>)}</nav>
          <div className="header-actions">
            {isAuthenticated ? (
              <><LinkButton to={homeFor(user.role)} variant="brand" size="sm">Open my dashboard</LinkButton><button className="btn btn-sm" type="button" onClick={logout}>Log out</button></>
            ) : (
              <><LinkButton to="/login" size="sm">Log in</LinkButton><LinkButton to="/register" variant="primary" size="sm">Create account</LinkButton></>
            )}
          </div>
          <button type="button" className="btn btn-sm menu-toggle" aria-expanded={open} aria-controls="main-nav" onClick={() => setOpen((o) => !o)}>{open ? 'Close' : 'Menu'}</button>
        </div>
      </header>
      <main id="main"><Outlet /></main>
      <footer className="site-footer">
        <div className="container">
          <div className="footer-grid">
            <div><Link to="/" className="brand"><Logo />FixNow</Link><p style={{ marginTop: '.75rem', maxWidth: '22rem' }}>Home repairs with an inspection first and an itemized quote you approve before work begins.</p></div>
            <div><h4>Customers</h4><ul><li><Link to="/services">Browse services</Link></li><li><Link to="/how-it-works">How it works</Link></li><li><Link to="/register">Create an account</Link></li></ul></div>
            <div><h4>Technicians</h4><ul><li><Link to="/register?role=TECHNICIAN">Apply to join</Link></li><li><Link to="/login">Technician log in</Link></li></ul></div>
            <div><h4>FixNow</h4><ul><li><Link to="/about">About</Link></li><li><Link to="/contact">Contact</Link></li><li><Link to="/privacy">Privacy policy</Link></li><li><Link to="/terms">Terms and conditions</Link></li></ul></div>
          </div>
          <div className="footer-bottom"><span>&copy; {new Date().getFullYear()} FixNow. Payments on this site are simulated.</span><span>Catalogue prices are indicative; the final price is your approved quotation.</span></div>
        </div>
      </footer>
    </>
  );
}
