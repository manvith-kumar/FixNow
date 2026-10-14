# Deployment guide

FixNow is two programs and a database: a **static website** (the `frontend/dist` folder), a **Node.js API** (`backend/`) and **MySQL**.
This guide describes a realistic first production deployment. **Nothing in this repository has been deployed or load-tested**; follow the go-live checklist and run your own smoke tests.

> **Payments are simulated and no email is sent.** Before real customers use the system you must integrate a real payment provider and an email provider (see "Before real money" at the end). Do not describe the current release as a payment platform.

## 1. Requirements
| Component | Requirement | What was actually tested |
|---|---|---|
| Node.js | **22 LTS (22.12 or newer)**. The frontend toolchain (Vite 8, Vitest 5) needs 20.19+/22.12+; the API itself runs on 18.18+ | Node 22.22 |
| Database | MySQL 8.0+ (or MariaDB 10.6+) with InnoDB, `utf8mb4` | **MariaDB 10.11 only** (also with MySQL 8's default `sql_mode`, including `ONLY_FULL_GROUP_BY`). **MySQL 8 itself has not been tested.** Run `npm test` against your MySQL 8 server before going live. |
| Web server | Any that can serve static files with an SPA fallback (Nginx, Caddy, IIS, a CDN) | not tested |
| TLS | Required (HTTPS) for both the site and the API | - |

## 2. Database
1. Create the schema and two accounts (names are examples):
   ```sql
   CREATE DATABASE fixnow CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   CREATE USER 'fixnow_app'@'%'     IDENTIFIED BY '<long random password>';
   CREATE USER 'fixnow_migrate'@'%' IDENTIFIED BY '<another long random password>';
   GRANT SELECT, INSERT, UPDATE, DELETE ON fixnow.* TO 'fixnow_app'@'%';
   GRANT ALL PRIVILEGES ON fixnow.* TO 'fixnow_migrate'@'%';
   ```
   The running API only needs the first account (no DDL). Use the second only to run migrations. Restrict `'%'` to your API host's address.
2. Apply the migrations with the migration account (`backend/.env` or environment variables `DB_USER=fixnow_migrate ...`):
   ```
   cd backend
   npm ci --omit=dev
   npm run db:migrate        # applies database/migrations/001..008 once each, records checksums
   ```
   Migrations are forward-only. Never edit an applied migration (the runner warns if a checksum changed); add a new numbered file instead. Test every migration on a copy of production data first.
3. **Do not run `npm run db:seed` in production** (it refuses when `NODE_ENV=production`). It creates demo accounts with a published password.

## 3. First administrator
There is no seed admin in production. Create the first one on the server:
```
cd backend
npm run admin:create -- --email owner@yourdomain.com --name "Site Owner"
```
The password comes from a hidden prompt (or the `ADMIN_PASSWORD` environment variable for automation), must be 12+ characters with a letter and a digit, is never accepted as a command-line argument, and the script refuses to touch an existing account. The action is written to the audit log.

## 4. Backend configuration (`backend/.env` or real environment variables)
| Variable | Production value |
|---|---|
| `NODE_ENV` | `production` (hides error details, ignores `DEV_EXPOSE_RESET_TOKEN`, enables proxy trust, refuses placeholder secrets) |
| `PORT` | e.g. `5000` (bind behind the reverse proxy) |
| `FRONTEND_ORIGIN` | the **exact** site origin, e.g. `https://app.yourdomain.com` (comma-separate several). No trailing slash, no wildcard |
| `DB_HOST` `DB_PORT` `DB_NAME` `DB_USER` `DB_PASSWORD` | the **`fixnow_app`** account |
| `JWT_SECRET` | 48+ random bytes: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`. Rotating it signs everyone out |
| `JWT_EXPIRES_IN` | `8h` (shorter is safer) |
| `BCRYPT_ROUNDS` | `12` |
| `DEV_EXPOSE_RESET_TOKEN` | `false` |
| `UPLOAD_DIR` | an **absolute path outside the application folder** on a persistent, backed-up disk, e.g. `/var/lib/fixnow/uploads`, owned by the service user, mode `700` |
| `MAX_UPLOAD_MB` | `5` |
| `AUTH_RATE_LIMIT_MAX` | default `20` per 15 minutes per IP for login/register/reset (keep it low in production) |
Keep the file readable only by the service user and out of version control.

## 5. Run the API
Use a process manager so it restarts on failure, for example systemd:
```ini
# /etc/systemd/system/fixnow-api.service
[Unit]
Description=FixNow API
After=network.target mysql.service
[Service]
WorkingDirectory=/opt/fixnow/backend
EnvironmentFile=/etc/fixnow/backend.env
ExecStart=/usr/bin/node src/server.js
Restart=on-failure
User=fixnow
NoNewPrivileges=true
[Install]
WantedBy=multi-user.target
```
(PM2 or a Windows service wrapper work equally well.) The process shuts down cleanly on SIGINT/SIGTERM. Health check: `GET /api/health` returns `"database":"connected"`.

### Reverse proxy (Nginx example)
```nginx
server {
  listen 443 ssl http2;  server_name api.yourdomain.com;
  # ssl_certificate ...; ssl_certificate_key ...;
  client_max_body_size 6m;                      # uploads are limited to 5 MB per file
  location / {
    proxy_pass http://127.0.0.1:5000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```
In production the API sets `trust proxy` to 1 so rate limiting sees the real client IP from `X-Forwarded-For`. **Run exactly one proxy hop in front of it** (or adjust `trust proxy` in `backend/src/app.js` to match your topology); otherwise clients could spoof their IP and dodge the login limiter.

## 6. Build and host the website
```
cd frontend
npm ci
VITE_API_BASE_URL=https://api.yourdomain.com/api npm run build      # Windows PowerShell: $env:VITE_API_BASE_URL="..." ; npm run build
```
Upload `frontend/dist/` to your static host. `VITE_API_BASE_URL` is baked into the bundle at build time and is public.
Required static-host behaviour:
- **SPA fallback:** every path that is not a file must return `index.html` (`try_files $uri /index.html;` in Nginx), otherwise refreshing `/customer/bookings/5` gives a 404.
- **Caching:** `index.html` with `Cache-Control: no-cache`; files in `assets/` (content-hashed) with `public, max-age=31536000, immutable`.
- **Security headers** (the API sets its own via Helmet; static hosts do not):
  ```
  Strict-Transport-Security: max-age=31536000; includeSubDomains
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: geolocation=(self), camera=(), microphone=()
  Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data:; connect-src 'self' https://api.yourdomain.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self'
  ```
  The app ships no third-party scripts or CDN fonts, so this strict policy fits. (`'unsafe-inline'` for styles is needed for a few inline `style=` attributes; test the policy in a staging site and watch the browser console.)

## 7. Backups and recovery
- **Database:** nightly `mysqldump --single-transaction fixnow | gzip` (or your provider's snapshots), kept off-server, with a **tested restore**.
- **Uploads:** back up `UPLOAD_DIR` with the database (technician documents are referenced by the database; one without the other is incomplete). They contain personal documents: encrypt backups.
- Test restoring both into a scratch environment at least once before go-live.

## 8. Logging and monitoring
The API logs startup, 5xx errors and password-reset events to stdout/stderr (no request log). Capture the service output (journald, a log shipper) and keep the reverse proxy's access log. Alert on: `/api/health` failures, a rising rate of HTTP 5xx or 429, disk space for `UPLOAD_DIR` and the database. Passwords, tokens and payment data are not logged.

## 9. Go-live checklist
- [ ] `NODE_ENV=production`; `JWT_SECRET` is random and unique to this environment; `DEV_EXPOSE_RESET_TOKEN=false`
- [ ] API connects as the least-privilege `fixnow_app` user; migrations ran as `fixnow_migrate`
- [ ] Demo accounts do **not** exist (`SELECT email FROM users WHERE email LIKE '%@fixnow.test'` returns nothing); the seed was never run
- [ ] First administrator created with `npm run admin:create`; password stored in a password manager
- [ ] HTTPS everywhere; `FRONTEND_ORIGIN` is the exact HTTPS site origin; CORS from another origin fails
- [ ] Static host: SPA fallback, caching and security headers configured
- [ ] Uploads directory is outside the web root, persistent, `700`, backed up
- [ ] Database backup runs and a restore was rehearsed
- [ ] Smoke test on the live URL: home loads, register, login, book a service (as a customer), `/api/health` is `ok`, an unknown route returns JSON 404 without a stack trace, `GET /api/admin/dashboard` without a token returns 401
- [ ] `npm audit --omit=dev` clean on the deployed commit; a monthly dependency update routine exists
- [ ] Privacy policy and terms (templates in the site) reviewed by a legal professional

## 10. Before real money or real customers
These are **not implemented** and are required before this is more than a demonstration:
1. **Real payment provider** behind `backend/src/integrations/paymentGateway.js` (same `charge()` contract): hosted fields so card data never touches your servers, idempotency keys, signed webhook handling, refunds, reconciliation. Remove the demo methods and the "simulated" labelling only when this is real.
2. **Transactional email** (reset links, booking and quotation notices). Today reset links are only logged in development and no email is ever sent.
3. **Email verification, stronger password policy / breached-password check, and optional multi-factor authentication** for administrators.
4. **Rate-limit store shared across processes** (e.g. Redis) if you run more than one API instance; the current limiter is per process and in memory.
5. **Antivirus scanning and private object storage** for uploaded technician documents (currently local disk, type and signature checks only).
6. Legal review of terms, privacy policy, cancellation and refund rules; data-retention and deletion process.
