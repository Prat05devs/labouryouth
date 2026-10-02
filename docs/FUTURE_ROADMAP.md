# Extension roadmap
Phase 1 ships the documented operating loop; future items must not block it.

| Stage | Extension | Existing boundary reused |
|---|---|---|
| 1.1 | Optional email verification enforcement, phone SMS/WhatsApp verification; delivery retry and push | User verification timestamps, auth/email adapter, sessions, event/outbox, Notification |
| 1.1 | Improved weekly calendars, bounded recurring shift generation, confirmation/disputes | WorkerAvailability, JobRequest recurrence metadata, Assignment, Shift/COMPLETION_PENDING, Incident |
| 1.1 | Razorpay collection/refunds and secure webhook reconciliation | Payment, PricingService, idempotency and domain events; ledger remains separate |
| 1.2 | Automatic candidate dispatch/offer expiry and replacement dispatch | MatchingService, CandidateMatch, JobOffer, ReplacementRequest; same concurrency guards |
| 1.2 | Approved third-party identity/police verification and payout provider | WorkerVerification, Document, provider adapter; User IDs unchanged; no homemade Aadhaar OCR |
| 1.2 | Automated payroll/payouts and two-way reviews | Immutable ledger, Payout, Shift, existing Review reviewer/reviewee |
| 2 | Organizations, branches, contracts, subscriptions | Organization/Member/Location, pricing context, Plan/Subscription, existing JobRequest |
| 2 | Additional cities/categories and advanced operations permissions | City/ServiceArea, database ServiceCategory hierarchy/schema, roles/permissions/audit |

Background tracking, chat and any new marketplace/referral feature require explicit future product decisions, privacy review and separate scope. No migration should replace User, JobRequest, Assignment or Shift to implement these extensions.
