# Security overview

What is implemented, how it was checked, and what remains. "Verified" below means a test or probe was actually run (see `CHECKLIST.md` for exact results).

## Implemented controls
| Area | Control | Verified by |
|---|---|---|
| Passwords | bcrypt (cost `BCRYPT_ROUNDS`), never returned by the API, constant-time-ish login for unknown emails | integration tests |
| Sessions | HS256 JWT, role/status **re-read from the database on every request**, `token_version` revocation (logout, password change/reset, disabling an account) | integration tests, security probe |
| Authorization | role check + ownership check + account status on every endpoint; foreign records return 404; technician actions additionally require an approved, active technician | integration tests (cross-user matrix, concurrency), contract tests |
| Roles | `ADMIN` cannot be self-assigned; clients cannot supply role, status, price totals, payment status or amounts (unknown JSON fields are rejected) | integration tests, security probe |
| Business rules | state machine enforced server-side; approval required before work; stale quotation approval blocked; one successful payment per booking (DB unique key); atomic job acceptance | integration tests incl. simultaneous requests |
| Input | Zod validation for body, params and query; whitelisted sort columns; capped page sizes; parameterized SQL only | integration tests, 33-check security probe (injection strings, oversize bodies) |
| Transport/headers | Helmet, explicit CORS allow-list, JSON body limit 100 KB, rate limits on auth (per IP), payments and the whole API | security probe (incl. real 429 behaviour) |
| Uploads | PDF/JPG/PNG only, 5 MB, max 5 files, real type checked from file signature, random server-side names, stored outside any public path, downloads only through authenticated endpoints with `nosniff` and `no-store` | integration tests, security probe |
| Errors | central handler; no stack traces, SQL or secrets to clients in production | tests, probe |
| Secrets | environment variables only; configuration validated at startup; production refuses placeholder secrets | startup checks |
| Data | decimal-safe money maths, `DECIMAL` columns, historical records protected by `RESTRICT`, audit log for administrative actions, booking addresses snapshotted | unit + integration tests |
| Frontend | no `dangerouslySetInnerHTML`; React escaping; routes guarded (convenience only); CSV export neutralises spreadsheet formulas; deliberate-logout and expiry handling | unit/E2E tests, ESLint |
| Dependencies | `npm audit` reported **0 vulnerabilities** for backend and frontend (all dependencies, including dev tooling) after the Batch 3 upgrades | run on the final lockfiles |
| Accessibility (related) | axe-core WCAG 2.0/2.1 A and AA: 0 violations on 39 pages at 1280 px and 390 px | axe run |

## Residual risks and recommendations
1. **Token storage.** The bearer token lives in `sessionStorage`, readable by any script that runs in the page (XSS). The app renders no user HTML and ships no third-party scripts, and the deployment guide gives a strict Content-Security-Policy. If you add rich text, third-party widgets or analytics, move to `HttpOnly; Secure; SameSite=Strict` cookies and add CSRF protection.
2. **Rate limiting** is per process, in memory, per IP; it resets on restart and is not shared between instances. Use a shared store at scale. Behind a proxy, make sure `trust proxy` matches the number of hops (see `DEPLOYMENT.md`).
3. **No account lockout, email verification or MFA.** Login attempts are throttled per IP only. Add per-account throttling and MFA for administrators before exposing the admin area publicly.
4. **Password policy** is 8+ characters with a letter and a digit (12+ for administrators created with the script). Consider a breached-password check.
5. **Account enumeration.** `POST /auth/register` returns `409 EMAIL_TAKEN` for an existing email (a usability trade-off). Login and password reset give generic responses.
6. **Uploads** are checked by type and signature but not scanned for malware, and live on local disk. Use antivirus scanning and private object storage for production.
7. **Search wildcards.** `%` and `_` in search boxes act as SQL `LIKE` wildcards (pattern matching only; no injection). Escape them if exact matching matters.
8. **Date handling.** The server treats "today" as the UTC date. A customer far west of UTC, late in their evening, may be told today's date is "in the past".
9. **Payments are simulated.** A real provider needs idempotency keys, webhook signature verification and a hosted card form (see `DEPLOYMENT.md`, section 10).
10. **Logging/monitoring.** There is no request log or request-ID correlation in the API; use the reverse proxy's access log and add structured logging if you need an audit trail beyond admin actions.
11. **Locking and retries.** Concurrency control relies on InnoDB row locks and unique keys. Under heavy contention MySQL may abort a transaction (deadlock); the API answers `503 TRY_AGAIN` and the client can retry. Verify behaviour on your production MySQL version.

## Reporting
This is a project template with no security contact configured. Set one up (`SECURITY.md` contact, `security.txt`) before launch.
