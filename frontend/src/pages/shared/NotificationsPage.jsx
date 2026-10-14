import { useNavigate } from 'react-router-dom';
import { notificationsApi, quotationsApi } from '../../api/index.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { useUnread } from '../../context/NotificationsContext.jsx';
import { usePagedList } from '../../hooks/usePagedList.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { Button, EmptyState, ErrorState, LoadingState, PageHeader, Pagination, CheckField } from '../../components/ui/index.js';
import { timeAgo } from '../../utils/format.js';
import { getErrorMessage } from '../../utils/errors.js';

const PATHS = {
  CUSTOMER: { booking: (id) => `/customer/bookings/${id}`, payment: () => '/customer/payments', review: () => '/customer/reviews' },
  TECHNICIAN: { booking: (id) => `/technician/jobs/${id}`, application: () => '/technician/application', payment: () => '/technician/earnings', review: () => '/technician/reviews' },
  ADMIN: { booking: (id) => `/admin/bookings/${id}`, application: (id) => `/admin/applications/${id}`, payment: () => '/admin/payments', review: () => '/admin/reviews' },
};

export default function NotificationsPage() {
  useDocumentTitle('Notifications');
  const { user } = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  const { refresh } = useUnread();
  const list = usePagedList((p) => notificationsApi.list({ page: p.page, pageSize: p.pageSize, unreadOnly: p.unreadOnly ? 'true' : undefined }), { unreadOnly: false }, { pageSize: 20 });
  const paths = PATHS[user.role];

  const open = async (n) => {
    try {
      if (!n.is_read) { await notificationsApi.markRead(n.id); refresh(); list.reload(); }
      let target;
      if (n.resource_type === 'quotation') target = paths.booking((await quotationsApi.getOne(n.resource_id)).data.bookingId);
      else if (paths[n.resource_type]) target = paths[n.resource_type](n.resource_id);
      if (target) nav(target);
    } catch (e) { toast.error(getErrorMessage(e)); }
  };
  const readAll = async () => { try { await notificationsApi.markAllRead(); toast.success('All notifications marked as read.'); refresh(); list.reload(); } catch (e) { toast.error(getErrorMessage(e)); } };
  const unread = list.meta?.unread ?? 0;

  return (
    <>
      <PageHeader title="Notifications" subtitle={unread ? `${unread} unread` : 'You are all caught up.'} actions={<Button onClick={readAll} disabled={!unread}>Mark all as read</Button>} />
      <div className="panel panel-flush">
        <div style={{ padding: 'var(--s-4) var(--s-5) 0' }}><CheckField label="Show unread only" checked={list.filters.unreadOnly} onChange={(e) => list.setFilter('unreadOnly', e.target.checked)} /></div>
        {list.loading && list.data === null ? <LoadingState /> : list.error && list.data === null ? <ErrorState error={list.error} onRetry={list.reload} /> : !list.rows.length ? <EmptyState title="No notifications">Updates about your bookings, quotations and payments will show up here.</EmptyState> : (
          <>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {list.rows.map((n) => (
                <li key={n.id} className={`notif ${n.is_read ? '' : 'unread'}`}>
                  <div className="grow"><strong>{n.title}</strong><span>{n.message}</span><div className="muted small">{timeAgo(n.created_at)}</div></div>
                  <Button size="sm" onClick={() => open(n)}>{n.is_read ? 'Open' : 'Open and mark read'}</Button>
                </li>
              ))}
            </ul>
            <Pagination meta={list.meta} onPage={list.setPage} loading={list.loading} />
          </>
        )}
      </div>
    </>
  );
}
