# Local fictional portfolio data

This standalone development tool adds 25 fictional customers and 84 transactions
(48 income, 36 expense) to one explicitly selected existing account. It does not
change application routes, authentication, preferences, browser storage, the public
demo, deployment configuration, or the schema. It never creates a user.

All customer company names and transaction descriptions carry fictional labels;
email addresses use reserved `example.com` addresses. Amounts are exact EUR cents.
Customer spending matches the generated linked income; it is a separate stored
field in NEXORA and is not recalculated for existing records.

## Read-only preview (PowerShell)

Run from the repository root. Obtain your account ID and email from the existing
authenticated local `/api/auth/me` response (browser developer tools Network tab).
Do not copy cookies, CSRF tokens, or passwords. Both ID and email must match the
same existing account; no account is selected automatically.

```powershell
$env:NEXORA_LOCAL_SEED = '1'
$seedUserId = Read-Host 'Existing local account ID'
$seedEmail = Read-Host 'Matching local account email'
.\backend\.venv\Scripts\python.exe .\backend\seed_portfolio.py --user-id $seedUserId --email $seedEmail
```

The tool reads the existing ignored `backend/.env` without overriding environment
variables. It requires `DATABASE_URL` using `postgresql+psycopg` and a loopback host
(`localhost`, `127.0.0.1`, or `::1`), without URL query parameters. Libpq host,
service, and options environment overrides are rejected. No URL or credential is
printed. Verify that this configuration points to your local development database;
a loopback host alone cannot identify a remote database behind a local tunnel.
Do not use tunnels, production databases, or deployed environments with this tool.

Without `--apply`, the transaction is explicitly PostgreSQL READ ONLY: the tool
only validates identity and reports the date range, additions, skips, and conflicts.
An identity mismatch or conflict exits unsuccessfully without changes. No schema
creation or migration is attempted; the existing account schema must already exist.

Dates default to the last 90 calendar days including today in Europe/Warsaw. To
freeze the generated dates for repeatable previews, append `--end-date YYYY-MM-DD`
using your chosen date (not a future date). Reuse that date for subsequent runs.

## Write behavior (requires separate approval)

Only the explicit `--apply` flag enables insertion. Do not add it until you have
reviewed the preview and approved writing to the selected local account.

All writes occur in one transaction after locking the selected user row. Every
record is assigned that owner's ID; linked customers are checked through the
existing application ownership helper. Existing owner-scoped unique constraints
protect against duplicate keys. Other accounts are never updated or deleted.

Stable `nexora-portfolio-v1:` keys use the existing `legacy_id` columns, separate
from numeric browser-import IDs. Existing keys are skipped even if a user has
edited their data. Existing records are never overwritten, moved, or re-dated.
Customer email collisions abort the entire operation. Any database failure rolls
back all additions. Rerunning on another date does not refresh existing fixtures;
the reported range describes newly generated candidates, not skipped records.
If seed records were manually deleted, a rerun restores missing keys only; existing
customer spending remains untouched. No cleanup or reset command is provided.

## Isolated tests

```powershell
Push-Location .\backend
.\.venv\Scripts\python.exe -m unittest test_seed_portfolio -v
Pop-Location
```

These tests always use a fresh in-memory SQLite database with foreign keys enabled.
They do not load `.env`, consult PostgreSQL environment configuration, or connect to
your account. PostgreSQL row locking and READ ONLY enforcement are explicit in the
CLI but are not integration-tested by this SQLite suite.

Never commit credentials, account details, `.env` files, or database exports.
