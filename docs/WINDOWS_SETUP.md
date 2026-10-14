# Windows + VS Code setup guide

## 1. Install prerequisites
1. **Node.js 22 LTS (22.12 or newer)** - https://nodejs.org (tick "Add to PATH"). Verify in a new terminal: `node -v` and `npm -v`. The frontend tooling (Vite 8 / Vitest 5) needs Node 20.19+ or 22.12+ (Vitest 5 needs 22.12+); Node 20 reached end-of-life in April 2026, so use 22 or 24.
2. **MySQL 8** - download "MySQL Installer for Windows" from https://dev.mysql.com/downloads/installer/ and choose *Server only* (or *Developer Default*). During setup:
   - keep port `3306`,
   - set a **root password** (remember it),
   - tick "Start the MySQL Server at System Startup".
   Verify: open *MySQL 8.0 Command Line Client* and run `SELECT VERSION();`.
   (MariaDB 10.6+ also works; the automated tests in this ZIP were run on MariaDB 10.11.)
3. **VS Code** - https://code.visualstudio.com, open the `fixnow` folder (`File > Open Folder`). Use the integrated terminal (`Ctrl+`` `), **Command Prompt or PowerShell**.

## 2. Configure the backend
```bat
cd backend
copy .env.example .env
```
Open `backend\.env` in VS Code and set at least:
```
DB_USER=root
DB_PASSWORD=<your MySQL root password>
DB_NAME=fixnow
JWT_SECRET=<any long random text, 32+ characters>
```
Generate a secret: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`

## 3. Install, create the database, migrate, seed
```bat
npm install
npm run db:create
npm run db:migrate
npm run db:seed
```
What they do: `db:create` creates the `fixnow` database; `db:migrate` applies `database\migrations\001` to `008` in order (each once); `db:seed` adds the service catalogue and the demo accounts (development only).
Shortcut for all three database steps: `npm run db:setup`.

**Alternative (import the SQL directly):** in the MySQL Command Line Client
```sql
CREATE DATABASE fixnow CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE fixnow;
SOURCE C:/full/path/to/fixnow/database/schema.sql;
```
(then run `npm run db:seed`; note `schema.sql` does not create the `schema_migrations` table, so use migrations *or* schema.sql, not both.)

## 4. Start the API (first terminal)
```bat
npm run dev
```
`npm run dev` restarts the API automatically when you edit a file. For a plain start use `npm start`. If nodemon gives you trouble, `npm run dev:node` does the same with Node's built-in watcher.
Check http://localhost:5000/api/health - it should show `"database":"connected"`.

## Demo accounts (development seed only - password `Password@123`)
| Email | Role |
|---|---|
| admin@fixnow.test | ADMIN |
| customer@fixnow.test | CUSTOMER |
| tech@fixnow.test | TECHNICIAN (approved) |
| tech.pending@fixnow.test | TECHNICIAN (has not applied) |

**Never seed or reuse these in production.** The seed script refuses to run when `NODE_ENV=production`.

## 6. Set up and start the frontend (second terminal)
Open a **new** terminal in VS Code (`Terminal > New Terminal`) so the backend keeps running in the first one.
```bat
cd frontend
copy .env.example .env
npm install
npm run dev
```
Open **http://localhost:5173**. `frontend\.env` already points at `http://localhost:5000/api`; change it only if you changed the backend `PORT`.
If the site shows "Cannot reach the FixNow server": the backend is not running, or its `FRONTEND_ORIGIN` does not match the address in your browser's address bar.

Log in with the demo accounts below. A good first tour: log in as `customer@fixnow.test`, book a service; in another browser (or a private window) log in as `tech@fixnow.test` and accept the job, record an inspection and send a quotation; go back to the customer to approve it.

## 7. Run the tests
```bat
cd backend
npm run test:unit
npm run test:integration
npm test
```
`test:unit` needs no database. `test:integration` needs MySQL and **drops and recreates** a database named `fixnow_test` (your `fixnow` database is never touched). `npm test` runs both.
The integration suite uses the credentials in `backend\.env` but forces `DB_NAME=fixnow_test` (it refuses any name not ending in `_test`). The MySQL user needs permission to create/drop databases (root does).

Frontend tests:
```bat
cd frontend
npm test
npm run build
npm run test:api
```
`npm test` runs the 66 unit/component tests (no backend needed). `npm run build` checks the production build. `npm run test:api` runs contract tests against a **running** backend with seed data; it creates its own records, so point it at a throwaway database.
The three real-browser suites (`npm run test:e2e`, `test:e2e:extended`, `test:e2e:sweep`) need Chrome and a running backend; they are described in `frontend\README.md`.

## Production notes
To create the first administrator on a real server (the seed accounts must never exist there) and for hosting, hardening and backups, see `docs\DEPLOYMENT.md` and `docs\SECURITY.md`. On a development machine you can create an extra admin with `cd backend` then `npm run admin:create -- --email you@example.com --name "Your Name"` (hidden password prompt, 12+ characters).

## Troubleshooting
| Symptom | Fix |
|---|---|
| `Invalid or missing environment configuration` | `backend\.env` missing or incomplete - redo step 2 |
| `ECONNREFUSED 127.0.0.1:3306` | MySQL service is not running: `Win+R` -> `services.msc` -> start *MySQL80* |
| `Access denied for user` | wrong `DB_USER`/`DB_PASSWORD` in `.env` |
| `ER_NOT_SUPPORTED_AUTH_MODE` (very old setups) | `ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY 'yourpassword';` |
| PowerShell blocks `npm` ("running scripts is disabled") | use Command Prompt, or `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` |
| Port 5000 busy | change `PORT` in `backend\.env` and `VITE_API_BASE_URL` in `frontend\.env` |
| Browser console shows a CORS error | add the exact address in the browser bar (for example `http://localhost:5173`) to `FRONTEND_ORIGIN` in `backend\.env` and restart the backend |
| `npm install` / `npm run dev` fails in `frontend` with an engine or syntax error | use Node 22.12 or newer (`node -v`) |
| "Too many attempts. Please try again later." while testing | the login limiter (20 attempts per 15 minutes per IP) is working. Wait, or for local test runs only set `AUTH_RATE_LIMIT_MAX=1000` in `backend\.env` and restart |
| `npm run dev` (nodemon) misbehaves on your machine | use `npm run dev:node` (Node's built-in `--watch`, no extra tool) |
