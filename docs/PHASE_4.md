# Phase 4 — financial accuracy and multilingual support

Implemented locally on 1 November 2026. No deployment, commits, account resets, database migrations or changes to live business records were performed.

## Features and data flow

Authenticated PostgreSQL transaction rows are selected by the current session owner through SQLAlchemy. FastAPI calculates selected and previous calendar periods using integer cents; the validated IANA zone controls the current date and customer registration dates. Transaction dates stay calendar dates. The server builds Ollama context from these records, never client totals. Ollama remains local, read-only and restricted to qwen3:4b.

`GET /api/account/snapshot` now includes:

- `currency` and `reportingPeriod` (inclusive start/end, period and timezone).
- `metrics` and `previousMetrics`: exact revenue, expense and net-profit cent strings, transaction/income/expense counts.
- `availability`: selected-period records, previous-period records, expense categories, unavailable order/conversion metrics.
- Full expense-category totals with exact `amountCents` strings.
- Existing numeric `context`, `previousPeriod` and category `amount` fields for compatibility. These presentation fields are not the authoritative precision contract.

`POST /api/account/chat` retains `content`, `model` and `snapshot`, and adds `explanation`, `recommendations` and `aiStatus`. Generation errors (502/503/504) return the calculated snapshot with an unavailable explanation and a status code in `aiStatus`, without exposing the upstream response. Input, authorization and CSRF failures keep their HTTP error statuses. Deployment-disabled AI still returns 503.

The frontend retrieves a snapshot before inference, then replaces it with the snapshot used for the completed answer. Revenue, expenses and net profit render in separate responsive cards, with period, EUR, transaction count and missing-data notices. Exact cent strings are formatted using BigInt and Intl parts, including negative fractional amounts and totals beyond JavaScript's safe integer range. Local demo summaries are labelled as local calculations. Cancelled/timed-out generation leaves an already-received summary visible.

Generated prose is qualitative and cannot supply authoritative numerical claims. Prompts prioritize financial evidence, distinguish observations from suggestions and prohibit inferring commercial capacity from customer registrations. The separate three-item recommendation list is server-authored, localized, evidence-based advice; model suggestions may also appear in the explanation. This deliberate fallback keeps useful suggestions available when inference fails. Neither is a forecast or a guarantee of profitability.

## Localization coverage

Vue-i18n supplies 335 messages in each of English, Polish and Russian. Catalogues cover Dashboard, Analytics, Customers, Finance, AI Assistant, Settings, login/registration, account migration, navigation, forms, filters, pagination, chart labels, accessibility labels, notifications, validation and known API errors. Import conflicts interpolate identifiers without changing source records. Native language names and user-authored business data remain in their original language.

A language selector is available in the application shell before login and in Settings. Switching is immediate, updates the document language, selects corresponding Intl formatting and the default AI response language, and persists in existing browser preferences or authenticated account preferences. New registration adopts the selected language; existing accounts retain their stored preference. Response language can be overridden separately with the AI selector. The legacy German number-format preference remains available for compatibility. EUR is never converted.

Translation strings live in `frontend/src/locales/{en,pl,ru}.json`; templates use stable keys through `t`, while `tr` maps existing UI/API messages to their catalogue keys. Add matching keys and interpolation parameters in all three catalogues when extending the UI. English is the fallback. No translation service or paid API is involved. Language is an additive JSON preference; no schema migration is needed.

## Files created

- `backend/financial_advice.py`, `backend/test_phase4.py`, `backend/smoke_polish.py`.
- `frontend/src/i18n.ts`, `frontend/src/locales/en.json`, `pl.json`, `ru.json`.
- `frontend/src/components/LanguageSelector.vue`, `frontend/src/__tests__/i18n.spec.ts`.
- `docs/PHASE_4.md`.

## Files modified

- Backend: `accounts.py`, `main.py`, `test_accounts.py`, `test_main.py`.
- Frontend dependencies: `package.json`, `package-lock.json` (vue-i18n).
- App initialization: `src/main.ts`, `src/App.vue`.
- Stores: `src/stores/preferences.ts`, `assistant.ts`, `auth.ts`.
- Services: `src/services/ai.ts`, `http.ts`.
- Views: `AIAssistantView.vue`, `AnalyticsView.vue`, `AuthView.vue`, `CustomersView.vue`, `DashboardView.vue`, `FinanceView.vue`, `NotFoundView.vue`, `SettingsView.vue`.
- Components: `AccountMigration.vue`, `PaginationControls.vue`, `RevenueChart.vue`, `layout/Sidebar.vue`.
- Tests: `src/__tests__/assistant.spec.ts`.
- Documentation: root/frontend READMEs, `docs/ARCHITECTURE.md`, `docs/ACCEPTANCE.md`.

## Executed verification

| Check | Result |
| --- | --- |
| Backend unittest suite | 39 passed, isolated SQLite and mocked Ollama |
| Frontend Vitest suite | 59 passed in 11 files |
| TypeScript | Passed (`vue-tsc --build`, also in production build) |
| Oxlint and ESLint | Passed (`npm.cmd run lint`) |
| Production Vite build | Passed |
| Existing auth/security/import regressions | Passed as part of backend/frontend suites |
| Live Polish Ollama | Initial response was Polish and hid reasoning, but made an unsupported customer/revenue inference. Instructions were tightened. Retest of the final instructions reached the configured timeout; final live explanation quality is unverified. |
| Live PostgreSQL integration | Not executed in this phase; no live database was migrated or mutated |
| Real browser/mobile/accessibility checks | Not executed; checklist below |

The initial backend baseline was rejected by the deployment's TrustedHost setting, so tests explicitly allow `testserver` in the test process. Demo gateway tests now isolate `DATABASE_URL` from the deployment environment. Deployment host/auth settings were not weakened. PowerShell execution policy requires `npm.cmd` on this machine.

Tests cover exact fractional cents, inclusive period boundaries, exclusion of future/out-of-period transactions, empty periods, loss, previous-period comparisons, category totals, invalid language/date/zone/period, model-independent metrics, preserved snapshots on offline/timeout/generation failure, localized model instructions, preference round trips, language switching/persistence, login/registration/settings text, catalogue parity/key resolution, interpolation parameters, fallback, exact currency/date formatting and unchanged monetary data. Existing tests cover cross-account isolation, CSRF, origins, Argon2, session rotation/expiry, migration and import integrity.

## Remaining limitations

- Local qwen3:4b can time out and generate unsupported qualitative statements. A successful first Polish response is not proof of reliable final-prompt behavior; the final retest timed out. Figures and server-authored suggestions remain available independently.
- Previous-period presence means records exist, not that accounting is complete. No transactions does not prove no commercial activity. No growth percentages are invented from a zero baseline.
- Legacy numeric API fields remain for compatibility; use the exact cent-string contract for authoritative financial presentation.
- Snapshots still load owner records in memory, as before. Larger accounts need database aggregation and server pagination.
- npm installation reported 19 moderate dependency vulnerabilities. No forced dependency upgrades were applied. This work is not a production security certification.
- Browser layout, keyboard flow, PostgreSQL integration and deployment require separate acceptance. No Git metadata is present in this workspace, so a Git diff/status could not be produced.

## Windows restart (existing installation)

Stop existing FastAPI/Vite terminals with Ctrl+C before restarting them. Keep the existing environment files and database volume.

Terminal 1, start the existing database if it is managed by Compose:

```powershell
Set-Location "$env:USERPROFILE\Projects\nexora"
docker compose up -d db
```

For a separately installed PostgreSQL service, start that existing service instead. No new migration is needed for Phase 4. Initial setup/migrations remain documented in the root README.

Ensure the Ollama tray service is running, or use a separate terminal:

```powershell
ollama serve
```

Skip that command when Ollama is already serving. `ollama list` should include `qwen3:4b`. Keep it bound to loopback.

Terminal 2:

```powershell
Set-Location "$env:USERPROFILE\Projects\nexora\backend"
.\.venv\Scripts\python.exe -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload
```

Terminal 3:

```powershell
Set-Location "$env:USERPROFILE\Projects\nexora\frontend"
npm.cmd run dev
```

Open `http://127.0.0.1:5173`, or continue using `localhost` if that is where your existing browser data lives. The two hostnames have different localStorage. The dependency is installed in this workspace; use `npm.cmd ci` only when preparing another checkout.

Reproduce checks:

```powershell
Set-Location "$env:USERPROFILE\Projects\nexora"
$env:ALLOWED_HOSTS='localhost,127.0.0.1,testserver'
.\backend\.venv\Scripts\python.exe -m unittest discover -s backend -v
Set-Location frontend
npm.cmd run test:unit -- --run
npm.cmd run lint
npm.cmd run build
```

Opt-in live smoke test, using synthetic data only:

```powershell
Set-Location "$env:USERPROFILE\Projects\nexora\backend"
.\.venv\Scripts\python.exe smoke_polish.py
```

## Manual browser acceptance checklist

Use disposable test accounts and fixture transactions; do not replace existing business records.

- Before login, select Polski and Русский. Check login, registration, navigation and validation text; refresh and verify persistence.
- Register a disposable account in Polish; verify language and EUR formatting. Switch language, refresh, sign out/in, and verify account preference and unchanged demo data.
- Inspect all eight views in each language, including empty states, dialogs, pagination, chart tooltips, errors and Settings/import warnings. Confirm user-entered names/descriptions/categories are unchanged.
- In a disposable account, record €600 revenue and €70 expenses within the chosen period. Confirm €600.00/€70.00/€530.00 and Polish `600,00 €`/`70,00 €`/`530,00 €` with correct dates and count.
- Add an out-of-period transaction: all-time Finance should change while the selected AI summary excludes it. Test 7D/30D/90D, previous-period data, empty periods and negative profit.
- Ask the Polish profitability prompt. Confirm separate exact cards, concise Polish explanation and evidence-based suggestions. Override response language to English/Russian. Verify no reasoning trace, invented figures or customer-acquisition claims.
- Stop Ollama or cancel a pending explanation. Already-fetched summary cards must remain visible with an appropriate localized notice. Restart Ollama and retry.
- Use another browser profile/account. Verify records, language preferences and financial/chat data do not leak across accounts; logout during inference must remove private data.
- At mobile width, verify cards, filters, language selectors and dialogs fit; check keyboard navigation, focus, Escape, labels, skip link and contrast.
- Preview an import without confirmation, verify translated conflict messages and source backups; do not import/reset valuable data as an acceptance shortcut.

## NEXORA 1.0 follow-up — exact-figure replies

The remaining misleading refusal was caused by conflicting responsibilities: the model was asked to answer exact-amount questions while the prompt/schema/numeric guard explicitly prohibited it from writing numbers. Existing cards already used verified numbers, but generated prose could still say those numbers were unavailable. Server recommendations also assumed pricing/delivery/recurring-cost information that the ledger does not establish.

The focused fix leaves the existing layout and storage architecture intact:

- Exact-figure wording in English, Polish and Russian takes a deterministic path. Authenticated UI replies use the selected-period server snapshot and exact cent strings; direct authenticated chat requests receive a server-formatted response from those same metrics. No Ollama call is required for these questions.
- Local-demo replies use the existing browser-record calculation and selected calendar period. Local data is not represented as PostgreSQL-verified: the existing local-demo label remains. When DATABASE_URL is configured, the unauthenticated chat gateway still rejects client-authoritative contexts.
- Other model replies that deny available figures or introduce unsupported business operations are conservatively replaced with a deterministic financial reply. Prompt instructions now explicitly distinguish available zero totals from unavailable data. Generated numeric claims remain prohibited; only deterministic code supplies amounts.
- Generation failures after a successful snapshot also leave a numerical reply in the conversation. A failed snapshot request cannot fabricate zero totals or reuse the prior request's summary. Cancellation and identity-change protections remain.
- Demo contexts now include transaction count, so no records can be distinguished from records whose totals happen to be zero. Empty-period messages in all three catalogues explicitly explain that zero is not missing data.
- Recommendations use recorded expense entries/categories and data-completeness checks. Recurring/fixed-cost, delivery and service-pricing assumptions were removed. Empty periods receive only the applicable record-completeness suggestion.

Changed implementation: `backend/financial_answer.py` (new), `backend/main.py`, `backend/financial_advice.py`; `frontend/src/stores/assistant.ts`, `preferences.ts`, `services/ai.ts`, `utils/metrics.ts`, `views/AIAssistantView.vue`, and the existing empty-period message in all three locale files. Regression tests were added to `backend/test_phase4.py` and `frontend/src/__tests__/assistant.spec.ts`.

Follow-up verification: 43 backend tests and 67 frontend tests pass, including existing auth/CSRF/isolation tests, exact questions in all three languages, the quoted Polish denial, expense/income period filtering, empty versus zero-valued records, offline inference, missing snapshots, immutable local transaction values and rendered authoritative cards. TypeScript, Oxlint, ESLint and production build pass.

Limitations: live PostgreSQL and real-browser acceptance were not run during this follow-up. Exact replies require the account API to be available; browser-demo totals are computed locally. General generated explanations remain fallible, and the wording-based safety filter deliberately favors a verified summary when it detects potentially misleading prose. Exact-intent matching covers common wording in the supported languages; unusual paraphrases may use the normal explanation path, while the deterministic cards remain available. No live Ollama smoke test is required to produce the exact reply, and none was run in this follow-up. No user data, environment configuration, auth policies or database schema were changed, and nothing was committed or pushed.
