# Data model
## Conventions
UUID primary keys; created_at/updated_at UTC except immutable events/ledger which never update. Foreign keys indexed, ON DELETE RESTRICT for financial/fulfillment history. Status values constrained. Optimistic version where useful; transaction row locks for critical actions. JSONB only for bounded validated metadata, never a substitute for core relationships. Currency ISO code, INR initially; all money integer paise with bounds. Geography uses SRID 4326 with GiST indexes.

| Entity | Required useful fields and constraints |
|---|---|
| User | id, full_name, normalized email/phone (individually unique), password_hash, email_verified_at?, phone_verified_at?, status ACTIVE/DISABLED/DELETION_REQUESTED, last_active_mode?, created/updated |
| UserRole | user_id, role CLIENT/WORKER/SUPER_ADMIN/OPERATIONS/VERIFICATION/FINANCE/SUPPORT; unique(user,role); self-service restricted to CLIENT/WORKER |
| Session / Device | user_id, device label/platform?, refresh_hash unique, family_id, expires_at, revoked_at?, rotation parent?, last_seen_at; no raw tokens |
| PasswordReset | user_id, token_hash unique, expires_at, consumed_at; atomic single use |
| ClientProfile | user_id unique, client_type INDIVIDUAL/BUSINESS, primary_address_id?, onboarding_complete |
| Address | owner_id, label, line1/line2, locality, city_id, state, postal_code, country, lat/lng/geography; ownership enforced |
| Organization / Member / Location | reserved boundaries: organization identity, user membership+permission, organization-owned address; not Phase 1 B2B UI |
| WorkerProfile | user_id unique, bio, experience_years, photo_document_id?, onboarding_step/progress, onboarding_status, worker_status, preferred area references, engagement_types, rate expectations, submitted_at |
| WorkerService | worker_id, service_id, experience/validated attributes; unique pair |
| WorkerLanguage | worker_id, language_code, proficiency?; unique pair |
| WorkerAvailability | worker_id, kind IMMEDIATE/SCHEDULED/RECURRING, online flag, starts_at/ends_at?, recurrence metadata/timezone; valid ranges |
| Document | owner_id, private storage_key, purpose, MIME, size, checksum, uploaded_at, retention/deletion markers; no public URL |
| WorkerVerification | worker_id, type, document_id?, status, reviewer_id?, reviewed_at?, expiry?, reason; append history/audit on review |
| ServiceCategory | name, name_hi, slug unique, icon, parent_id?, active, sort_order, requirement_schema, verification_policy; prevent hierarchy cycles |
| City | name, state, country, slug unique, active, timezone |
| ServiceArea | city_id, name, slug, boundary geography/radius+center, active; unique city+slug |
| JobRequest | client_id, service_id, engagement_type, service_area_id, immutable location_snapshot+geography, start_at/end_at, schedule windows, recurring metadata/timezone, headcount>0, budget_min/max?, currency, notes, status, submitted_at |
| JobRequirement | job_id, key, validated value JSONB; unique(job,key); validate against service schema at submit |
| CandidateMatch | job_id, worker_id, distance_m, eligibility reasons, scoring version, score_components, final_score, status ELIGIBLE/INELIGIBLE/SELECTED/STALE, generated_at; current unique pair, audit/version history |
| JobOffer | job_id, worker_id, candidate_id?, replacement_request_id?, status, offered_at, expires_at, responded_at?, agreed_worker_amount_paise; unique pending job/worker intent |
| Assignment | job_id, worker_id, offer_id unique, slot_number, status, assigned_at/accepted_at/started_at/completed_at?, replacement_of_id?, agreed terms snapshot; one live occupant per job slot |
| Shift | assignment_id, scheduled_start/end, status, agreed_earning_paise?, currency; unique assignment+window; no overlapping active work for a worker across jobs |
| AttendanceEvent | worker_id, shift_id, type CHECK_IN/CHECK_OUT/MANUAL_REQUEST/MANUAL_CHECK_IN/REJECTED, lat/lng/accuracy?, device_timestamp?, server_timestamp, outcome/reason, actor_id, idempotency key; append-only |
| ReplacementRequest | job_id, original_assignment_id, requester_id, reason, details, status, replacement_assignment_id?, resolved_at; prevent duplicate open request for same assignment |
| Cancellation | job_id, assignment_id?, actor_id, reason, fee_paise?, refund_paise?, metadata, created_at; immutable event, no deletion |
| Incident | job_id?, assignment_id?, reporter_id, type, description, status, assigned_admin_id?, resolution; restrict visibility |
| Review | assignment_id, reviewer_id, reviewee_id, rating 1..5, tags[], comment; unique assignment+reviewer+reviewee; completed assignment only |
| Payment | job_id, payer_id, method PAY_LATER/CASH/MANUAL_UPI, provider?, provider_reference?, amount_paise, currency, status, idempotency_key; provider reference unique when supplied |
| WorkerLedgerEntry | worker_id, type, signed amount_paise, currency, shift_id?, payout_id?, reversal_of_id?, source_key unique, created_at, actor_id?; append-only database protection; no edits/deletes |
| Payout | worker_id, amount_paise, currency, status, provider_reference?, approved_by?, timestamps; manual initially, no raw bank credentials in general profile |
| Pricing / Plan / Subscription | PricingService configured rate/quote and immutable accepted terms now; plan/subscription/org-contract relations reserved; no subscription UI |
| Notification | recipient_id, event_id, kind, localized message key/parameters, route/entity IDs, read_at?, created_at; unique recipient+event |
| DomainEvent / Outbox | event type, aggregate_id, payload (minimized), occurred_at, delivery state, attempts; transactional and retry safe |
| AuditLog | actor, action, entity type/id, reason, redacted before/after, request_id, server_timestamp; append-only |
| IdempotencyRecord | actor_id, operation, key, request_hash, response/status, expires_at; unique scope+key |
| AccountDeletionRequest | user_id, requested_at, status, operational holds, processed_at; audit anonymization |

## Enums
Engagement: HOURLY, DAILY, FIXED_TERM, MONTHLY. Worker onboarding: NOT_STARTED, IN_PROGRESS, SUBMITTED, COMPLETE. Worker status: PENDING_VERIFICATION, ACTIVE, SUSPENDED, BLOCKED, INACTIVE. Verification types: IDENTITY, POLICE, BANK, DRIVING_LICENSE, ADDRESS, SKILL_CERTIFICATE, REFERENCE. Full lifecycle enums are in STATE_MACHINES.md.
Replacement reasons: NO_SHOW, UNAVAILABLE, QUALITY_ISSUE, CLIENT_REQUEST, WORKER_REQUEST, EMERGENCY, OTHER. Incident types: NO_SHOW, BEHAVIOUR, PAYMENT, SAFETY, QUALITY, LOCATION, ATTENDANCE, OTHER. Ledger types: EARNING, BONUS, INCENTIVE, DEDUCTION, ADJUSTMENT, PAYOUT, REVERSAL.

## Relationships, indexes and retention
Client 1:N JobRequests; job 1:N offers/assignments/requirements/matches; assignment 1:N shifts; shift 1:N attendance/events/earning adjustments. Worker 1:N verification/documents/services/languages/availability/assignments. Job status, worker status, open offer expiry, all foreign-key lookups, geography, notification recipient+created, worker ledger+created and outbox pending indexes are required.
Passwords and token hashes are highly restricted. Documents, phones, addresses and exact coordinates are personal data; do not expose them to unassigned workers or public catalog. Clients see assigned worker basics and verification summary, never identity files/bank details. Log redaction and least-privilege DB/storage access apply. Retention durations need approved policy; preserve legally/operationally necessary financial and incident history under controlled access while honoring account deletion. Backups follow the same retention policy.
