# Product scope: governing baseline, 1 October 2026
## Purpose and personas
Labour Youth fulfills local staffing needs. Client: individual/household creates a requirement, follows fulfillment and requests help/replacement. Worker: creates a resumable profile, submits verification, chooses availability, accepts offers and records work. Operations: manually verifies, matches, dispatches, resolves exceptions and sees financial records. Initial city is seeded Dehradun; business logic uses City/ServiceArea IDs.

## Phase 1 surfaces
One Expo mobile app with Client and Worker navigation, a FastAPI backend, PostgreSQL/PostGIS and a Next.js application containing a public marketing landing and protected admin. The public site is not a client hiring web app. iOS is the immediate distribution target; Android architecture remains compatible.

Auth is email/password with mandatory full name, normalized unique email and E.164 mobile. Confirmation is validated but not stored. Email/phone verification may be null initially. Use user_roles, not a single irreversible role. Role selection follows registration and does not block adding the other role later. Active mode is a preference only.

Seed exactly House Maid, Driver, Security Guard, Babysitter, Patient Care, Event Staff, Other. Database rows contain name/name_hi/slug/icon/parent/active/order. Service requirements are validated against service-defined metadata, never dozens of category columns.

Client home shows categories and active requests. Client onboarding asks name, individual/business model and primary location; individual UI is sufficient tonight. Requirement creation supports HOURLY, DAILY, FIXED_TERM, MONTHLY and location snapshot, schedule, headcount, requirements, quote/budget, review and submission. Follow status, assigned worker basics, journey/attendance, completion and review. Replacement entry point is required.

Worker onboarding saves each step: basic info, photo, services, experience, languages, preferred locations, availability, identity uploads, police verification, payout placeholder, submit. Show pending review and reasoned rejection. Online/offline, offers, accept/decline, active assignment, one primary action per state, foreground geo check-in, completion and derived ledger totals are required.

Admin: protected overview, verification queue, worker profiles, clients, open jobs, suitable candidates, offers/manual dispatch, active assignments, replacements, attendance and payments/ledger. SUPER_ADMIN is enough initially. Admin actions are audited.

Payments use PAY_LATER/CASH/MANUAL_UPI without pretending a gateway captured money. PricingService supports configured rates or quote-on-request. Worker earnings are separate immutable ledger entries. Notifications are persisted by domain event handlers; push is incremental.

## Marketplace addendum (Decision 13)
The seven-category "seed exactly" rule is superseded by Decision 14. Home offers five large Hindi entries: आज का काम (live), स्थायी नौकरी (live, permanent requirements), Skill सीखें, Apprenticeship and अपना काम शुरू करें (Coming soon). Employers (the CLIENT role, individual or business) post in one step; workers see only open jobs near them for skills they hold, and need ACTIVE verification and ONLINE availability to express interest.

## Out of scope tonight
Background tracking, Aadhaar OCR/automated identity checks, AI matching, automated dispatch/payouts, B2B billing, GST/invoice automation, chat, voice prompts, subscriptions UI, worker browsing/feed, referrals, coupons, surge pricing, extra categories and complex analytics. Keep useful extension boundaries; do not build empty features or production stubs that falsely report success.

## UX constraints
Expo Router groups `(public)`, `(client)`, `(worker)`, `shared`. Bootstrap tokens → `/me` → roles/onboarding → correct route; both roles use last valid mode. Worker controls at least 48 logical pixels, visible labels, large text support, Hindi-ready locale JSON and one prominent state action. Explain permission denial, network loss, expired auth and retries without losing saved onboarding. No new visual product concept is authorized; use a restrained accessible interface for these flows.
