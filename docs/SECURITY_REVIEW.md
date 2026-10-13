# Security review and penetration test

## 13 October 2026: Node.js/Express API (`apps/server`, Decision 31)
Scope: the Express API that replaces the FastAPI backend, its SQL migrations, the Supabase Storage driver, the Hostinger deployment settings in [API_HOSTING.md](API_HOSTING.md), and how the Next.js operations proxy reaches it. Owner-authorized review of our own code on a development machine; not a third-party audit. Supabase and Hostinger are not set up yet, so nothing here was tested against them.

Method: line-by-line review of every route for authentication, ownership and role checks; a search for SQL built from input (none: table names come from constant maps, every value is a bound parameter); `npm audit --omit=dev`; and 46 integration tests on PostgreSQL/PostGIS, including `test/security.test.ts` (forged `alg=none`, tampered, foreign-audience, expired, wrong-key and unknown-session tokens; disabled accounts; CORS; SQL injection in paths, queries and bodies; prototype pollution; oversized bodies; error leakage) and the ported FastAPI tests (cross-user access, refresh replay, concurrent accept and selection, idempotency replay and conflict, geofence, immutable ledger and attendance, contact gate, guest browse leakage).

Carried over unchanged from the FastAPI design and re-verified: Argon2id with the same parameters (hashes verify both ways), HS256 pinned with issuer, audience and expiry, session checked on every request, rotating hashed refresh tokens with family revocation on replay, database rate limits, strict request schemas (unknown fields rejected), magic-byte upload checks, the Maps SSRF allowlist, and the public and contact data rules.

| # | Severity | Finding | Status |
|---|---|---|---|
| N1 | High | Dependencies: multer 2.0.1 (several denial-of-service advisories), nodemailer 7.0.3 (SMTP command and header injection, recipient-domain bypass), ajv 8.17.1 (ReDoS with `$data`) | Fixed: multer 2.4.0, nodemailer 10.0.12, ajv 8.20.0; `npm audit --omit=dev` reports 0. nodemailer 10.1.0 was skipped because it was 3 days old. |
| N2 | Medium | Uploads were read into memory (up to 10 MB) before the caller was authenticated, so anonymous requests could consume memory | Fixed: the access token is verified before the body is read; test added |
| N3 | Medium | A slow chain of Maps short links could hold a database connection and transaction for about 25 s; ten at once would exhaust the pool and stall the API | Fixed: one 8 s budget for all hops; pool size configurable (`DATABASE_POOL_MAX`); test added |
| N4 | Medium | Database TLS to Supabase was encrypted but the certificate was not verified (same as the old asyncpg `ssl=require`), allowing an on-path impostor | Fixed for production: it refuses to start without `DATABASE_CA_CERT` or with an unencrypted remote database. Staging may still run unverified; set the CA there too. |
| N5 | Medium | Rate limits depend on the client address from the proxy header. Too few trusted hops lets clients spoof it; too many makes every visitor share one address (a self-inflicted lockout) | Mitigated: only `TRUST_PROXY_HOPS` (default 1) hops are trusted, where FastAPI trusted all. Hostinger's hop count is undocumented: verify with API_HOSTING.md Step 7 before launch. |
| N6 | Low | An idle database connection dropped by the pooler would raise an unhandled pool error and stop the process | Fixed: pool errors are logged by type only |
| N7 | Low | Rate-limit rows were never deleted, so the table grew with every request | Fixed: rows older than a day are pruned during about 1 in 100 rate-limited requests |
| N8 | Low | API responses had no Content-Security-Policy; a served document opened directly in a browser had no script restriction | Fixed: `default-src 'none'; frame-ancestors 'none'; sandbox` and `Cross-Origin-Resource-Policy: same-site` on every response |
| N9 | Low | "I am available" locked the worker before the job, the reverse of offer acceptance, which can deadlock two concurrent requests | Fixed: job, then worker, everywhere |

Open items for deployment, in addition to those below: the Supabase service-role key must exist only in the API app's environment; the Supabase bucket must be private; confirm the proxy hop count (N5); production still needs SMTP and the password-reset page. The operations proxy in `apps/web` was re-read and needs no change: it allowlists admin paths, blocks `..`, checks Origin on writes and keeps tokens in its encrypted cookie.

## 4 October 2026: FastAPI backend (superseded by the review above for the API; kept for the web and mobile findings)
Date: 4 October 2026. Scope: FastAPI backend and PostgreSQL schema, Next.js website and operations console, Expo iOS and Android app source and configuration. This is an owner-authorized review of our own systems on a development machine. It is not a third-party audit and does not cover production hosting, which does not exist yet.

## Method
1. Code review of authentication, sessions, authorization, uploads, the operations proxy, the Maps link resolver and configuration.
2. Automated tests on PostgreSQL/PostGIS (`apps/api/tests`, 13 tests), covering cross-user access, replay, races, idempotency, geofence and the contact gate.
3. Live attack and flow script `apps/api/scripts/e2e_live.py` against the running API and real database: token tampering, `alg=none`, refresh replay, IDOR on jobs, addresses, documents, assignments and contact, admin access by normal users, role self-grant, mass assignment, SQL injection, disguised and oversized uploads, CORS, error leakage, account enumeration and brute force.
4. Dependency audit: `pip-audit` on the API's locked runtime dependencies, `npm audit --omit=dev` on the workspace.

## Result summary
| Area | Result |
|---|---|
| Passwords | Argon2id; constant-time dummy hash for unknown emails; 12+ characters |
| Access tokens | HS256 pinned, issuer, audience and exp required, session checked on every request (revocation is immediate) |
| Refresh tokens | Stored hashed, rotated on use; replay revokes the whole family |
| Rate limits | Login per email (10/min) and per IP (30/min), register per IP (5/min), public browse per IP (60/min) |
| Authorization | Ownership checks on every object route; roles from the database only; SUPER_ADMIN only via operator CLI; workers cannot verify themselves |
| Input | Pydantic `extra="forbid"` blocks mass assignment; typed UUIDs block injection; SQLAlchemy parameters throughout |
| Uploads | Content-type allowlist plus magic-byte check, size limit, private storage, ownership-checked download |
| SSRF | Maps resolver only contacts Google Maps hosts and re-checks every redirect hop |
| Data exposure | Public and feed responses exclude ids, phones, coordinates, notes, map links; contact only after selection |
| Errors | Generic error codes with request id; no stack traces |
| Web console | Encrypted httpOnly SameSite=Strict cookie, Origin check on writes, proxy allowlist, no tokens in localStorage |
| Mobile | Refresh token in SecureStore (Keychain/Keystore), access token in memory only, no secrets in the bundle |
| Python dependencies | No known vulnerabilities |

## Findings and fixes in this review
| # | Severity | Finding | Status |
|---|---|---|---|
| 1 | Medium | FastAPI `/docs`, `/redoc`, `/openapi.json` would publish the full route map in production | Fixed: disabled when `APP_ENV=production` |
| 2 | Low | API responses lacked `nosniff`, frame and referrer headers; no HSTS | Fixed: added, HSTS in production |
| 3 | Medium | Website had no Content-Security-Policy, HSTS or Permissions-Policy | Fixed in `apps/web/next.config.ts` (CSP allows inline scripts that Next.js needs) |
| 4 | Medium | A release build would silently default to `http://localhost` | Fixed: `LY_RELEASE=1` builds fail without an https API URL (Decision 22) |
| 5 | Low | Android could request background location through plugin defaults | Fixed: background location explicitly blocked |
| 6 | Info | iOS location prompt described a hirer flow that no longer uses GPS | Fixed copy |
| 7 | Low | `generate_migration.py` would overwrite the frozen first migration if rerun | Removed |
| 8 | Info | Two queries produced SQL cartesian-product warnings | Rewritten as scalar subqueries |
| 9 | Low | `/admin/{section}` answered 404 for unknown sections before checking the caller's role, so non-staff could discover section names | Fixed: staff role checked first (found by the live run) |

## Open items (must be handled at deployment)
| # | Severity | Item |
|---|---|---|
| A | High | Run the API behind TLS, with uvicorn `--proxy-headers --forwarded-allow-ips=<proxy>`. Otherwise every user shares the proxy's IP and the per-IP rate limits throttle everyone. |
| B | Medium | The web console's Origin check compares against `req.url`. Behind a proxy that rewrites the host, writes would be rejected (fails closed). Set the public origin when deploying. |
| C | Low | The per-email login limit lets someone briefly lock a known account for a minute (an accepted trade-off). |
| D | Low | `auth_attempts` and `idempotency_records` grow without cleanup. Add a scheduled purge of rows older than 30 days. |
| E | Low | The detailed-request draft is kept in AsyncStorage (not encrypted). It holds no credentials; fixed so drafts are now cleared on sign-out. |
| F | Low | npm audit: 30 advisories from 4 root packages. `braces`, `node-forge` and `uuid` are build-time only (Expo CLI and Xcode tooling); `decode-uri-component` ships in expo-router. Its only fixed release is a breaking major, and the impact is a local app stall on a malformed deep link. Upgrade when Expo ships a fix. |
| G | Info | No certificate pinning in the app; standard OS TLS validation applies. |

## Live run result (4 October 2026)
`scripts/e2e_live.py` against the local API and PostGIS database: **77 passed, 1 failed**. The one failure is environmental: password-reset email returns 503 because SMTP is not configured here. Both known and unknown emails get the identical response, so accounts cannot be enumerated. A release blocker until email is configured. Test suite: 13/13 pass.

## Not yet tested
- Binary-level analysis of signed IPA and APK (jailbreak and root behaviour, decompiled-bundle review).
- Production TLS configuration, hosting firewall and storage permissions.
