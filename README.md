# FixNow - Home Service Management Platform

FixNow connects customers who need home repairs with approved technicians. Customers book a service, a technician inspects and sends an **itemized quotation**, the customer approves or rejects it, work is completed, and payment is made through a **simulated** payment flow. Administrators manage users, technician approvals, the catalogue, bookings, quotations, payments, reviews and reports.

> **Status: complete (Batch 3 of 3).** Database, backend and React frontend are built, audited and tested; the audit found and fixed real bugs (listed in `CHECKLIST.md`). Payments are **simulated** and **no email is sent**, so this is a working demonstration, not a production payment platform. Nothing has been deployed. Read `docs/DEPLOYMENT.md` and `docs/SECURITY.md` before putting it on the internet.

## Repository layout
```
fixnow/
  backend/    Express REST API (routes -> controllers -> services -> repositories), scripts, tests
  frontend/   React + Vite single-page app (customer, technician, admin areas), tests, browser E2E script
  database/   migrations/ (001-008), schema.sql (generated), seeds/
  docs/       API.md, DECISIONS.md, WINDOWS_SETUP.md, DEPLOYMENT.md, SECURITY.md, screenshots/
  CHECKLIST.md
```

## Quick start
See **`docs/WINDOWS_SETUP.md`** for the full Windows + VS Code guide (Node 22.12+ and MySQL needed). In two terminals:

Terminal 1 (API). First:
```
cd backend
copy .env.example .env
```
Now open `backend\.env` in VS Code and set `DB_PASSWORD` and a long random `JWT_SECRET` (on macOS/Linux use `cp` instead of `copy`). Then:
```
npm install
npm run db:setup
npm run dev
```
The API is healthy when http://localhost:5000/api/health says `"database":"connected"`.

Terminal 2 (website):
```
cd frontend
copy .env.example .env
npm install
npm run dev
```
Open http://localhost:5173.

Demo logins (development seed, password `Password@123`): `admin@fixnow.test`, `customer@fixnow.test`, `tech@fixnow.test`.

## Architecture
Modular monolith: React SPA -> Express REST API -> MySQL (InnoDB).
Backend layers: `middleware` (auth, validation, errors, rate limits, uploads) -> `routes` -> `controllers` (HTTP only) -> `services` (business rules, transactions) -> `repositories` (SQL). `integrations/paymentGateway.js` isolates the payment provider.

## Core business rules (enforced server-side)
- Catalogue prices are **indicative only**; the payable amount is always the customer-approved quotation total.
- Only approved + active technicians can accept jobs; exactly one technician can win a job (row lock + conditional update).
- Quotations are versioned, never overwritten; totals are computed on the server with integer money arithmetic.
- Work and completion require an approved current quotation; stale quotations cannot be approved.
- Payments are simulated, amount is server-controlled, and a booking can be paid at most once.
Details and rationale: `docs/DECISIONS.md`. Endpoints: `docs/API.md`.

## Security summary
bcrypt password hashing, JWT with server-side revocation, role + ownership + status checks on every endpoint, Zod validation on bodies/params/queries (unknown fields rejected), parameterized SQL (values are always bound), Helmet, explicit CORS allow-list, rate limiting on auth/payment/API, upload type verification via magic bytes with random storage names and authenticated downloads, no stack traces/SQL in production errors, secrets only in `.env`, CSV formula-injection protection, audit log for admin actions.

## Simulated vs real
| Real | Simulated / not implemented |
|---|---|
| Auth, RBAC, database persistence, workflow, notifications (in-app), uploads, reports | **Payments** (no money, no card data); **email** (none sent; reset links go to the server console in development); **maps** (browser coordinates only, no map provider) |

## Tests (all executed on the final code; details and what was NOT run are in `CHECKLIST.md`)
| Suite | Command | Result |
|---|---|---|
| Backend unit + static frontend-to-API route contract | `cd backend` then `npm run test:unit` | 16 pass |
| Backend integration (real database, concurrency, security) | `npm run test:integration` | 41 pass |
| Frontend unit/component | `cd frontend` then `npm test` | 66 pass |
| Frontend API contract (live backend) | `npm run test:api` | 8 pass |
| Real-browser journey | `npm run test:e2e` | 24 steps pass |
| Real-browser extended scenarios | `npm run test:e2e:extended` | 26 steps pass |
| Real-browser sweep of every route and role | `npm run test:e2e:sweep` | 86 pages clean |
Also run: ESLint (0 errors), axe-core WCAG A/AA (0 violations, 39 pages, 2 widths), an active security probe (33/33), `npm audit`.
**Database tested:** MariaDB 10.11 (also under MySQL 8's default `sql_mode`). **MySQL 8 itself was not tested**; run the backend tests on it before relying on it.

## Known limitations
- **Simulated payments and no email**: see above. Reset links are only printed to the server console in development.
- **Not tested**: MySQL 8 itself; a Windows machine (the instructions were checked for portability, all runs were on Linux); browsers other than headless Chromium; real phones; screen readers (axe automates only part of accessibility); load and performance; a real deployment.
- Technician availability is informational (it does not restrict job acceptance).
- If a customer rejects an additional-work revision, the booking waits in `QUOTATION_REJECTED` until a new quotation is sent (the earlier approval is not silently reinstated).
- The `currency` setting is informational; everything is recorded and shown in INR.
- The server treats "today" as the UTC date (a customer far west of UTC may be refused "today" late in their evening).
- Not built because the backend has no matching feature: editing another user's role or profile as an admin, replacing an already uploaded document, editing the text of a submitted application, map display.
- Security trade-offs and residual risks (token in `sessionStorage`, in-memory rate limiting, no MFA or email verification, no upload malware scanning, `braces` advisory in the dev-only watcher): `docs/SECURITY.md`.
