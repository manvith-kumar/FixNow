# Design decisions

Where the specification left details open, these are the choices made (and why).

## Authentication
- **Bearer JWT (HS256) in the `Authorization` header.** Frontend will keep it in `sessionStorage`/memory. Trade-off: unlike an httpOnly cookie it is readable by injected scripts (XSS), but it needs no CSRF protection and works simply with the SPA + API split. Mitigations: strict Helmet defaults, no user HTML rendering, short lifetime (8h), server-side revocation.
- **Every request re-loads the user from MySQL**, so role, status and revocation are always current. A client-supplied role is never trusted.
- **Logout and password changes/resets increment `users.token_version`**, which invalidates every outstanding token (true server-side logout despite stateless JWTs). Disabling a user does the same.
- **Registration roles:** only `CUSTOMER` or `TECHNICIAN`. `ADMIN` accounts exist only via seed/DB. Unknown request fields are rejected (`.strict()`).
- **Password reset:** the response is identical for known/unknown emails. No email provider is integrated, so in non-production the link is written to the server console ("dev outbox"), and the raw token is returned in the response only if `NODE_ENV != production` **and** `DEV_EXPOSE_RESET_TOKEN=true`. Only a SHA-256 hash of the token is stored; tokens are single-use and expire (30 min default).

## Booking status model (single source of truth: `backend/src/utils/bookingStateMachine.js`)
```
PENDING -> ASSIGNED -> INSPECTING -> INSPECTION_COMPLETED -> QUOTATION_SENT -> QUOTATION_APPROVED -> IN_PROGRESS -> COMPLETED
                \______________________/        ^   |   \-> QUOTATION_REJECTED -> (revise) -> QUOTATION_SENT
 any pre-work state --(customer/admin)--> CANCELLED      QUOTATION_APPROVED / IN_PROGRESS --(revise)--> QUOTATION_SENT
```
- Payment is tracked separately as `bookings.payment_status` (`UNPAID`/`PAID`), so `COMPLETED` stays a service state.
- `POST /bookings/:id/status` only allows technician-controlled steps (`ASSIGNED->INSPECTING`, `QUOTATION_APPROVED->IN_PROGRESS`). Every other transition happens through its dedicated action (accept, inspection, quotation, approve/reject, complete, cancel), which enforces its own preconditions.
- Customers can cancel up to and including `QUOTATION_APPROVED`; once work is `IN_PROGRESS` only an administrator can cancel.
- **Additional work:** a technician can revise the quotation while `IN_PROGRESS`/`QUOTATION_APPROVED` (revision notes required). The booking returns to `QUOTATION_SENT`; work and completion are blocked until the customer approves the new version. If the customer rejects an additional-work revision, the booking sits in `QUOTATION_REJECTED` and the technician must send a new version (the superseded earlier approval is not silently reinstated).

## Quotations
- Each revision is a **new row** (`version_number` 1..n) with its own items. Older rows are never deleted. Statuses: `PENDING`, `APPROVED`, `REJECTED`, `SUPERSEDED` (replaced by a newer version), `WITHDRAWN` (booking cancelled).
- A generated column + unique key (`uq_quote_one_current`) guarantees at most one current version per booking at the database level.
- **Maths (integer minor units, no floats):** `line = round_half_up(unit_price x quantity)`; `subtotal = sum(lines)`; discount is a **fixed amount** <= subtotal; `tax = round_half_up((subtotal - discount) x rate%)`; tax rate 0-30%; `total = subtotal - discount + tax`. Quantity up to 2 decimals. Client-supplied totals are rejected.
- Validity: `valid_until` defaults to today + `quotation_validity_days` (system setting, default 7). An expired quotation cannot be approved.
- Locking order is always booking row first, then quotation row, which avoids deadlocks between technician revisions and customer decisions.

## Concurrency control
| Operation | Mechanism |
|---|---|
| Job acceptance | `SELECT ... FOR UPDATE` on the booking, then conditional `UPDATE ... WHERE status='PENDING' AND technician_id IS NULL` and `affectedRows = 1` check |
| Quotation revision / decision | booking row lock + quotation row lock, unique `(booking_id, version_number)`, unique "one current" key |
| Payment | booking row lock + unique `(booking_id, success_key)` so a second SUCCESS row is impossible |
All three are covered by tests that fire simultaneous requests.

## Payments (simulated)
- Clearly labelled; every payment row has `is_simulated=1`, `provider='SIMULATED'`, reference `SIM-...`.
- The amount is always the **approved current quotation total**. The request body accepts only `bookingId` and a demo `method`; any other field (`status`, `amount`, `cardNumber`, `cvv`) is rejected.
- `DEMO_FAILING_CARD` deterministically fails (so the failure path is testable). Failed attempts are stored (HTTP 402) and never count as revenue.
- `backend/src/integrations/paymentGateway.js` is the single seam: a real provider only needs to implement `charge()`.
- **Revenue** = sum of `SUCCESS` payments only.

## Privacy
- Technicians browsing open jobs see service, problem, date/time and only city/state/postcode - no street address, phone, or customer name until they accept.
- Booking addresses are **snapshotted** into the booking so later address edits never rewrite history; addresses used by bookings cannot be deleted.
- Public reviews show the reviewer's first name only.

## Data lifecycle
- Services, categories, users and technicians are **deactivated, not deleted**. Foreign keys use `RESTRICT` for anything referenced by bookings or payments.
- Timestamps are stored/compared in **UTC**; reports use UTC dates and say so.
- No bookings, payments or reviews are seeded, so no fake "customer reviews" or revenue can appear.

## Technician eligibility
A technician may work only if `approval_status='APPROVED'` **and** `is_active=1` **and** the user account is `ACTIVE`. This check (`isEligible`) runs inside every technician action (accept, inspect, quote, status, complete). Technicians only see jobs for services in their approved service list. Availability is informational in this release (it is not used to block acceptance).

## Uploads
Only PDF/JPG/PNG up to `MAX_UPLOAD_MB`. The real type is verified from magic bytes, files are renamed to random UUIDs with the verified extension, stored outside any public/static path, and served only through authenticated endpoints with `nosniff` and `no-store`.

## Frontend (Batch 2)
- **Session token in `sessionStorage`**, attached by one Axios interceptor. It is cleared when the tab closes and on logout. The user's role/status are always re-read from `GET /auth/me` on page load, never trusted from the token. XSS is the main risk of this approach (see Authentication above); the app renders no user HTML and ships no third-party scripts.
- **No client-side money maths.** Quotation totals, tax and payment amounts are displayed exactly as returned by the API (decimal strings). The quotation form deliberately shows no running total; the customer and technician see the server's figures after sending.
- **Status vocabulary lives in `src/utils/status.js` and is contract-tested** against the backend state machine (`status.test.js` imports `backend/src/utils/bookingStateMachine.js`), so the two cannot silently drift.
- **One booking page for all roles** (`pages/shared/BookingDetailPage.jsx`). The API decides what each role may see; the page only chooses which actions to offer for the current status.
- **Admin "assign technician"** lists approved, active technicians; the server rejects a technician who does not offer the service (the page shows that message).
- **Contact page has no form**, because the backend has no endpoint that receives messages. It shows the support email from system settings instead of pretending to send anything.
- **No fake content:** the home page shows only real reviews from the API (the section is hidden when there are none). The job card in the hero is labelled "Example, not a real booking".
- **Dialogs sit above toasts** (z-index 90 vs 80) and the toast container ignores pointer events, so a notification can never cover a dialog's buttons (found by the browser test).
- **Backend changes in Batch 2: none.** Batch 1 code, migrations, seed data, API contracts and tests were left untouched.

## Batch 3 (audit and hardening)
- **One owner per redirect.** After sign-in/sign-up, `<GuestRoute target=...>` is the only code that navigates (to the page the person originally requested, if it lies inside their own role area, otherwise their dashboard; new technicians go to the application form). After a deliberate log out `<ProtectedRoute>` sends the person home; after an expired session or disabled account it sends them to `/login`. Pages never call `navigate()` themselves after authenticating, because a second redirect races with the guard's (this was a real bug: "return to the requested page" worked 0 of 6 times in a browser).
- **`useFetch` reports `loading: true` until its request has started**, even in the render where `enabled` flips to true, and `Async` never passes `null` to a render callback. (A real bug: the approved-technician dashboard crashed on every load.)
- **Toolchain upgraded to patched majors** (React Router 7, Vite 8, Vitest 5, puppeteer-core 25) so `npm audit` is clean for the frontend. Consequence: the frontend needs **Node 22.12+**. The API still runs on Node 18.18+ but 22 LTS is the documented baseline.
- **`.table-wrap` is a keyboard-focusable labelled region** (`TableWrap`), so horizontally scrollable tables can be scrolled without a mouse (axe: scrollable-region-focusable).
- **Not-found states render an `<h1>`** so every page has a top-level heading.
- **Geolocation prompt fallback.** Browsers do not time out an unanswered permission prompt, so the app stops the spinner after 12 s with an explanatory message and still accepts a late answer.
- **First administrator** is created with `npm run admin:create` (hidden prompt or `ADMIN_PASSWORD`; never a command-line password; refuses to modify an existing account; audited). The seed stays development-only.
- **Currency.** The `currency` setting is informational: payments and quotations are recorded and displayed in INR in this release (the Settings page says so).
- **Disabled accounts see the generic "session expired" message** on their next action, because revoking the token (token_version bump) is checked before account status; logging in with correct credentials shows the explicit "account has been disabled" message.
- **Test helper rule:** browser tests use keyboard select-all and verify the field value after typing (a mouse triple-click did not select text in headless Chrome and silently appended instead).
