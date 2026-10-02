# Implementation status
Updated: 2 October 2026. This is a build report, not a release claim. The [Phase 1 checklist](PHASE1_CHECKLIST.md) remains the acceptance gate.

## Implemented source
- Three-app monorepo: Expo Client/Worker app, FastAPI modular monolith, Next.js landing and protected operations dashboard.
- Production-domain SQLAlchemy schema and initial Alembic migration for PostgreSQL/PostGIS; seed script for Dehradun and seven database-driven services.
- Email/password and role-based auth, rotating hashed refresh sessions, reset/deletion requests, private worker evidence, resumable onboarding, availability, requirements, matching, offers, assignment/shift/attendance, replacement, incidents, reviews, in-app events, manual payment reconciliation, ledger and operations actions.
- Mobile en/hi copy, secure token storage, role bootstrap, location requested at check-in, structured error display and EAS configuration. Public website has a configurable smart link.

## Verified locally
- Python Ruff and compileall pass; FastAPI imports and generates OpenAPI for 59 paths.
- Mobile and web TypeScript checks pass; Next.js production build passes.
- iOS Expo export passes, and Expo Doctor passes 21/21 checks. This verifies the JavaScript bundle/configuration, not signing or native device behavior.
- The [mobile UX audit](MOBILE_UX_AUDIT.md) found no static P0/P1 issue, but physical-device and assistive-technology acceptance remain open.

- Brand theme (logo, three gradients, Anton/Open Sans) applied to web and mobile shared UI; web typecheck and iOS export pass after the change. Not yet checked: visual review on device, Hindi rendering, contrast audit of gradient surfaces, and the whole-app sweep of screens that may still hold hard-coded colours. Mobile `tsc` reports a pre-existing casing conflict (`index.ts` imports './App' vs `app/`).

- Web information pages (about, privacy, terms, worker policy, support/FAQ, contact, delete-account) and mobile Account links exist as drafts. Legal text is NOT final and needs owner/legal review; the App Store privacy questionnaire, iOS privacy manifest review and Play data-safety form are still pending and externally blocked.

## Not yet verified or shipped
- PostgreSQL/PostGIS migration, seed and integration tests need a responsive database. Docker Desktop did not respond to local checks, so concurrency, geo and ledger behavior are not claimed as passing. Do not substitute a mock database for this gate.
- No physical iPhone/Android usability pass, signed EAS build, App Store Connect upload or internal TestFlight submission has been performed. A JavaScript export is not a signed build.
- Production hosting, private storage and email transport need real configuration and operational smoke tests. Payment is manual/pay-later by design; no live Razorpay charge or automated payout is claimed.
- Release needs owner-supplied Expo/Apple identifiers and signing access, deployed API/web URLs, reviewed policy/contact text and destination links. The `.env.example` contains placeholders only.
