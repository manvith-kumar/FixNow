import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { NotificationsProvider, useUnread } from '../context/NotificationsContext.jsx';
import { NAV_BY_ROLE, notificationsPath } from './nav.js';
import { ROLE_LABEL } from '../utils/status.js';
import { initials } from '../utils/format.js';
import { Logo } from '../components/ui/index.js';

function Shell() {
  const { user, logout } = useAuth();
  const { unread, refresh } = useUnread();
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  useEffect(() => { setOpen(false); refresh(); }, [pathname, refresh]);
  const items = NAV_BY_ROLE[user.role] ?? [];
  const doLogout = () => logout(); // <ProtectedRoute> sends a signed-out user home (single owner of that redirect)
  return (
    <div className={`shell ${open ? 'nav-open' : ''}`}>
      <a className="skip-link" href="#content">Skip to content</a>
      <aside className="sidebar" aria-label="Sidebar">
        <Link to="/" className="brand"><Logo />FixNow</Link>
        <div className="role-tag">{ROLE_LABEL[user.role]} area</div>
        <nav className="side-nav" aria-label={`${ROLE_LABEL[user.role]} navigation`}>
          {items.map((it, i) => it.group
            ? <div key={`g${i}`} className="group">{it.group}</div>
            : <NavLink key={it.to} to={it.to} end={it.end}>{it.label}{it.badge === 'unread' && unread > 0 && <span className="nav-count" aria-label={`${unread} unread`}>{unread > 99 ? '99+' : unread}</span>}</NavLink>)}
        </nav>
        <button type="button" className="nav-link" onClick={doLogout}>Log out</button>
      </aside>
      <div className="scrim" onClick={() => setOpen(false)} aria-hidden="true" />
      <div className="shell-main">
        <header className="topbar">
          <button type="button" className="btn btn-sm nav-toggle" aria-expanded={open} onClick={() => setOpen((o) => !o)}>Menu</button>
          <div className="grow" />
          <Link to={notificationsPath(user.role)} className="bell" aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></svg>
            {unread > 0 && <span className="nav-count">{unread > 99 ? '99+' : unread}</span>}
          </Link>
          <div className="who"><strong>{user.fullName}</strong><span className="muted small">{user.email}</span></div>
          <div className="avatar" aria-hidden="true">{initials(user.fullName)}</div>
        </header>
        <main id="content" className="page"><Outlet /></main>
      </div>
    </div>
  );
}
export const DashboardLayout = () => <NotificationsProvider><Shell /></NotificationsProvider>;
