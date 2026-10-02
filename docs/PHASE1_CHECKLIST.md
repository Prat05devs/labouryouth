# Phase 1 build order and acceptance gates
Checkboxes represent verified acceptance, not the existence of a stub. Track evidence in IMPLEMENTATION_STATUS.md.

1. [ ] Monorepo/config: three apps, safe env template, lockfiles, PostGIS startup, SQLAlchemy schema, forward/back migration review, seeded catalog/Dehradun and no business-code city/category literals.
2. [ ] Auth: registration/login, normalized unique email/phone, Argon2id, confirmation validation, roles bootstrap, rotating hashed refresh sessions/replay handling, logout, password reset single-use/expiry/email, protected admin cookies, deletion entry/API.
3. [ ] Catalog/locations: seven DB services with Hindi labels/schema and hierarchy field; City/ServiceArea, ownership-scoped Address with spatial indexes; immutable job-location snapshot.
4. [ ] Workers: every onboarding step saves/resumes; private uploads/metadata; required evidence; rejection/retry; separate onboarding/worker statuses; online/offline; permissions prevent self-verification.
5. [ ] Client: short onboarding; need-driven home; draft/review/submit requirement; four engagement options; multi-shift schedules/headcount, validated category data, budget/quote; status/timeline/worker profile.
6. [ ] Matching/admin: protected queue, deterministic candidates with service/verification/availability/location/engagement/rate/conflict filters; persisted scoring; audited manual send-offer.
7. [ ] Offers: expiry/decline/withdrawal; competing accept serialized; one assignment per offer and one live worker per slot; multi-headcount behavior; duplicate/replayed requests safe; conflicts return 409.
8. [ ] Work: state-specific prominent action, en-route/arrived, foreground permission and geo check-in using ST_DWithin/time/accuracy; retry/manual request/review; append-only events; recurring shifts; idempotent completion.
9. [ ] Replacement/incidents/cancellation: first-class entities, original history intact, new replacement assignment/remaining shifts, queues and reasons, no automatic punitive action, no job deletion.
10. [ ] Finance/reviews/events: integer paise, PricingService quote/rates, independent payment/earning, immutable ledger and derived screen, unique completed-assignment review, transactional notifications/deep links and redacted audit.
11. [ ] Operations: overview, worker detail/verification, clients, requests/candidates/offers, assignments, replacements, attendance, payment/ledger visibility; role checks tested.
12. [ ] Public: polished landing sections and honest verified-staff copy, no fake metrics/testimonials; DB-driven services; For Workers/app showcase; /app platform redirect with configured links; footer policy/contact/support links owner-reviewed.
13. [ ] Mobile/release: en/hi keys and structured errors, secure tokens, role/onboarding restore, account deletion, no background location; typecheck/export/Expo diagnostics; EAS iOS store profile, real app identifiers, physical iPhone smoke test, signed build and internal TestFlight submission.

## Mandatory regression scenarios
- Different client/worker cannot read or mutate another account's jobs/documents/offers/ledger; guessed IDs and forged mode/role/status fail.
- Email case/whitespace and local/+91 phone variants collide; no plaintext password or token in DB/log.
- Concurrent refresh/replay and password-reset reuse revoke/reject correctly; logout rejects further session use.
- Two workers accept one slot concurrently: one assignment; loser 409. Two jobs competing for one worker's overlapping time: no double-booking. Repeating winner key returns original response.
- Headcount >1 fills distinct slots; MONTHLY/FIXED_TERM generate multiple shifts; completion of first shift does not finish all work.
- Geofence inside/outside, poor/stale accuracy, bad device clock, early/late window, wrong worker, suspended worker and duplicate check-in; audited manual path preserves evidence.
- Repeat complete-shift creates exactly one earning and event; missing agreed rate is quote-required, not zero; ledger update/delete prohibited.
- Address edits do not change existing job geography; replacement retains original attended shifts and earnings.
- Permission denied/offline/401/loading/empty/resume behavior; large text/compact device/keyboard; Hindi labels and accessibility targets.

## Release evidence
Record commands, pass/fail and material gaps. No claim of “ready/shipped” before required gates. If external inputs block deployment, keep source/config complete and list exact missing inputs; do not use demo authentication or bypass verification to force a green demo.
