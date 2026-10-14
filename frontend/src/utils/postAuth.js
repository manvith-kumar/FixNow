import { homeFor } from './status.js';

/**
 * Where to send someone who is (now) signed in while sitting on /login.
 * ProtectedRoute stores the page they originally asked for in router state (`from`). It is only honoured when it lies inside
 * the signed-in role's own area, so a customer can never be bounced into /admin and nothing external is ever followed.
 */
export function loginTarget(user, location) {
  const from = location?.state?.from;
  const area = `/${String(user.role).toLowerCase()}`;
  const safe = typeof from === 'string' && (from === area || from.startsWith(`${area}/`) || from.startsWith(`${area}?`));
  return safe ? from : homeFor(user.role);
}
/** After registering: new technicians go straight to the application form, everyone else to their dashboard. */
export const registerTarget = (user) => (user.role === 'TECHNICIAN' ? '/technician/application' : homeFor(user.role));
