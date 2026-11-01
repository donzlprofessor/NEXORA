# Manual browser acceptance and portfolio evidence

Use two browser profiles and disposable accounts. Export valuable local data first. This checklist is supplied for verification; it was not completed by an automated browser in this sprint.

1. Start PostgreSQL, apply Alembic, start FastAPI and Vite. Verify the same hostname used for prior localStorage records.
2. Before login, record raw values of `nexora_customers`, `nexora-transactions` and `nexora_preferences`. Export JSON. Check existing demo CRUD, search, filters, pagination and analytics.
3. Register account A. Confirm it starts empty and existing browser records have not been imported or changed. Reload and confirm session restoration. Wrong password, invalid email and short passwords must fail clearly.
4. Add/edit/delete an account customer and transaction. Reload to verify persistence. Confirm Dashboard/Analytics update and remain consistent across 7D/30D/90D. Test decimal cents, invalid dates and duplicate emails.
5. Save account display preferences; reload and verify them. Sign out: original browser data/preferences must return byte-for-byte unchanged.
6. Sign in to A; open Account and migration. Preview browser records; ensure no records appear before confirmation. Download and verify the source backup. Wrong confirmation text and conflicts must disable import.
7. Confirm import; verify source keys are unchanged. Preview again: identical imported records must be skipped. Change a source record in an exported copy: conflict must prevent overwriting the account record. Mutate account data after preview: commit must reject the stale preview.
8. Register account B in the other profile. A's customers, transactions, preferences, export and AI figures must not appear. Requests using A's record IDs must return 404. Missing/incorrect CSRF tokens must return 403.
9. Expire/logout the session, then attempt a mutation. The UI must show expiration and return to login without retaining A's account records or chat. Signing in to B must never reveal A's data.
10. Ask the four regression prompts in English and Russian: Hello; Summarize my business; What data is missing for growth analysis?; How can I improve expense tracking? Check selected/previous periods, EUR figures and categories against the account records. Cancel inference; stop Ollama and test offline status. Reasoning must never appear.
11. Verify phone/tablet/desktop layouts, sidebar drawer, collapse, skip link, keyboard tab order, Escape, dialog focus restoration and 404 navigation. Confirm pending form submissions cannot double-create records.
12. Build with `VITE_PUBLIC_DEMO=true`; inspect network activity. No auth/inference request may target localhost, the developer's API or private Ollama. A full public backend should also use `AI_MODE=disabled`.

## Screenshots and demo recording

Capture only seeded/disposable data: desktop Dashboard, mobile navigation, customer dialog, Finance filters, Analytics selected period, confirmed import preview and AI explanation with server-verified figures. Never capture real emails, password fields, cookies, CSRF values, database URLs, terminals showing secrets or exported personal data. Save shareable assets under `docs/screenshots/` after manual review. Include a short video demonstrating login, persistence after reload, local migration preview and an actual local AI response; label public-demo AI as disabled rather than simulating a live response.

## Phase 4 multilingual and financial acceptance

Complete the additional [Phase 4 manual browser checklist](PHASE_4.md#manual-browser-acceptance-checklist) in English, Polish and Russian. It includes pre-login/account language persistence, stable filter identifiers, exact €600/€70/€530 fixture figures, period boundaries, empty/loss periods, cancelled/offline inference, mobile accessibility and unchanged source records. These browser checks remain unexecuted in this phase.
