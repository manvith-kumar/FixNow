import { Link } from 'react-router-dom';
import { adminApi } from '../../api/index.js';
import { useFetch } from '../../hooks/useFetch.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { LinkButton } from '../../components/ui/index.js';

const Page = ({ title, lead, children, title2 }) => { useDocumentTitle(title2 ?? title); return <div className="container"><div className="page-hero"><h1>{title}</h1>{lead && <p>{lead}</p>}</div><div className="prose" style={{ paddingBottom: 'var(--s-6)' }}>{children}</div></div>; };

export function HowItWorks() {
  return (
    <Page title="How FixNow works" lead="A booking has a clear order, and you control the two moments that matter: the quote and the payment.">
      <ol className="stack">
        <li><strong>Book.</strong> Pick a service, describe the problem, choose one of your saved addresses and a preferred date and time. You can optionally share your location from the browser.</li>
        <li><strong>A technician accepts.</strong> Only technicians approved by a FixNow administrator can accept jobs for the services they offer.</li>
        <li><strong>Inspection.</strong> The technician inspects and records the diagnosis, the condition found, labour notes and any parts needed.</li>
        <li><strong>Itemized quotation.</strong> You receive a quotation with each line item, quantity and price, plus any discount and tax. The system calculates the total.</li>
        <li><strong>You decide.</strong> Approve the quotation to let work begin, or reject it with a reason and the technician can send a revised version. Earlier versions stay visible.</li>
        <li><strong>Extra work.</strong> If the technician finds more to do mid-job, they must send a revised quotation. Work waits until you approve the new price.</li>
        <li><strong>Completion, payment and review.</strong> After the technician completes the job you pay the approved amount and can leave a review.</li>
      </ol>
      <div className="alert alert-warn"><div><strong>Payments are simulated</strong>In this release no real money is charged and no card or bank details are collected.</div></div>
      <LinkButton to="/services" variant="primary">Browse services</LinkButton>
    </Page>
  );
}
export const About = () => (
  <Page title="About FixNow" lead="FixNow is a home-service management platform that connects customers with reviewed technicians.">
    <p>Most repair disputes come from one problem: the price changes after the work has started. FixNow puts the inspection and an itemized quotation before the repair, and makes the customer's approval a required step.</p>
    <h2>What we do</h2>
    <ul><li>Customers book services, track progress and approve quotations.</li><li>Technicians apply, get reviewed, inspect, quote and complete jobs.</li><li>Administrators approve technicians, manage the catalogue and oversee bookings, quotations, payments and reviews.</li></ul>
    <h2>What we are careful not to claim</h2>
    <p>Catalogue prices are only indicative. Payments in this release are simulated. Reviews on the site are written by customers about completed bookings, and nothing on this site is made-up testimonial content.</p>
  </Page>
);
export function Contact() {
  const s = useFetch(() => adminApi.publicSettings());
  const email = s.data?.support_email;
  return (
    <Page title="Contact" lead="Questions about a booking or your account?">
      <p>For help with a booking, include its reference (it looks like FN-20260101-ABC123) so we can find it quickly.</p>
      {email ? <p>Email us at <a href={`mailto:${email}`}>{email}</a>.</p> : <p className="muted">Support contact details are not available right now.</p>}
      <p className="muted small">There is no contact form on this site, so nothing you type here is sent anywhere. Use email instead.</p>
      <p>Already have an account? <Link to="/login">Log in</Link> to see your notifications and booking timeline.</p>
    </Page>
  );
}
export const Privacy = () => (
  <Page title="Privacy policy" lead="What we store and why." title2="Privacy">
    <h2>Information we collect</h2>
    <ul><li><strong>Account:</strong> name, email, phone number and a hashed password.</li><li><strong>Bookings:</strong> the service, problem description, address, preferred time and optional coordinates you choose to share.</li><li><strong>Technicians:</strong> professional details and the documents uploaded for review. These are visible only to you and FixNow administrators.</li><li><strong>Activity:</strong> quotations, simulated payments, reviews and notifications linked to your account.</li></ul>
    <h2>Who can see it</h2>
    <p>Technicians see only the neighbourhood of an open job. After they accept it they see the address and contact details needed to do the work. Public reviews show only the reviewer's first name.</p>
    <h2>Location</h2>
    <p>Sharing your location is optional and requires your browser's permission. Booking works without it.</p>
    <h2>Payments</h2>
    <p>Payments are simulated. We never ask for or store card numbers, CVVs or bank credentials.</p>
    <p className="muted small">This is a project template policy. Have it reviewed by a legal professional before using FixNow commercially.</p>
  </Page>
);
export const Terms = () => (
  <Page title="Terms and conditions" lead="The rules for using FixNow." title2="Terms">
    <h2>Quotations and pricing</h2>
    <p>Prices in the catalogue are indicative. The amount you pay is the total of the quotation you approved. Work that changes the agreed price requires a revised quotation and your approval.</p>
    <h2>Technicians</h2>
    <p>Technicians are independent professionals who have been through FixNow's application review. Approval means their application was reviewed; it is not a guarantee of workmanship.</p>
    <h2>Cancellations</h2>
    <p>You can cancel a booking until the quotation has been approved and work begins. After work starts, contact an administrator.</p>
    <h2>Simulated payments</h2>
    <p>In this release payments are a demonstration. No money is charged, and a simulated receipt is not proof of a real payment.</p>
    <h2>Your account</h2>
    <p>Keep your password private. We may disable accounts that misuse the platform.</p>
    <p className="muted small">This is a project template. Have it reviewed by a legal professional before using FixNow commercially.</p>
  </Page>
);
