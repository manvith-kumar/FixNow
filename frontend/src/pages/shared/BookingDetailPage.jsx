import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { adminApi, bookingsApi, quotationsApi, techniciansApi } from '../../api/index.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { useFetch } from '../../hooks/useFetch.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { Alert, Async, BookingBadge, Button, Card, ConfirmDialog, Dl, Modal, PaymentBadge, ReasonDialog, SelectField, EmptyState, LoadingState } from '../../components/ui/index.js';
import { QuotationHistory, QuotationView } from '../../components/booking/QuotationView.jsx';
import { QuotationForm } from '../../components/booking/QuotationForm.jsx';
import { InspectionForm } from '../../components/booking/InspectionForm.jsx';
import { PaymentPanel, Receipt } from '../../components/booking/PaymentPanel.jsx';
import { ReviewForm } from '../../components/booking/ReviewForm.jsx';
import { StatusTimeline } from '../../components/booking/StatusTimeline.jsx';
import { ADMIN_CANCELLABLE, CUSTOMER_CANCELLABLE, bookingLabel } from '../../utils/status.js';
import { formatDate, formatDateTime, formatMoney, formatTime } from '../../utils/format.js';
import { getErrorMessage, getStatus } from '../../utils/errors.js';

const wrap = (fn) => async (...a) => { try { return await fn(...a); } catch (e) { throw new Error(getErrorMessage(e)); } };

function AssignDialog({ open, onClose, booking, onDone }) {
  const techs = useFetch(() => techniciansApi.adminList({ status: 'APPROVED', pageSize: 100 }), [open], { enabled: open });
  const [techId, setTechId] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const go = async () => {
    if (!techId) { setErr('Choose a technician.'); return; }
    setBusy(true); setErr('');
    try { await bookingsApi.assign(booking.id, Number(techId)); onDone(); } catch (e) { setErr(getErrorMessage(e)); } finally { setBusy(false); }
  };
  return (
    <Modal open={open} onClose={onClose} title="Assign a technician" footer={<><Button onClick={onClose} disabled={busy}>Cancel</Button><Button variant="primary" busy={busy} onClick={go}>Assign technician</Button></>}>
      <p className="muted small">Only approved, active technicians who offer {booking.service.name} can be assigned. The server checks this.</p>
      {techs.loading && !techs.data ? <LoadingState /> : (
        <SelectField label="Technician" value={techId} onChange={(e) => setTechId(e.target.value)} placeholder="Select a technician" options={(techs.data ?? []).filter((t) => t.isActive).map((t) => ({ value: t.id, label: `${t.fullName} (${t.openJobs} open jobs)` }))} />
      )}
      {err && <Alert tone="bad">{err}</Alert>}
    </Modal>
  );
}

export default function BookingDetailPage({ backTo, backLabel = 'Back to bookings' }) {
  const { id } = useParams();
  const { user } = useAuth();
  const toast = useToast();
  const role = user.role;
  const bk = useFetch(() => bookingsApi.getOne(id), [id]);
  const versions = useFetch(() => bookingsApi.quotationHistory(id), [id]);
  const settings = useFetch(() => adminApi.publicSettings(), [], { enabled: role === 'TECHNICIAN' });
  const [dlg, setDlg] = useState('');
  const [busy, setBusy] = useState('');
  const b = bk.data;
  useDocumentTitle(b ? `Booking ${b.reference}` : 'Booking');
  const close = () => setDlg('');
  const refresh = () => { bk.reload(); versions.reload(); };
  const done = (msg) => { close(); toast.success(msg); refresh(); };
  const act = async (key, fn, msg) => { setBusy(key); try { await fn(); toast.success(msg); refresh(); } catch (e) { toast.error(getErrorMessage(e)); refresh(); } finally { setBusy(''); } };

  if (bk.error && getStatus(bk.error) === 404) return <EmptyState as="h1" title="Booking not found" action={<Link to={backTo}>{backLabel}</Link>}>It does not exist or you do not have access to it.</EmptyState>;

  return (
    <Async state={bk} loadingLabel="Loading booking...">
      {(booking) => {
        const q = booking.currentQuotation;
        const st = booking.status;
        const pendingQuote = q && q.status === 'PENDING' && st === 'QUOTATION_SENT';
        return (
          <>
            <p className="small"><Link to={backTo}>{backLabel}</Link></p>
            <div className="page-head">
              <div><h1>{booking.service.name}</h1><p>Booking <strong>{booking.reference}</strong> created {formatDateTime(booking.createdAt)}</p></div>
              <div className="row"><BookingBadge status={st} short={false} />{st === 'COMPLETED' && <PaymentBadge status={booking.paymentStatus === 'PAID' ? 'SUCCESS' : 'FAILED'} />}</div>
            </div>
            {booking.paymentStatus === 'UNPAID' && st === 'COMPLETED' && role !== 'CUSTOMER' && <Alert tone="info">Completed. Waiting for the customer's (simulated) payment.</Alert>}

            <div className="detail-grid">
              <div>
                <Card title="Job details">
                  <Dl items={[
                    ['Problem', booking.problemDescription],
                    ['Preferred time', `${formatDate(booking.preferredDate)} at ${formatTime(booking.preferredTime)}`],
                    ['Address', booking.address?.line1 ? [booking.address.line1, booking.address.line2, booking.address.city, booking.address.state, booking.address.postalCode].filter(Boolean).join(', ') : [booking.address?.city, booking.address?.state].filter(Boolean).join(', ')],
                    booking.latitude != null && ['Shared location', `${booking.latitude}, ${booking.longitude}`],
                    booking.customer && ['Customer', `${booking.customer.fullName}${booking.customer.phone ? ` (${booking.customer.phone})` : ''}${booking.customer.email ? `, ${booking.customer.email}` : ''}`],
                    booking.technician && ['Technician', `${booking.technician.fullName}${booking.technician.phone ? ` (${booking.technician.phone})` : ''}${booking.technician.specialization ? `, ${booking.technician.specialization}` : ''}`],
                    booking.completedAt && ['Completed', formatDateTime(booking.completedAt)],
                    booking.completionNotes && ['Completion notes', booking.completionNotes],
                    booking.cancelledAt && ['Cancelled', `${formatDateTime(booking.cancelledAt)}${booking.cancelReason ? `: ${booking.cancelReason}` : ''}`],
                  ].filter(Boolean)} />
                </Card>

                {booking.inspection && (
                  <Card title="Inspection findings" actions={role === 'TECHNICIAN' && st === 'INSPECTION_COMPLETED' ? <Button size="sm" onClick={() => setDlg('inspection')}>Edit</Button> : null}>
                    <Dl items={[['Diagnosis', booking.inspection.diagnosis], ['Observed condition', booking.inspection.observedCondition], booking.inspection.labourNotes && ['Labour notes', booking.inspection.labourNotes], booking.inspection.requiredParts && ['Parts needed', booking.inspection.requiredParts], booking.inspection.additionalWork && ['Additional work', booking.inspection.additionalWork], booking.inspection.notes && ['Notes', booking.inspection.notes]].filter(Boolean)} />
                  </Card>
                )}

                <Card title="Quotation">
                  {!q ? <p className="muted">{role === 'CUSTOMER' ? 'No quotation yet. The technician will send one after the inspection.' : 'No quotation has been sent yet.'}</p> : (
                    <>
                      {pendingQuote && role === 'CUSTOMER' && <Alert tone="warn" title="Your decision is needed">Work will not start until you approve this quotation. If you reject it, the technician can send a revised version.</Alert>}
                      {st === 'QUOTATION_APPROVED' && <Alert tone="ok">Approved. Work can begin.</Alert>}
                      <QuotationView quotation={q} />
                      {pendingQuote && role === 'CUSTOMER' && (
                        <div className="form-actions"><Button variant="danger" onClick={() => setDlg('reject')}>Reject quotation</Button><Button variant="primary" onClick={() => setDlg('approve')}>Approve quotation</Button></div>
                      )}
                    </>
                  )}
                  {versions.data && <QuotationHistory versions={versions.data} currentId={q?.id} />}
                </Card>

                {role === 'CUSTOMER' && st === 'COMPLETED' && (
                  <Card title="Your review">{booking.hasReview ? <p>Thank you, your review has been submitted. <Link to="/customer/reviews">See your reviews</Link></p> : <ReviewForm booking={booking} onDone={() => { toast.success('Review submitted.'); refresh(); }} />}</Card>
                )}
              </div>

              <div>
                <Card title="Next step">
                  {role === 'CUSTOMER' && <CustomerNext booking={booking} onCancel={() => setDlg('cancel')} onPaid={() => { toast.success('Simulated payment received.'); refresh(); }} />}
                  {role === 'TECHNICIAN' && <TechNext booking={booking} busy={busy} act={act} open={setDlg} />}
                  {role === 'ADMIN' && (
                    <div className="stack">
                      <p className="muted small">Current status: {bookingLabel(st)}</p>
                      {st === 'PENDING' && <Button variant="primary" block onClick={() => setDlg('assign')}>Assign a technician</Button>}
                      {ADMIN_CANCELLABLE.includes(st) && <Button variant="danger" block onClick={() => setDlg('cancel')}>Cancel booking</Button>}
                      {!['PENDING', ...ADMIN_CANCELLABLE].includes(st) && <p className="muted small">No administrator actions are available for this status.</p>}
                    </div>
                  )}
                </Card>
                {booking.payment && <Card title="Payment"><Receipt payment={booking.payment} /></Card>}
                <Card title="Timeline"><StatusTimeline history={booking.history} /></Card>
              </div>
            </div>

            <ReasonDialog open={dlg === 'cancel'} onClose={close} title="Cancel this booking?" message="Any pending quotation will be withdrawn. This cannot be undone." label="Reason (optional)" required={false} confirmLabel="Cancel booking" onSubmit={wrap(async (r) => { await bookingsApi.cancel(booking.id, r); done('Booking cancelled.'); })} />
            <ReasonDialog open={dlg === 'reject'} onClose={close} title="Reject this quotation?" message="Tell the technician what you would like changed so they can send a revised quotation." label="Reason" minLength={5} confirmLabel="Reject quotation" onSubmit={wrap(async (r) => { await quotationsApi.reject(q.id, r); done('Quotation rejected.'); })} />
            <ConfirmDialog open={dlg === 'approve'} onClose={close} title="Approve this quotation?" confirmLabel="Approve quotation" cancelLabel="Not yet" onConfirm={wrap(async () => { await quotationsApi.approve(q.id); done('Quotation approved. The technician can start work.'); })}>
              {q && <p>You are approving version {q.versionNumber} with a total of <strong>{formatMoney(q.totalAmount)}</strong>. Work may start once you approve.</p>}
            </ConfirmDialog>
            <ReasonDialog open={dlg === 'complete'} onClose={close} danger={false} title="Mark the job as completed" message="Describe the work that was done. The customer will then be able to pay." label="Completion notes" minLength={3} confirmLabel="Mark completed" onSubmit={wrap(async (r) => { await bookingsApi.complete(booking.id, r); done('Job marked as completed.'); })} />
            {dlg === 'inspection' && <InspectionForm open onClose={close} booking={booking} onSaved={() => done('Inspection saved.')} />}
            {dlg === 'quote' && <QuotationForm open onClose={close} booking={booking} defaultTaxRate={settings.data?.default_tax_rate ?? '0'} onSaved={() => done('Quotation sent to the customer.')} />}
            {dlg === 'assign' && <AssignDialog open onClose={close} booking={booking} onDone={() => done('Technician assigned.')} />}
          </>
        );
      }}
    </Async>
  );
}

function CustomerNext({ booking, onCancel, onPaid }) {
  const st = booking.status;
  const cancel = CUSTOMER_CANCELLABLE.includes(st) ? <Button variant="danger" block onClick={onCancel}>Cancel booking</Button> : null;
  const text = {
    PENDING: 'Waiting for an approved technician to accept your booking.',
    ASSIGNED: 'A technician has accepted your booking and will inspect the problem.',
    INSPECTING: 'The technician is inspecting. A quotation will follow.',
    INSPECTION_COMPLETED: 'Inspection is done. A quotation is being prepared.',
    QUOTATION_SENT: 'Review the quotation and approve or reject it.',
    QUOTATION_REJECTED: 'You rejected the quotation. The technician can send a revised one.',
    QUOTATION_APPROVED: 'Approved. The technician will start the work.',
    IN_PROGRESS: 'Work is in progress. If extra work is needed you will get a new quotation to approve first.',
    CANCELLED: 'This booking was cancelled.',
  }[st];
  if (st === 'COMPLETED') return booking.paymentStatus === 'PAID' ? <p>Paid and complete. Thank you!</p> : <PaymentPanel booking={booking} onPaid={onPaid} />;
  return <div className="stack"><p>{text}</p>{cancel}{!cancel && st === 'IN_PROGRESS' && <p className="muted small">Work has started. Contact support if you need to cancel.</p>}</div>;
}

function TechNext({ booking, busy, act, open }) {
  const st = booking.status;
  const B = ({ k, children, ...p }) => <Button block busy={busy === k} disabled={!!busy && busy !== k} {...p}>{children}</Button>;
  if (st === 'ASSIGNED') return <div className="stack"><p>Start the inspection when you reach the customer, then record your findings.</p>
    <B k="insp" variant="primary" onClick={() => act('insp', () => bookingsApi.setStatus(booking.id, 'INSPECTING'), 'Inspection started.')}>Start inspection</B>
    <Button block onClick={() => open('inspection')}>Record findings</Button></div>;
  if (st === 'INSPECTING') return <div className="stack"><p>Record what you found. This completes the inspection.</p><Button block variant="primary" onClick={() => open('inspection')}>Record findings</Button></div>;
  if (st === 'INSPECTION_COMPLETED') return <div className="stack"><p>Inspection recorded. Send the customer an itemized quotation.</p><Button block variant="primary" onClick={() => open('quote')}>Create quotation</Button><Button block onClick={() => open('inspection')}>Edit findings</Button></div>;
  if (st === 'QUOTATION_SENT') return <div className="stack"><p>Waiting for the customer's decision. You can replace this quotation with a revised version.</p><Button block onClick={() => open('quote')}>Revise quotation</Button></div>;
  if (st === 'QUOTATION_REJECTED') return <div className="stack"><p>The customer rejected the quotation (see the reason in the quotation history). Send a revised version.</p><Button block variant="primary" onClick={() => open('quote')}>Send revised quotation</Button></div>;
  if (st === 'QUOTATION_APPROVED') return <div className="stack"><p>Approved by the customer. You can start work.</p>
    <B k="start" variant="primary" onClick={() => act('start', () => bookingsApi.setStatus(booking.id, 'IN_PROGRESS'), 'Work started.')}>Start work</B>
    <Button block onClick={() => open('quote')}>Additional work: revise quotation</Button></div>;
  if (st === 'IN_PROGRESS') return <div className="stack"><p>Found extra work? Send a revised quotation first: work that changes the price needs the customer's approval.</p><Button block variant="primary" onClick={() => open('complete')}>Mark completed</Button><Button block onClick={() => open('quote')}>Additional work: revise quotation</Button></div>;
  if (st === 'COMPLETED') return <p>Job completed. {booking.paymentStatus === 'PAID' ? 'The customer has paid (simulated).' : 'Waiting for the customer to pay (simulated).'}</p>;
  return <p className="muted">No actions available.</p>;
}
