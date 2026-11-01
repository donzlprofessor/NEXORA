# Architecture and data boundaries

NEXORA remains one Vue application and one FastAPI backend. PostgreSQL is the durable account store; local Ollama is an optional read-only inference dependency. No microservices, paid APIs or hosted inference are needed.

## Modes

**Local demo:** without a session, the existing Customers and Finance stores load browser records from their original keys. Demo changes continue to persist locally. No migration occurs automatically. If `DATABASE_URL` is configured, demo `/api/chat` refuses client-authoritative totals and asks for account AI instead.

**Authenticated account:** opaque HTTP-only cookie sessions identify a database user. Pinia loads that user's data from `/api/account/data`; mutations use scoped REST endpoints before changing the UI. Store watchers explicitly skip localStorage while account mode is active, including hydration and logout. Account preferences are saved explicitly from Settings. Signing out reloads original browser records without writing account data over them.

**Static public showcase:** `VITE_PUBLIC_DEMO=true` prevents session/inference requests from the frontend. It runs the local demo features with live AI/account access disabled. This build does not point at the developer's private model. A deployed account backend must independently use `AI_MODE=disabled` when it has no intended private local inference service.

## Relational model

- `users`: normalized unique email, Argon2 password hash, display name, UTC creation time.
- `login_sessions`: SHA-256 hash of a random opaque cookie token, owner, random CSRF token and expiry.
- `customers`: owner, normalized email, current status, independent lifetime spending in integer cents, nullable historical registration timestamp and nullable legacy source ID.
- `transactions`: owner, date-only business date, income/expense, integer cents, category, nullable explicit customer link, nullable legacy source ID.
- `preferences`: one validated JSON preference object per owner.

Transactions are not automatically linked to customers. A nullable composite foreign key `(owner_id, customer_id)` ensures an explicit link cannot reference another owner's customer. Deleting a linked customer is rejected; remove or reassign the explicit link first. The UI preserves existing links when editing transactions; a dedicated relationship editor is future work.

Owner-scoped email/source-ID uniqueness, nonnegative money and status/type constraints exist in the database. Owner/date, owner/name and owner/category indexes support account queries. All record lookups include owner identity; another owner's ID returns 404, not their record.

## API

- `/api/auth/register`, `/login`, `/logout`, `/me`: sessions and profile.
- `/api/account/customers` and `/{id}`: validated CRUD, search/status filters, pagination and sorting.
- `/api/account/transactions` and `/{id}`: validated CRUD, search/type/category/date filters, pagination and sorting.
- `/api/account/preferences`: read/update the current user's preferences.
- `/api/account/data`: account export/hydration snapshot, preserving the existing frontend chart/store architecture.
- `/api/account/import/preview`, `/api/account/import`: confirmed, idempotent legacy import.
- `/api/account/snapshot`: authoritative selected and previous-period totals, registration completeness and expense categories.
- `/api/account/chat`: accepts messages, period, time zone and optional end date. Client business totals are forbidden.

List APIs paginate at up to one hundred rows per request. The current UI hydrates the account dataset once for its established local filtering/charts and updates it from mutation responses. It does not yet use server pagination for every table interaction; large-account incremental loading, caching and concurrent-edit conflict resolution remain future work. Do not advertise this as a large-scale analytics platform.

## Metrics and AI

All stored monetary amounts are integer cents. Account snapshots aggregate those integers before formatting amounts. Transaction dates remain calendar dates, not midnight UTC instants. Registrations use timezone-aware timestamps; snapshots convert them to the requested validated IANA time zone. Imported undated customers remain undated rather than receiving invented dates. Date-only legacy registration timestamps and malformed/fractional-cent legacy amounts require explicit correction in an exported copy before import; originals are never rewritten.

Authenticated AI derives its snapshot from owner-scoped server records, includes previous-period totals/category breakdowns, and returns exact metrics alongside a bounded qualitative explanation. The frontend displays those metrics separately. Customer names/emails/companies are not sent automatically. Category labels are user-authored data and may themselves contain sensitive text; keep categories free of personal details.

The model receives at most the twelve largest expense categories plus the total category count to bound context size. The returned verified snapshot retains the full calculated breakdown for the UI. Category-list truncation is not interpreted as absence of other categories.

The existing Ollama capability check, thinking-only handling, JSON final-answer schema, one bounded retry, cancellation and timeout safeguards are retained. Reasoning is never forwarded. AI remains fallible and cannot mutate records. Public deployment disables inference unless the operator deliberately configures an intended local service.

## Migration status and verification

Revision `0001` is additive and creates account tables only. It does not inspect or change browser storage. Production startup does not automatically create/drop tables. Downgrades intentionally refuse destructive operations.

On the development machine, migration execution and persistence tests passed on isolated temporary SQLite databases, and PostgreSQL migration SQL compiled offline. PostgreSQL and Docker executables were not available, so no local PostgreSQL migration, PostgreSQL integration suite or Docker image build was executed. CI defines a separate PostgreSQL migration/integration job; adding its workflow is not evidence of a successful remote CI run.

## Phase 4 contracts

Snapshot responses now add `currency`, `reportingPeriod`, exact selected/previous cent-string metrics and availability flags. These exact fields drive the AI summary cards; legacy numeric fields remain compatible. The frontend fetches a snapshot before generation so an already-received summary survives cancellation or model failure. Chat responses add `explanation`, localized server-authored `recommendations` and `aiStatus`; model failures return an unavailable explanation alongside verified metrics. Auth/input errors retain error statuses.

Vue-i18n manages English/Polish/Russian catalogues and English fallback. Browser preferences retain their existing key; account preferences add `language` inside existing JSON. Switching language also updates default response language and Intl formatting, never currency or transaction values. New registration carries the selected language. Model-generated explanations remain qualitative and read-only; server suggestions use recorded evidence and remain available without Ollama. See [Phase 4](PHASE_4.md) for limitations and checks.
