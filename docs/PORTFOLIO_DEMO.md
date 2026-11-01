# Portfolio demo delivery

Implemented on `portfolio-demo`. No commit, push, merge, deployment, database migration, user-data reset or existing environment-file edit was performed. Backend code, authentication, PostgreSQL configuration, migrations and Ollama integration are unchanged.

## Changed files

- `.gitignore`: ignore `dist-demo`; allow only the new public mode configuration through the existing environment-file exclusions.
- `README.md`: separate static demo/full local instructions, storage boundaries and Cloudflare settings.
- `frontend/.env.public-demo`: non-secret Vite public flags.
- `frontend/package.json`: demo development, checked build and preview commands; no dependency changes.
- `frontend/vite.config.ts`: explicit demo flags, no demo API proxy, development-only devtools.
- `frontend/public/_redirects`: Vue history fallback copied to both static build outputs.
- `frontend/src/demo/config.ts`: mode detection and isolated storage namespace.
- `frontend/src/demo/data.ts`: fictional customers and linked transactions with consistent initial totals and relative first-visit dates.
- `frontend/src/stores/{customers,finance,preferences}.ts`: separate demo persistence while preserving normal storage/account behavior.
- `frontend/src/utils/dataTransfer.ts`: demo imports and raw recovery backups use the same isolated namespace.
- `frontend/src/services/http.ts`: deny all public-mode API calls before network access.
- `frontend/src/router/index.ts`: redirect public account/auth entry points to Dashboard; ordinary feature routes remain open.
- `frontend/src/stores/assistant.ts`: public mode cannot produce chat replies, including calculated replies presented as messages.
- `frontend/src/App.vue`: localized demo/storage indicator and hidden public sign-in entry point.
- `frontend/src/views/{SettingsView,AIAssistantView}.vue`: honest public-mode instructions; local setup AI controls remain in normal mode.
- `frontend/src/locales/{en,pl,ru}.json`: matching localized demo notices.
- `frontend/src/__tests__/publicDemo.spec.ts`: persistence, seeded consistency, normal-data isolation, import boundaries, route access and zero backend/AI fetch checks.
- `docs/PORTFOLIO_DEMO.md`: this report.

## Verification

| Check | Result |
| --- | --- |
| `npm run test:unit -- --run` | 71 tests passed in 12 files, including normal-mode regression coverage |
| `npm run type-check` | Passed |
| `npm run lint` | Passed |
| `npm run build` | Passed; `frontend/dist` |
| `npm run build:demo` | Passed; `frontend/dist-demo` |
| Backend selected unittest suites | 42 passed |
| `git diff --check` | Passed |
| `npm audit --json` | 19 moderate development-tooling findings; no high/critical |
| `npm audit --omit=dev --json` | Zero vulnerabilities |

Commands above run from `frontend`. Backend command, from `backend` in PowerShell:

```powershell
$env:ALLOWED_HOSTS='localhost,127.0.0.1,testserver'
$env:DATABASE_URL=''
$env:NEXORA_TEST_POSTGRES_URL=''
.\.venv\Scripts\python.exe -m unittest test_main test_phase4 test_accounts.AccountsTests
```

These overrides were limited to the command process. Account tests use isolated in-memory SQLite and mocked inference. The first backend attempt failed with `Invalid host header` from the existing local environment; the process-only allowlist override resolved it. `MigrationTests` was intentionally excluded to obey the no-migrations constraint. A Starlette/httpx deprecation warning remains.

## Security review

No dependency upgrades or audit fixes were applied. The moderate findings concern glob/minimatch resource exhaustion and affected lint/test dependency chains. Several suggested fixes involve incompatible versions or have no available fix; review the development toolchain separately. The runtime-only audit is clean.

Existing `.env` files and generated build directories remain ignored. The new `.env.public-demo` contains public flags only. Inspection of the demo output found no loopback HTTP URLs, PostgreSQL connection strings, private-key blocks, AWS access IDs, source maps or unexpected artifact files. Two qualifying private values read from existing environment files were compared to the output without displaying them; neither occurred. This is a scoped artifact check, not an exhaustive secret-history audit.

The public build removes backend fetch implementations. Its one remaining literal `fetch()` is Vite's module-preload polyfill loading static script assets. Unit tests also exercise public API, session and AI guards with a fetch spy. The SPA fallback was confirmed in the output. No external fonts, paid services or live AI service were added.

## Cloudflare Pages and manual acceptance

Use root `frontend`, command `npm run build:demo`, output `dist-demo`, a supported Node 24 LTS release >=24.12.0, and no backend environment variables or bindings. Publish only the output folder after separate authorization. The README links the official Cloudflare build and redirect documentation.

No real-browser automation was available in this checkout. Before release, verify desktop/mobile layout, keyboard navigation, language switching, customer/finance create-edit-delete followed by refresh, settings persistence, JSON export/import and deep-link refresh on the actual Pages host. In the browser Network panel confirm that only static assets are requested, including on Assistant and account redirects.

Normal-mode builds, frontend account regressions and isolated backend tests pass. Live PostgreSQL authentication and local Ollama inference were not run; verify them using the existing full local setup. No claim of a live full-stack integration test is made.

Browser records do not sync across devices, can be lost through browser settings, and age naturally after the first visit. Lifetime customer spending remains independently editable after seeding. Static hosting cannot supply account persistence or live AI; those features require the full local application.
