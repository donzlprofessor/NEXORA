# NEXORA

A local-first, full-stack business dashboard and read-only AI analyst built with Vue 3, TypeScript, Pinia, Tailwind CSS, Chart.js, FastAPI, SQLAlchemy, Alembic and PostgreSQL. Local Ollama `qwen3:4b` supplies optional inference without paid APIs.

## Product modes

- **Local demo:** existing browser records and workflows continue to work without a database. Nothing is automatically imported.
- **Authenticated account:** database-backed customer/finance CRUD, persistent preferences, server-derived AI metrics, session restoration and confirmed legacy-data import. Account records never overwrite browser demo storage.
- **Public portfolio demo:** the isolated Vite `public-demo` mode needs no backend, account or paid API. It blocks account/inference calls and uses separate browser storage for fictional records. The full local application remains available with the normal commands below.

Features include search, filters, sorting, pagination, responsive navigation, accessible dialogs, accurate financial/date metrics, JSON backups, separate customer lifetime spending, qualitative AI explanations and explicit data-completeness notices. Money is stored as integer cents in PostgreSQL; EUR remains the underlying currency.

## Public portfolio demo (static Cloudflare Pages)

From `frontend`, with dependencies installed using `npm ci`:

```powershell
npm.cmd run dev:demo
npm.cmd run build:demo
npm.cmd run preview:demo
```

`build:demo` checks TypeScript and writes **frontend/dist-demo**. Normal `npm run build` still writes **frontend/dist**; these outputs are separate. The new tracked `.env.public-demo` contains only public flags. Vite also forces public-demo network flags at configuration time, so a shell API URL cannot enable backend requests in this mode. Do not add credentials to any `VITE_*` variable: these are public bundle content.

Visitors enter Dashboard immediately and can use Analytics, Customers, Finance and Settings without signing up. Fictional seed dates are relative to the first visit and then persisted. Seed customer spending matches linked income; after editing, lifetime spending remains an independently editable field, while financial charts use transaction records. Data and language/theme preferences persist only in the current browser/origin under `nexora_public_v1_*`. Existing full-mode browser keys are never imported or overwritten. Storage restrictions or quota failures can prevent persistence; the app reports storage errors. Export records from Settings for a portable backup. Avoid entering sensitive information on a public showcase.

The localized demo banner explains this boundary in English, Polish and Russian. AI Assistant explains that live AI needs local FastAPI and Ollama (`qwen3:4b`); it does not generate simulated answers. The normal local AI integration is preserved.

Cloudflare Pages settings (prepare only; this task does not deploy):

| Setting | Value |
| --- | --- |
| Project type | Pages, static Vue/Vite site |
| Root directory | `frontend` |
| Build command | `npm run build:demo` |
| Build output directory | `dist-demo` |
| Branch, when explicitly authorized | `portfolio-demo` |
| Node | A supported Node 24 LTS version, at least 24.12.0 |
| Backend, database, bindings, API keys | None |

Publish only `dist-demo`, never the repository or normal `dist`. `public/_redirects` is copied to the output and rewrites `/*` to `/index.html` with status 200 for Vue history routing. See Cloudflare's [build settings](https://developers.cloudflare.com/pages/configuration/build-configuration/) and [redirects](https://developers.cloudflare.com/pages/configuration/redirects/). Preview deep links such as `/customers` and `/settings` after hosting. Cloudflare deployment, domain configuration and browser/mobile acceptance still require manual verification.

For the full application use `npm run dev` / `npm run build` and the FastAPI, PostgreSQL and optional Ollama setup below. Do not set `VITE_PUBLIC_DEMO=true` in full-mode environment files or the shell. Existing environment files, migrations, Docker volumes and account data are untouched by the portfolio implementation.

## Verification status

The existing backend virtual environment now includes the free database, migration, PostgreSQL driver and Argon2 dependencies. Account/authentication/authorization/import tests pass on isolated SQLite databases. The additive Alembic migration executes on SQLite and compiles PostgreSQL SQL offline. A live authenticated FastAPI-to-Ollama request succeeded with server-calculated figures.

**Docker and PostgreSQL tools are unavailable on the development machine. No local PostgreSQL migration/integration run or Docker image build has been completed.** GitHub Actions includes PostgreSQL migration and integration checks, but has not been pushed or run remotely. Real-browser acceptance remains outstanding. This is not a production-security claim.

## Windows setup

Requirements: Node matching `frontend/package.json`, Python 3.11+, Docker Desktop with Compose (or a separately installed PostgreSQL), and optional local Ollama `qwen3:4b`. Run from `C:\Users\<username>\Projects\nexora` unless specified. Use separate terminals for services. `npm.cmd` avoids PowerShell execution-policy issues; virtual-environment activation is unnecessary.

### Configure environment without overwriting existing files

```powershell
Set-Location "$env:USERPROFILE\Projects\nexora"
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
if (-not (Test-Path backend\.env)) { Copy-Item backend\.env.example backend\.env }
if (-not (Test-Path frontend\.env)) { Copy-Item frontend\.env.example frontend\.env }
```

Edit the ignored root `.env` and choose a unique `POSTGRES_PASSWORD`. Set the matching, URL-encoded password in `backend/.env`'s `DATABASE_URL`. Never commit these files. Keep `COOKIE_SECURE=false` only for local HTTP. The backend account runtime deliberately requires PostgreSQL; SQLite is used for isolated tests, not as a silent production fallback.

To run browser-only demo mode without PostgreSQL, omit `DATABASE_URL` rather than pointing it at a nonexistent server. Database-backed login will then report unavailable, while existing browser workflows remain usable.

### PostgreSQL and additive migration

After installing Docker Desktop and configuring the environment:

```powershell
Set-Location "$env:USERPROFILE\Projects\nexora"
docker compose up -d db
# First checkout only if the virtual environment is absent:
py -3 -m venv backend\.venv
.\backend\.venv\Scripts\python.exe -m pip install -r backend\requirements.lock.txt
Set-Location backend
.\.venv\Scripts\python.exe -m alembic upgrade head
.\.venv\Scripts\python.exe -m alembic current
.\.venv\Scripts\python.exe -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload
```

Compose exposes PostgreSQL only on `127.0.0.1:5432` and keeps data in a named volume. Do not run volume deletion or destructive downgrade commands. Alembic revision `0001` creates new account tables only; it never reads or modifies localStorage. Back up any existing account database before applying future revisions.

### Ollama (optional, separate terminal)

```powershell
ollama list
# Download once only if absent:
ollama pull qwen3:4b
ollama serve
```

Skip `ollama serve` if the tray app already runs it. Keep Ollama bound to loopback. `backend/.env.example` documents its endpoint, model and timeout. Native Windows FastAPI alongside Ollama is the supported local GPU arrangement; the optional backend Dockerfile is intended for deployments with inference disabled or separately reviewed local networking.

### Frontend (separate terminal)

```powershell
Set-Location "$env:USERPROFILE\Projects\nexora\frontend"
# First checkout only; skip if already installed:
npm.cmd ci
npm.cmd run dev
```

Open `http://127.0.0.1:5173`. Use the same hostname as your existing records: `localhost` and `127.0.0.1` have different localStorage. Vite proxies `/api` to the local backend in development/preview. For a separately deployed frontend, set `VITE_API_BASE_URL` to the intended same-site HTTPS API or keep it empty behind a same-origin `/api` reverse proxy.

## Safe account migration and recovery

Sign in, open **Account and migration**, preview existing localStorage or choose a NEXORA JSON backup, inspect conflicts, download/verify the source backup, and type **IMPORT ACCOUNT**. Nothing is written before confirmation. Import commits atomically, retains source IDs as owner-scoped migration references, skips identical repeats and rejects stale previews or changed/conflicting records. Database IDs may differ; no customer/transaction relationships are invented. Invalid historical dates/amounts need explicit correction in an exported copy, never in-place rewriting of the originals.

All original browser keys remain unchanged after account hydration, mutation, import and sign-out. Export account data from Settings before major operations. A failed server import transaction rolls back; a network failure after commit can be reconciled with a fresh idempotent preview. A successful import is not automatically undone: use a verified database backup restored to a new empty database for recovery, or review individual imported records before deleting anything.

Example PostgreSQL backup to a unique file (requires Docker):

```powershell
Set-Location "$env:USERPROFILE\Projects\nexora"
New-Item -ItemType Directory -Force backups | Out-Null
$backupName = 'nexora-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.dump'
docker compose exec -T db pg_dump -U nexora -d nexora --format=custom --file=/tmp/nexora-backup.dump
docker compose cp db:/tmp/nexora-backup.dump "./backups/$backupName"
```

Verify the archive using `pg_restore --list`. Restore only into a newly created empty recovery database, point a separate backend at it, verify row counts/ownership/totals, and review the restored data before switching URLs. Never restore with destructive `--clean` options into the active database. Browser backups cannot restore forgotten account passwords or server sessions.

## Checks

```powershell
Set-Location "$env:USERPROFILE\Projects\nexora"
.\backend\.venv\Scripts\python.exe -m unittest discover -s backend -p 'test_*.py'
Set-Location frontend
npm.cmd run type-check
npm.cmd run test:unit -- --run
npm.cmd run lint
npm.cmd run build
```

Backend tests create isolated temporary SQLite databases; no user PostgreSQL or browser data is touched. CI separately applies Alembic to disposable PostgreSQL `nexora_ci` and reruns the account suite against that database. For an explicit local PostgreSQL test run, use only a separately provisioned `nexora_ci` database and set `NEXORA_TEST_POSTGRES_URL`; the harness refuses other database names and rolls back test transactions. Do not point test settings at personal data.

The opt-in `backend/smoke_ai.py` tests the local-demo gateway using synthetic data and live Ollama. In database mode use the authenticated Assistant page; `/api/chat` rejects client-authoritative totals. Account AI accepts questions/period/time zone only and calculates its context from the current user's rows.

## Architecture, security and release evidence

- [Architecture and data boundaries](docs/ARCHITECTURE.md)
- [Security assumptions and limitations](docs/SECURITY.md)
- [Browser acceptance checklist and screenshot guidance](docs/ACCEPTANCE.md)
- [Phase 3 change inventory](docs/PHASE_3.md)

Authentication uses Argon2, random opaque HTTP-only cookies, token hashes in PostgreSQL, per-session CSRF checks, Origin validation and owner-scoped queries. Sessions expire after twelve hours. Account API responses are not cacheable. Public hosting requires HTTPS, secure cookies, exact origins/hosts, private database networking and further abuse/security verification. No email verification, password reset, MFA or distributed rate limiter is included.

AI remains read-only and local. It returns exact selected/previous-period metrics and expense-category totals separately from generated prose. The installed model's thinking-only behavior is handled with bounded generation/retry and hidden reasoning; no cloud fallback exists. Explanations may still be qualitatively wrong. Snapshot figures, not generated claims, are authoritative.

Before public release: run the PostgreSQL CI job, complete browser/mobile/accessibility acceptance, test backups/recovery, review dependencies and deployment controls, and add concurrency protection/server-paginated loading for larger accounts. Do not label the application production-secure before those checks.

## Phase 4: exact financial summaries and languages

The app now provides English, Polish and Russian interfaces, persisted browser/account language preferences, locale-aware EUR/date formatting and multilingual local AI. Account summaries expose exact cent strings and remain visible if Ollama fails; explanations and evidence-based suggestions are displayed separately.

See [Phase 4 delivery and verification](docs/PHASE_4.md) for the complete file inventory, API contract, test results, live Polish smoke-test limitation, exact Windows restart commands and manual browser checklist. No database schema migration is required for the additive language preference.
