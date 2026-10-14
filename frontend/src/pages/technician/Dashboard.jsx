import { Link } from 'react-router-dom';
import { bookingsApi, techniciansApi } from '../../api/index.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useFetch } from '../../hooks/useFetch.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { Alert, ApplicationBadge, Async, BookingBadge, Card, LinkButton, PageHeader, TableWrap } from '../../components/ui/index.js';
import { formatDate, formatTime, formatMoney } from '../../utils/format.js';

export default function TechnicianDashboard() {
  useDocumentTitle('Overview');
  const { user } = useAuth();
  const profile = useFetch(() => techniciansApi.getMe());
  const approved = profile.data?.approvalStatus === 'APPROVED' && profile.data?.isActive;
  const avail = useFetch(() => bookingsApi.available({ pageSize: 1 }), [approved], { enabled: !!approved });
  const mine = useFetch(() => bookingsApi.list({ pageSize: 5 }), [approved], { enabled: !!approved });
  const awaiting = useFetch(() => bookingsApi.list({ status: 'QUOTATION_APPROVED', pageSize: 1 }), [approved], { enabled: !!approved });
  const earn = useFetch(() => techniciansApi.earnings(), [approved], { enabled: !!approved });
  return (
    <>
      <PageHeader title={`Hello, ${user.fullName.split(' ')[0]}`} subtitle="Your jobs and account status." />
      <Async state={profile} isEmpty={() => false}>
        {(p) => !approved ? (
          <Card title="Approval status" actions={<ApplicationBadge status={p.approvalStatus} />}>
            {!p.isActive && p.approvalStatus === 'APPROVED' ? <Alert tone="bad">Your technician account is currently deactivated. Contact support.</Alert>
              : p.approvalStatus === 'NOT_APPLIED' ? <><p>You have not applied yet. Submit your application so an administrator can review it.</p><LinkButton to="/technician/application" variant="primary">Start your application</LinkButton></>
              : <><p>{p.approvalStatus === 'PENDING' ? 'Your application is under review. You will be notified when it is decided.' : p.approvalStatus === 'NEEDS_INFO' ? 'The reviewer needs more information from you.' : 'Your application was not approved.'}</p><LinkButton to="/technician/application">View application</LinkButton></>}
            <p className="small muted" style={{ marginTop: 'var(--s-3)' }}>You cannot accept jobs until you are approved.</p>
          </Card>
        ) : (
          <>
            <div className="grid grid-4" style={{ marginBottom: 'var(--s-4)' }}>
              <div className={`stat ${(avail.meta?.total ?? 0) > 0 ? 'warn' : ''}`}><Link to="/technician/jobs/available" style={{ textDecoration: 'none' }}><div className="n">{avail.meta?.total ?? '-'}</div><div className="l">Open jobs you can accept</div></Link></div>
              <div className="stat"><div className="n">{awaiting.meta?.total ?? '-'}</div><div className="l">Approved quotes ready to start</div></div>
              <div className="stat"><div className="n">{mine.meta?.total ?? '-'}</div><div className="l">Jobs assigned to you</div></div>
              <div className="stat sim"><div className="n">{earn.data ? formatMoney(earn.data.totalAmount) : '-'}</div><div className="l">Earnings (simulated payments)</div></div>
            </div>
            <Card title="Your latest jobs" actions={<Link to="/technician/jobs">View all</Link>}>
              <Async state={mine} emptyTitle="No jobs yet" empty="Accept an open job to get started." emptyAction={<LinkButton to="/technician/jobs/available" variant="primary">See open jobs</LinkButton>}>
                {(rows) => <TableWrap label="Your latest jobs"><table className="table"><thead><tr><th>Booking</th><th>Service</th><th>When</th><th>Status</th></tr></thead><tbody>{rows.map((b) => <tr key={b.id}><td><Link to={`/technician/jobs/${b.id}`}>{b.reference}</Link></td><td>{b.service.name}</td><td>{formatDate(b.preferredDate)}, {formatTime(b.preferredTime)}</td><td><BookingBadge status={b.status} /></td></tr>)}</tbody></table></TableWrap>}
              </Async>
            </Card>
          </>
        )}
      </Async>
    </>
  );
}
