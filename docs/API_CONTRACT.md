# API contract
Base `/api/v1`; JSON snake_case; UUID strings, ISO-8601 UTC timestamps with offsets, integer paise. OpenAPI generated from Pydantic is the executable contract; this document specifies required behavior. List responses `{items, next_cursor}` with bounded limit (default 20, max 100). Mutation success returns persisted resource/transition, never invented status. Auth bearer on mobile; admin BFF uses protected cookie and forwards server credentials. Public routes explicitly allowlisted.

## Response/error conventions
```json
{"error":{"code":"OUTSIDE_GEOFENCE","message":"Check-in is outside the permitted area.","details":{"retryable":true},"requestId":"uuid"}}
```
All errors (including 422 and unexpected 500) follow this shape. UI maps stable codes to locale strings; no parsing message text. Details never expose secrets, SQL or other users' identities. X-Request-ID response header. HTTP 400/422 validation, 401 invalid session, 403 forbidden, 404 unavailable resource, 409 conflict/invalid state, 429 rate limit, 503 dependency unavailable.
Codes include VALIDATION_ERROR, INVALID_CREDENTIALS, EMAIL_ALREADY_REGISTERED, PHONE_ALREADY_REGISTERED, SESSION_EXPIRED, FORBIDDEN, NOT_FOUND, INVALID_STATE_TRANSITION, JOB_ALREADY_ASSIGNED, OFFER_EXPIRED, WORKER_NOT_VERIFIED, WORKER_UNAVAILABLE, SCHEDULE_CONFLICT, OUTSIDE_SERVICE_AREA, OUTSIDE_GEOFENCE, LOCATION_INACCURATE, LOCATION_STALE, CHECK_IN_WINDOW_CLOSED, SHIFT_NOT_ACTIVE, IDEMPOTENCY_CONFLICT, QUOTE_REQUIRED.
Idempotency-Key required for offer acceptance, check-in, completion and financial writes; recommended for job submit/replacement/cancellation. Same actor/action/key+payload returns original result; altered payload 409. No arbitrary status PATCH.

## Endpoint inventory
| Method/path | Actor and contract |
|---|---|
| POST /auth/register | Public `{full_name,email,phone_number,password,confirm_password}` → 201 tokens/user with no initial privileged roles; confirmation never stored |
| POST /auth/login | Public `{email,password}` → access_token, refresh_token, token_type, expires_in, user summary |
| POST /auth/refresh | `{refresh_token}` → rotated pair; lock session; family replay revoke |
| POST /auth/logout | Auth/current refresh session → 204; idempotent revocation |
| POST /auth/forgot-password | Public `{email}` → same 202 response for all addresses; email adapter; rate limited |
| POST /auth/reset-password | Public `{token,password,confirm_password}` → 204; single-use token; revoke sessions |
| GET /me | Auth → id/name/email/phone, roles, last_active_mode, client/worker onboarding and verification summaries |
| POST /me/roles | Auth `{role: CLIENT|WORKER}`; idempotently add own role/profile |
| PUT /me/preferences | Auth `{last_active_mode,locale}` validated against roles/locales |
| POST /me/deletion-request | Auth + current password/reauth proof, explicit confirmation → 202; revoke sessions and record request |
| GET /services; GET /locations | Catalog DB data incl localized names, requirements and active areas; no hard-coded services |
| GET/PUT /client/profile | CLIENT own short onboarding fields |
| GET/POST /addresses; PUT /addresses/{id} | Own addresses; structured fields and lat/lng; never mutate job snapshot |
| GET/PUT /worker/profile | WORKER own details/progress; server-owned statuses excluded |
| PUT /worker/onboarding/{step} | Validated named step payload; save progress/version; no arbitrary JSON status mutation |
| POST /worker/onboarding/submit | Validate all required steps → under review |
| GET/PUT /worker/services; /worker/languages; /worker/availability | Own data, validated catalog IDs, schedule/ONLINE-OFFLINE |
| POST /documents; GET /documents/{id} | Private owner/reviewer access; multipart bounded allowlist; metadata/reference response, authenticated stream or expiring access |
| GET/POST /worker/verifications | Own evidence submission/read-only status; no self approval |
| POST /jobs | CLIENT `{service_id,engagement_type,service_area_id,address_id,schedule,headcount,budget_min?,budget_max?,currency,notes,requirements}` → DRAFT with immutable location snapshot |
| GET /jobs; GET /jobs/{id} | Own client jobs; assigned/offered worker limited view; authorized operations view; status timeline and relevant shifts |
| POST /jobs/{id}/submit | Owner; validate complete demand, snapshot, area, schedule, requirements → SUBMITTED |
| POST /jobs/{id}/cancel | Owner/permitted operations `{reason}` → Cancellation and updated aggregate under policy |
| GET /jobs/{id}/matches | Operations only; never expose unassigned worker personal documents |
| GET /offers | WORKER own offers |
| POST /offers/{id}/accept | Owner WORKER + idempotency; revalidate/lock → Assignment+shifts or 409 JOB_ALREADY_ASSIGNED |
| POST /offers/{id}/decline | Owner pending offer → DECLINED |
| GET /assignments; GET /assignments/{id} | Assigned worker / owning client / operations |
| POST /assignments/{id}/en-route; /arrived; /prepare-next-shift | Assigned worker; enforce transition and shift readiness |
| POST /shifts/{id}/check-in | Worker `{latitude,longitude,accuracy_m,device_timestamp}`; foreground; geo/time/actor checks; persisted attendance |
| POST /shifts/{id}/manual-check-in-request | Worker `{reason,location_observation?}` → event/review queue, not automatic success |
| POST /shifts/{id}/complete | Worker; IN_PROGRESS only; idempotent completion/earning event |
| POST /replacements; GET /replacements | Involved client/worker `{assignment_id,reason,details}` and own status |
| POST /incidents | Involved party `{assignment_id,type,description}` → OPEN |
| POST /reviews | Owning client `{assignment_id,rating,tags,comment}` completed assignment only |
| GET /worker/earnings | Own signed ledger plus derived totals grouped by currency; paginated |
| GET /notifications; POST /notifications/{id}/read | Recipient only; persisted route/entity keys |
| GET /admin/overview; /workers; /workers/{id}; /clients; /jobs; /assignments; /attendance; /payments; /ledger; /incidents; /replacements | Permission-scoped, bounded lists/detail, redacted personal data |
| GET /admin/verifications; POST /admin/verifications/{id}/approve; /reject | VERIFICATION or SUPER_ADMIN; reason/evidence policy, audit |
| POST /admin/payments | FINANCE/SUPER_ADMIN `{job_id,method,amount_paise}`; create manual/pay-later record with idempotency and audit |
| POST /admin/jobs/{id}/generate-matches | OPERATIONS/SUPER_ADMIN; MatchingService persists results |
| POST /admin/jobs/{id}/offers | OPERATIONS/SUPER_ADMIN `{worker_id,expires_at,agreed_worker_amount_paise,replacement_request_id?}`; eligibility and audit |
| POST /admin/replacements/{id}/review; /rematch | OPERATIONS/SUPER_ADMIN explicit reasoned workflow |
| POST /admin/attendance/{id}/approve; /reject | OPERATIONS/SUPER_ADMIN manual review; audit plus separate manual event |
| POST /admin/payments/{id}/reconcile | FINANCE/SUPER_ADMIN `{reference,evidence,amount_paise}`; server policy, idempotency, audit |

## Authorization matrix
CLIENT owns profile/addresses/jobs and sees only assigned worker public summaries. WORKER owns onboarding/docs/availability, offers and assignments; job data limited to legitimate offered/assigned work. OPERATIONS sees dispatch/attendance/replacements; VERIFICATION private evidence; FINANCE payments/ledger; SUPPORT incidents/help; SUPER_ADMIN all explicitly scoped operations. No role is inferred from route, email domain or mode preference. Ordinary accounts can never create admin role grants. Bootstrap SUPER_ADMIN through audited operator CLI.

## Validation contracts
Passwords long enough for configured policy, bounded maximum, no silent truncation. Normalize email trim/lower and Indian mobile to E.164; validate actual number format. Latitude [-90,90], longitude [-180,180], finite positive accuracy. Schedule windows start<end, bounded count, non-overlapping and valid timezone; budgets nonnegative with min≤max. Service metadata schema rejects unknown/invalid requirement keys. Reject unknown protected fields rather than trusting client status, earnings or verification.
