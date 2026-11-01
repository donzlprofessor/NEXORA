# NEXORA

**A full-stack business dashboard for customer management, financial tracking and local AI analysis.**

[Live portfolio demo](https://nexora-portfolio-klo.pages.dev) · [GitHub repository](https://github.com/donzlprofessor/NEXORA)

NEXORA brings customer records, income, expenses and analytics into one responsive workspace. Built with Vue and TypeScript on the frontend and Python/FastAPI on the backend, it demonstrates authenticated CRUD, relational data modelling, multilingual interfaces and financial calculations independent of AI-generated explanations.

## Try the demo

Open the [live demo](https://nexora-portfolio-klo.pages.dev) and explore Dashboard, Analytics, Customers, Finance and Settings without registering. Edit fictional records, change the language, and refresh to see browser-local persistence.

**This demo is for evaluation. Do not enter sensitive or real customer information.** Records stay in the current browser and origin, do not sync across devices, and can be lost when browser storage is cleared or unavailable. Settings provides JSON export/import for local backups.

| | Public portfolio demo | Full local application |
| --- | --- | --- |
| Runtime | Static Vue application on Cloudflare Pages | Vue frontend, FastAPI backend and PostgreSQL |
| Access | Immediate access; no registration | Registration and cookie-based account sessions |
| Data | Fictional records; isolated browser storage | Account-owned customers, transactions and preferences in PostgreSQL |
| AI Assistant | Local setup explanation; no model calls or simulated answers | Optional local Ollama for qualitative analysis; deterministic financial answers |
| Branch | `portfolio-demo` includes both modes | `main` preserves the original full-stack version |

The normal frontend also supports unauthenticated browser records. Account imports require an explicit preview and confirmation; signing in does not automatically import or overwrite them.

## Core features

- **Dashboard and analytics:** all-time totals, date-based charts and selected-period reporting. Dashboard totals can differ from the Assistant's selected 7/30/90-day totals.
- **Customer management:** create, edit and delete records; search, status filters, sorting and pagination.
- **Finance:** income and expense CRUD, categories, date filters and net-profit calculations in EUR. Customer lifetime spending remains separate from transaction income.
- **Accounts:** owner-scoped data access, session restoration, persisted preferences and confirmed JSON/browser-data imports.
- **Local AI:** read-only qualitative analysis through Ollama `qwen3:4b`. Authenticated financial snapshots are calculated server-side in integer cents; supported exact-amount questions bypass inference. Generated explanations may still be wrong.
- **Interface:** responsive layout, English/Polish/Russian translations, locale-aware formatting, theme preferences and keyboard-accessible dialogs.

## Technology stack

| Layer | Technologies |
| --- | --- |
| Frontend | Vue 3, TypeScript, Vite, Pinia, Vue Router |
| UI and charts | Tailwind CSS, Chart.js / vue-chartjs, vue-i18n |
| Backend | Python, FastAPI, Pydantic, SQLAlchemy, Alembic, psycopg |
| Storage and authentication | PostgreSQL, Argon2 password hashing, HTTP-only session cookies, CSRF checks |
| Optional inference | Local Ollama with `qwen3:4b`; no cloud AI fallback |
| Quality and delivery | Vitest, Vue Test Utils, Python unittest, ESLint, Oxlint, GitHub Actions, Cloudflare Pages |

## Architecture

```text
Public demo: Browser → Vue / Pinia → isolated localStorage

Full local:  Browser → Vue / Pinia → FastAPI → PostgreSQL
                                      └──→ local Ollama (optional)
```

The frontend separates views, stores and HTTP/AI services. FastAPI validates requests and scopes database queries to the authenticated owner. PostgreSQL stores users, sessions, customers, transactions and preferences; Alembic manages the schema. Account snapshots aggregate monetary values before formatting them for display.

Public-demo mode blocks backend requests and uses a separate `nexora_public_v1_*` storage namespace. Normal account data is not written into browser demo storage. See [architecture and data boundaries](docs/ARCHITECTURE.md).

## Screenshots

Screenshots are not yet included. The live demo is available for a walkthrough.

<!-- TODO: Add a Dashboard screenshot using fictional records, then link to the actual relative file path. -->
<!-- TODO: Add Customers, Finance and mobile-layout screenshots; never include private account data. -->

## Run locally

Use Node.js `^22.18.0` or `>=24.12.0` as specified in [package.json](frontend/package.json). The full application also needs Python 3.11+ and PostgreSQL; the supplied Compose service runs PostgreSQL 17. Ollama is optional. Commands below use Windows PowerShell; `npm.cmd` avoids execution-policy issues.

```powershell
git clone --branch portfolio-demo https://github.com/donzlprofessor/NEXORA.git
cd NEXORA
```

### Frontend-only demo

From a checkout of `portfolio-demo`:

```powershell
cd frontend
npm.cmd ci
npm.cmd run dev:demo
```

Open `http://127.0.0.1:5173`. No database, backend, environment-file setup or AI service is required. The tracked [.env.public-demo](frontend/.env.public-demo) contains public flags only.

### Full application

Start from the repository root. Create missing environment files without overwriting existing settings:

```powershell
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
if (-not (Test-Path backend/.env)) { Copy-Item backend/.env.example backend/.env }
if (-not (Test-Path frontend/.env)) { Copy-Item frontend/.env.example frontend/.env }
```

Set a unique `POSTGRES_PASSWORD` in the root `.env` and the matching URL-encoded password in `backend/.env`'s `DATABASE_URL`. Keep `VITE_PUBLIC_DEMO=false` for normal mode. `COOKIE_SECURE=false` is for local HTTP only. Environment files must remain untracked; never put credentials in `VITE_*` variables, which are embedded in frontend bundles.

Start PostgreSQL, install backend dependencies and initialize the local schema:

```powershell
docker compose up -d db
py -3 -m venv backend/.venv
./backend/.venv/Scripts/python.exe -m pip install -r backend/requirements.lock.txt
cd backend
./.venv/Scripts/python.exe -m alembic upgrade head
./.venv/Scripts/python.exe -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload
```

Create the virtual environment only if absent. Apply migrations deliberately and back up existing databases first. Compose binds PostgreSQL to loopback and retains data in a named volume; do not delete volumes to restart the application. SQLite is used for isolated tests, not as an account-runtime fallback.

In another terminal, from the repository root:

```powershell
cd frontend
npm.cmd ci
npm.cmd run dev
```

Open `http://127.0.0.1:5173` and register a local account. Vite proxies `/api` to FastAPI on port 8000. Keep the browser hostname consistent: `localhost` and `127.0.0.1` have separate browser storage. Normal builds use `npm.cmd run build` and write `frontend/dist`.

For optional local inference, install Ollama and run:

```powershell
ollama pull qwen3:4b
ollama serve
```

Download the model only if absent; skip `ollama serve` if the Ollama app already runs. Keep inference bound to loopback. Endpoint, model and timeout settings are documented in [backend/.env.example](backend/.env.example). Numeric account answers require FastAPI and PostgreSQL, but do not require Ollama.

## Tests and checks

From `frontend`:

```powershell
npm.cmd run test:unit -- --run
npm.cmd run type-check
npm.cmd run lint
npm.cmd run build
npm.cmd run build:demo
```

Vitest uses jsdom and Vue Test Utils. Tests cover stores, financial/date calculations, account boundaries, translations, Assistant routing and public-demo isolation. The lint script applies automatic fixes, so review its diff.

From `backend`, with dependencies installed, use process-local test settings so the development environment does not restrict the test host or select a personal database:

```powershell
$env:ALLOWED_HOSTS = 'localhost,127.0.0.1,testserver'
$env:DATABASE_URL = ''
$env:NEXORA_TEST_POSTGRES_URL = ''
./.venv/Scripts/python.exe -m unittest discover -s . -p 'test_*.py'
```

Run this in a separate test terminal. The suite uses isolated SQLite databases and mocked inference; its migration test uses a temporary database. The [CI workflow](.github/workflows/ci.yml) additionally applies migrations and runs account integration tests against disposable PostgreSQL `nexora_ci`. It also defines frontend test, type, lint and normal-build checks. These describe configured checks, not the latest CI result. The [manual acceptance checklist](docs/ACCEPTANCE.md) covers browser and responsive verification.

## Public demo deployment

The live demo uses Cloudflare Pages and the `portfolio-demo` branch. Its configuration is separate from normal local mode:

| Setting | Value |
| --- | --- |
| Branch | `portfolio-demo` |
| Root directory | `frontend` |
| Build command | `npm run build:demo` |
| Output directory | `dist-demo` |
| Node.js | Compatible with `package.json`; Node 24 LTS >=24.12.0 |
| Backend, database or AI credentials | None |

`build:demo` runs TypeScript checks and `vite build --mode public-demo --outDir dist-demo`. To preview locally, run `npm.cmd run build:demo` followed by `npm.cmd run preview:demo` from `frontend`. The [Vite configuration](frontend/vite.config.ts) disables demo API proxies and forces public-mode flags. [public/_redirects](frontend/public/_redirects) supplies the Vue Router history fallback (`/* /index.html 200`). Publish only the generated `dist-demo` directory.

## Technical notes and limitations

The full local application is a portfolio implementation, not a production-readiness or security certification claim. Public account hosting needs deployment-specific hardening. Email verification, password recovery, MFA and distributed rate limiting are not implemented. Large-account incremental loading and concurrent-edit protection remain future work.

Before account import, export and verify a backup, review preview/conflicts, and confirm explicitly. Browser exports do not replace PostgreSQL backups or restore account credentials. Restore database backups into a separate recovery database rather than overwriting an active one.

- [Architecture and data boundaries](docs/ARCHITECTURE.md)
- [Security assumptions and limitations](docs/SECURITY.md)
- [Browser acceptance and screenshot guidance](docs/ACCEPTANCE.md)
- [Public-demo implementation and verification notes](docs/PORTFOLIO_DEMO.md)
- [Multilingual financial reporting and API notes](docs/PHASE_4.md)
- [Account implementation history](docs/PHASE_3.md)

Historical delivery notes record earlier verification conditions; they are not a live deployment-status report.
