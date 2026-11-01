# Phase 3 delivery inventory

## Created

- `backend/database.py`: SQLAlchemy models, relationships, constraints, lazy PostgreSQL sessions.
- `backend/accounts.py`: authentication, CSRF/session dependencies, owner-scoped CRUD, preferences, export, migration preview/commit and authoritative snapshots.
- `backend/alembic.ini`, `backend/migrations/env.py`, `backend/migrations/script.py.mako`, `backend/migrations/versions/0001_accounts.py`: additive migration tooling/revision.
- `backend/test_accounts.py`: authentication, isolation, precision, import, snapshot, public-mode and migration/persistence integration tests; optional isolated PostgreSQL test backend.
- `backend/requirements.lock.txt`: exact tested backend package versions without private URLs/secrets.
- `backend/Dockerfile`, `backend/.dockerignore`: optional backend packaging.
- `compose.yaml`, `.env.example`: loopback-only PostgreSQL with named volume and operator-supplied password.
- `.github/workflows/ci.yml`: backend tests, PostgreSQL migrations/integration, frontend tests/type/lint/build.
- `frontend/src/services/http.ts`: credentialed API requests, in-memory CSRF, timeouts and session-expiry handling.
- `frontend/src/stores/auth.ts`: registration/login/logout, restoration and account/demo state switching.
- `frontend/src/views/AuthView.vue`: login and registration UI.
- `frontend/src/components/AccountMigration.vue`: preview, backup, conflict display and typed import confirmation.
- `frontend/src/__tests__/accounts.spec.ts`: account data preservation, route guards, expiration, migration UI, stale response isolation and static public mode.
- `docs/ARCHITECTURE.md`, `docs/SECURITY.md`, `docs/ACCEPTANCE.md`, `docs/PHASE_3.md`: architecture, limits, acceptance/screenshot guidance and inventory.

## Modified

- `backend/main.py`: account router, origins/CORS, privacy/error responses, authenticated server-derived AI, public-mode disable switch and comparison/category context.
- `backend/requirements.txt`: free SQLAlchemy/Alembic/PostgreSQL/Argon2 dependencies.
- `backend/.env.example`: database, session/cookie, origin/host and public-demo configuration.
- `frontend/.env.example`: separate API origin and static public-demo mode.
- `frontend/src/stores/customers.ts`, `finance.ts`: remote CRUD with account-mode storage isolation; original local loaders/keys preserved. Late responses after identity changes are discarded.
- `frontend/src/stores/preferences.ts`: separate account hydration and explicit server save; local preferences preserved.
- `frontend/src/stores/assistant.ts`, `frontend/src/services/ai.ts`: authenticated request path, authoritative metrics/comparisons, cancellation and public-mode safeguards; demo behavior retained when no database is configured.
- `frontend/src/views/CustomersView.vue`, `FinanceView.vue`: asynchronous saves/deletes with validation, server errors and pending-submit protection.
- `frontend/src/views/SettingsView.vue`: account preferences/import tools, account export and guarded demo-only reset/import.
- `frontend/src/views/AIAssistantView.vue`: server-verified previous-period and category figures.
- `frontend/src/components/layout/Sidebar.vue`, `frontend/src/App.vue`: account status/navigation/sign-out.
- `frontend/src/router/index.ts`, `frontend/src/main.ts`: auth pages, protected account route, restoration and expiry handling.
- `frontend/src/__tests__/workflows.spec.ts`: await asynchronous persistence before checking dialog completion.
- `README.md`: full-stack setup, recovery, deployment modes and current verification limits.
- `.gitignore`: ignore database files, private environment variants, dumps and local JSON exports.

## Verification and preservation

The baseline had 17 backend AI tests and 42 frontend tests. Final verification includes authentication/authorization/import/storage isolation in addition to those regressions. Existing browser records were not imported, cleared, migrated or reset during implementation. All data operations used synthetic fixtures and isolated test databases; no user PostgreSQL instance was touched.

Migration revision `0001` runs on isolated SQLite tests and generates PostgreSQL SQL offline. Local PostgreSQL/Docker tools are missing, so actual PostgreSQL execution and Docker builds remain blocked. CI is configured but has not run remotely. No code was committed or pushed. The free required libraries were installed in the existing backend virtual environment with approval; no frontend dependencies were added.

A live authenticated FastAPI-to-Ollama smoke request returned HTTP 200, a qualitative explanation and exact owner-scoped server totals using an isolated SQLite account fixture. This verifies the application-to-model path, not PostgreSQL deployment or browser acceptance.
