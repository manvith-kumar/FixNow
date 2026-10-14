# FixNow frontend (React + Vite)

Single-page app for customers, technicians and administrators. It talks only to the FixNow REST API (`../backend`, documented in `../docs/API.md`). All users, bookings, quotations, payments, reviews and notifications come from the backend; the only thing kept in the browser is the session token (`sessionStorage`).

## Run it
```bat
cd frontend
copy .env.example .env
npm install
npm run dev
npm run build
npm run preview
```
`npm run dev` serves http://localhost:5173 (the backend must be running at `VITE_API_BASE_URL`). `npm run build` writes the production build to `dist\`. `npm run preview` serves that build on http://localhost:4173.
`VITE_API_BASE_URL` (default `http://localhost:5000/api`) is a **public** value baked into the bundle. The backend must list this site's origin in its `FRONTEND_ORIGIN` (default `http://localhost:5173`; add `http://localhost:4173` to use `preview`).

## Tests
| Command | What it does | Needs |
|---|---|---|
| `npm test` | 66 unit/component tests (Vitest + Testing Library) | nothing |
| `npm run test:api` | 8 contract tests: the frontend's own API modules against a **live** backend | backend + seed data at `VITE_API_BASE_URL` |
| `npm run test:e2e` | 24-step real-browser journey (customer, technician, admin) | backend + build + preview + Chrome |
| `npm run test:e2e:extended` | 26 further browser scenarios (addresses, password reset, cancellation, double-click guard, geolocation, application review loop, additional-work revision, admin catalogue/moderation/CSV, session expiry, mobile menu, return-to-page) | same |
| `npm run test:e2e:sweep` | opens **every route for every role** (86 pages, many booking states) and fails on any error screen, console error or missing `<h1>` | same |

The backend also has a static test (`backend/tests/unit/frontend-contract.test.js`) that checks every endpoint these API modules call against the backend's real route table.

```bat
$env:CHROME_PATH="C:\Program Files\Google\Chrome\Application\chrome.exe"
$env:VITE_API_BASE_URL="http://localhost:5055/api"; npm run build; Remove-Item Env:VITE_API_BASE_URL
Start-Process npm -ArgumentList "run","preview"
npm run test:e2e
npm run test:e2e:extended
npm run test:e2e:sweep
```
(PowerShell syntax. Start the backend with `AUTH_RATE_LIMIT_MAX=1000` in its environment so repeated runs are not rate limited.)
The browser and contract suites create their own users and bookings: run them against a **throwaway database** (for example `fixnow_e2e`, created with the backend scripts and `DB_NAME=fixnow_e2e`), with the frontend built for that API (`VITE_API_BASE_URL`) and the backend's `FRONTEND_ORIGIN` including `http://localhost:4173`.

## Structure
```
src/
  api/          one module per backend group (auth, bookings, quotations, payments ...) + axios client + token store
  config/       env (VITE_API_BASE_URL)
  context/      AuthContext (session), ToastContext, NotificationsContext (unread badge)
  hooks/        useFetch, usePagedList, useSubmit (double-submit guard), useGeolocation, useDebounce
  utils/        format (money/dates), status (labels, mirrors backend), errors, download
  components/   ui/ (Button, Fields, Modal, DataTable, Badge...), booking/ (QuotationView/Form, Inspection, Payment, Review, Timeline), common/
  layouts/      PublicLayout, DashboardLayout (sidebar for all roles), AuthLayout, nav.js (menu per role)
  routes/       ProtectedRoute (role guard), GuestRoute
  pages/        public/, auth/, errors/, customer/, technician/, admin/, shared/ (booking detail+list, notifications, profile, payments, reviews)
  styles/       tokens.css, base.css, components.css, layout.css, pages.css
e2e/            real-browser suites (smoke, extended, sweep), shared helpers, sample document
```

## Route map
| Area | Routes |
|---|---|
| Public | `/`, `/services`, `/services/:id`, `/how-it-works`, `/about`, `/contact`, `/privacy`, `/terms`, `/login`, `/register`, `/forgot-password`, `/reset-password`, `/unauthorized`, `/server-error`, `*` (404) |
| Customer `/customer/...` | overview, `book`, `bookings`, `bookings/:id`, `payments`, `addresses`, `reviews`, `notifications`, `profile` |
| Technician `/technician/...` | overview, `application`, `jobs/available`, `jobs`, `jobs/:id`, `availability`, `earnings`, `reviews`, `notifications`, `profile` |
| Admin `/admin/...` | dashboard, `bookings`, `bookings/:id`, `quotations`, `payments`, `reviews`, `applications`, `applications/:id`, `technicians`, `users`, `categories`, `services`, `reports`, `settings`, `audit-logs`, `notifications`, `profile` |

Role areas are code-split. Route guards are a convenience: **every API call is authorized by the backend**.

## Behaviour worth knowing
- **Quotations:** the form sends line items, discount and tax rate only. Subtotal, tax and total are always the server's numbers. Revisions create a new version; earlier versions show under "Earlier versions".
- **Payments:** the page sends only the booking and a demo method. A decline (HTTP 402) is shown as a normal, recorded result; the booking stays unpaid.
- **Session:** an expired/invalid token or a disabled account ends the session once and shows a message on the login page.
- **Duplicate submits:** all submit buttons go through `useSubmit`, which ignores clicks while a request is running.
- **Accessibility:** labelled fields with linked errors, visible focus, skip links, dialog focus trapping and Escape to close, status text (never colour alone), reduced-motion support.
