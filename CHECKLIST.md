# FixNow - Progress Checklist

Legend: [x] done and tested, [~] done, not yet covered by automated tests, [ ] not started

## Batch 1 - Scaffold, database, backend (delivered)
- [x] Monorepo layout: `backend/`, `frontend/` (placeholder), `database/`, `docs/`
- [x] Environment validation (`backend/src/config/env.js`) + `.env.example`
- [x] 8 sequential SQL migrations + checksum-tracking runner; generated `schema.sql`; idempotent seed
- [x] DB pool, UTC handling, transaction helper
- [x] Security middleware: Helmet, explicit CORS, rate limits, Zod validation, central errors, safe logging
- [x] Auth: register / login / logout (server-side revocation) / me / forgot + reset password / change password
- [x] RBAC (CUSTOMER, TECHNICIAN, ADMIN) + account status + ownership checks on every endpoint
- [x] Users (profile, admin list/status)
- [x] Service catalogue (categories, services, search, filter, pagination, indicative-price rule)
- [x] Addresses (CRUD, default, coordinates, safe delete)
- [x] Technician applications (multipart upload, magic-byte validation, protected downloads, approve/reject/request-info)
- [x] Technician profile, services, availability, earnings, admin activation
- [x] Bookings (create, role-scoped list/detail, status history, accept with atomic claim, admin assign, cancel)
- [x] Inspections
- [x] Itemized quotations: server-side decimal maths, versioning, approve/reject, stale protection
- [x] Completion; simulated payments behind a gateway interface; duplicate-payment protection
- [x] Reviews (eligibility, one per booking, moderation, public listing)
- [x] Notifications (persistent, ownership-scoped, read/read-all)
- [x] Admin: dashboard metrics, 6 reports + CSV export, settings, audit log
- [x] Tests: 12 unit + 38 integration (real MariaDB 10.11)

## Batch 2 - Frontend (delivered)
- [x] Vite + React app, React Router, Axios client (`VITE_API_BASE_URL`), AuthContext, ToastContext, role-guarded routes with code-split role areas
- [x] Design system (tokens, buttons, fields, tables, badges, dialogs, toasts, empty/loading/error states), responsive layouts
- [x] Public: Home, Services (search/filter/paging), Service details, How it works, About, Contact, Privacy, Terms, 403, 404, 500
- [x] Auth: register (customer or technician), login (redirect back), logout (server-side revoke), forgot/reset password, session-expiry handling
- [x] Customer: overview, booking form (address, date/time, optional geolocation), bookings list/detail with timeline, itemized quotation view with version history, approve/reject, cancel, simulated payment + receipt, reviews, addresses CRUD, notifications, profile/password
- [x] Technician: application with document upload and status/feedback, resubmit on "needs info", available jobs + accept, my jobs, inspection form, quotation create/revise (additional work), start work, complete, availability editor, earnings, reviews, professional profile
- [x] Admin: dashboard, users, applications (document download, approve/reject/request info), technicians (activate/deactivate), bookings (assign/cancel), quotations (all versions), payments, review moderation, categories, services, 6 reports + CSV, settings, audit log
- [x] Tests: 44 unit/component, 8 API contract (live backend), 24-step browser journey
- [x] (see Batch 3 section for the final list of incomplete features)

## Batch 3 - Audit, verification, fixes, delivery (THIS ZIP)
- [x] Audited the Batch 2 ZIP (identical to the working tree), docs, manifests, migrations, tests
- [x] Frontend-to-backend contract verified three ways: static route-table test, live API contract tests, real browser journeys
- [x] Full-page sweep (every route, every role, many booking states), accessibility scan, security probe, lint, dependency audit
- [x] Real bugs found and fixed (below), each with a regression test
- [x] Deployment guide, security overview, first-administrator script, shell-neutral Windows instructions
- [x] Final ZIP

### Bugs found by the audit and fixed
| # | Severity | Problem (how it was found) | Fix | Regression test |
|---|---|---|---|---|
| 1 | **High** | **The dashboard of every approved technician crashed** into the error screen (4 of 4 loads). `useFetch` reported "idle, no data" for one render when a deferred fetch was enabled and the page called `.map` on `null`. Targeted tests never opened that page; the first axe run analysed the error screen. Found while running new browser scenarios | `useFetch` derives `loading` until the request has started; `Async` never passes `null` to render callbacks | `useFetch.test.jsx` (flip-to-enabled render), sweep, axe error-screen check |
| 2 | Medium | "Return to the page you asked for" after login **never worked** (0 of 6 in a real browser); a newly registered technician could land on the dashboard instead of the application form. Two redirects (page and route guard) raced; my earlier unit test mocked the guard away | `GuestRoute` is the single owner of post-login redirects; `loginTarget` only honours paths inside the user's own role area | `GuestRoute.test.jsx` (12 cases incl. external/cross-role), extended browser steps |
| 3 | Medium | Clicking **Log out** could end on `/login` instead of home after the router upgrade (same race class) | `AuthContext.signedOut` + `ProtectedRoute` owns that redirect | `ProtectedRoute` / `AuthContext` tests, journey step |
| 4 | Medium | Horizontally scrollable tables were not keyboard-reachable on phones (axe `scrollable-region-focusable`) | `TableWrap` (labelled, focusable region) used everywhere | axe at 390 px |
| 5 | Low | "Not found" pages had no `<h1>` (sweep) | `EmptyState as="h1"` | unit test, sweep |
| 6 | Low | Ignoring the browser's location prompt left the button spinning forever (browsers do not time that out) | 12 s fallback message, late answer still accepted | `useGeolocation.test.jsx`, browser step |
| 7 | Low | The `currency` setting looked functional but is not used | Labelled informational in the UI and docs | - |
| 8 | Medium (ops) | **No supported way to create the first admin in production** (seed refuses production) | `npm run admin:create` (hidden prompt, 12+ chars, audited, refuses existing accounts) | 3 integration tests |
| 9 | Medium (supply chain) | Frontend: 2 moderate production advisories (react-router) + dev-tool advisories incl. a Windows NTLM leak in the Vite dev server | Upgraded React Router 7, Vite 8, Vitest 5, puppeteer-core 25 (needs Node 22.12+); all tests re-run | `npm audit`: 0 |
| 10 | Info | Docs: `::`/`#` comments in command blocks fail in PowerShell; Node version requirement was stale | Shell-neutral blocks; Node 22.12+ stated | - |
| 11 | Info | Dead code (`void x` hacks, unused imports) | Removed | ESLint |
Test-infrastructure flaws also found and fixed (not product bugs): my browser helper's mouse triple-click did not select text, so it appended instead of replacing (now keyboard select-all with value verification); a toast overlapping dialog buttons and a modal focus/scroll-lock defect had been fixed in Batch 2.

### Executed on the final code
| Check | Result |
|---|---|
| Backend unit + static frontend-to-API route contract (`npm run test:unit`) | **16 / 16** |
| Backend integration, real MariaDB 10.11 with MySQL-8-style `sql_mode` (`npm run test:integration`) | **41 / 41** |
| Frontend unit/component (`npm test`) | **66 / 66** |
| Frontend API contract tests against a live backend (`npm run test:api`) | **8 / 8** |
| Real-browser journey (`npm run test:e2e`) | **24 / 24**, no console errors |
| Real-browser extended scenarios (`npm run test:e2e:extended`) | **26 / 26**, no console errors |
| Real-browser sweep, 86 pages x roles/states (`npm run test:e2e:sweep`) | **86 clean** |
| axe-core WCAG 2.0/2.1 A+AA, 39 pages | **0 violations** at 1280 px and at 390 px (negative control confirmed the scanner works) |
| Active security probe (forged tokens, CORS, injection strings, size limits, upload tricks, real 429) | **33 / 33** |
| ESLint (no-undef, unused, React hooks) over backend + frontend + tests | 0 errors |
| Production build | succeeds |
| `npm audit` | frontend **0**; backend production dependencies **0**; backend dev-only: 3 (`nodemon > chokidar > braces`, no patched release exists; `npm run dev:node` avoids nodemon) |
| Clean-room: unzip, `npm ci`, build, tests | see the delivery message |

### NOT executed (do not assume these pass)
- **MySQL 8** itself (only MariaDB 10.11, plus MySQL 8's default `sql_mode`). Run `npm test` in `backend` on your MySQL 8.
- A **Windows machine** (everything ran on Linux; instructions were reviewed for portability and made shell-neutral, not executed on Windows).
- Browsers other than headless Chromium; real phones/tablets; screen readers and manual keyboard-only testing.
- Load, stress and long-running tests; backup/restore; an actual deployment.
- Real payment provider, email provider, malware scanning (none exist).

### Incomplete or not built
- Payments are **simulated**; **no email** is sent (reset links are logged in development only).
- No admin editing of another user's role/profile (no endpoint), no replacing an uploaded document, no editing the text of a submitted application, no map display.
- Technician availability does not restrict job acceptance; the `currency` setting is informational.
- No MFA, email verification or per-account lockout; in-memory rate limiting; no upload malware scan; see `docs/SECURITY.md`.
- Frontend component tests cover key components and flows, not every component individually (the sweep and browser suites cover every page).
