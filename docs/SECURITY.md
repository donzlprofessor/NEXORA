# Security assumptions and release limitations

This is a tested portfolio MVP, not a claim of production security certification.

## Implemented protections

- Argon2 password hashing through `pwdlib`; passwords are never persisted in plaintext.
- Random opaque session cookies; only token hashes are stored in PostgreSQL. Sessions expire after twelve hours, rotate on login and are deleted on logout.
- HTTP-only, SameSite=Lax cookies; set `COOKIE_SECURE=true` behind HTTPS for public deployments.
- Per-session CSRF tokens on protected mutations and explicit Origin rejection for untrusted browser writes. JSON credential endpoints reject form-encoded requests through request validation.
- Owner-scoped customers, transactions, preferences, imports, exports and AI snapshots. Composite foreign keys prevent cross-account customer links.
- Normalized email uniqueness, input bounds, monetary precision validation and ORM parameterized queries with whitelisted sort fields.
- Private API responses use `Cache-Control: no-store`. Session tokens/passwords are never placed in localStorage.
- Same-origin development proxy; credentialed CORS uses explicit origins, not a wildcard.
- Public static mode makes no auth or inference requests. Backend public-demo mode disables model calls independently.

## Deployment requirements

Use HTTPS, exact `APP_ORIGINS` and `ALLOWED_HOSTS`, `COOKIE_SECURE=true`, private PostgreSQL networking and database backups. Prefer one public origin with `/api` reverse-proxied to FastAPI. Separately hosted frontend/API subdomains must be **same-site** and use HTTPS; unrelated-site cookies are not supported by the current SameSite policy. Set `VITE_API_BASE_URL` only to the intended deployed API, never a developer's private address.

Compose exposes PostgreSQL only at `127.0.0.1:5432`. Ollama URLs are restricted to loopback HTTP origins. The backend Dockerfile exposes its container port internally; if publishing it for local use, bind the host port to `127.0.0.1`, not all interfaces. It deliberately does not route to a host Ollama over a public/container network. For local GPU inference run FastAPI natively on Windows alongside Ollama.

CI uses passwordless trust only inside its disposable runner-local `nexora_ci` service, bound to loopback. This is not the application's Compose configuration and must not be copied into a public or persistent database deployment. No real credentials are committed.

## Remaining security/reliability work

- Authentication rate limiting is process-local and IP-based. Add shared throttling, reverse-proxy request limits and deployment-specific abuse controls before public registration.
- No email verification, password reset, MFA, session management UI, idle expiration or automated expired-session pruning.
- No optimistic version checks on ordinary CRUD updates; concurrent edits can overwrite the same account record. Import previews detect stale datasets and serialize imports per owner, but normal CRUD concurrency needs further work.
- No browser security-header/CSP audit, penetration test, dependency vulnerability scan or real-browser accessibility/security pass was performed.
- SQLite tests validate behavior but do not substitute for PostgreSQL locking, driver, collation, concurrency and deployment validation.
- Backups/exports include customer personal information. Browser localStorage remains unencrypted local demo data, subject to clearing, quotas and shared-device access.
- AI explanations may contain unsupported qualitative statements. Schema/numeric guards and source snapshots are safeguards, not semantic proof.
- API-level body sizes still need a configured proxy limit; Pydantic record/field limits are not a replacement for transport-level size protection.

Do not enable open public registration or claim production readiness until the PostgreSQL CI suite and the manual acceptance checklist pass in the intended deployment.
