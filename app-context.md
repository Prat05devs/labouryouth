# Labour Youth app context
Last updated: 4 October 2026. This file describes the Labour Youth mobile app as it exists in this repository today: what it does, who it is for, every flow, every screen, and the visual system (fonts and colours). Decision numbers refer to `docs/DECISIONS.md`. Build and test status lives in `docs/IMPLEMENTATION_STATUS.md`; this file does not claim anything is released.

## 1. What the app is
Labour Youth is a local daily-work marketplace for Dehradun, Uttarakhand. People who need work done (homes, shops, sites, hotels) post a job with the day, the number of people and the daily wage. Verified workers nearby see the job, with the wage shown up front, and tap "I am available". The hirer chooses a worker. The chosen worker then gets the hirer's WhatsApp number and Google Maps location, so the two can talk directly.

One account can act as a hirer, a worker, or both. The app is in English and Hindi.

Tagline: "Good work. Close to home."

## 2. Who uses it
| Person | In the app | What they want |
|---|---|---|
| Guest | Anyone who opened the app without signing in | See whether there is work or workers near them before registering |
| Hirer (CLIENT role) | Households, shops, contractors, hotels | Get reliable help for today or for a fixed period |
| Worker (WORKER role) | Maids, drivers, masons, electricians, cooks, helpers and other trades | Find paid work near home, with the wage clear before they commit |
| Operations team | Uses the web admin console, not the app | Verify workers, watch jobs, handle replacements, incidents and payments |

## 3. Product principles
- **Look before you sign up.** The app opens on public listings, not a login wall (Decision 18).
- **Real data only.** No fake jobs, workers, ratings or counts. Empty lists show an honest empty message (Decisions 15, 18).
- **Only verified workers are listed.** Operations approves a worker's identity documents, plus police verification for household roles, before the worker appears (Decisions 4, 14).
- **The wage is visible up front** on every job card.
- **Contact after selection.** The hirer's WhatsApp number and map link go only to the worker the hirer chose (Decision 21).
- **Free for workers.** Employer pricing is not implemented, and no prices are shown (Decision 13).
- **Hirers share a Google Maps link, not GPS.** Workers still use GPS to go online and to check in on site (Decisions 10, 21).

## 4. Features
### For everyone
- Guest browse: open jobs and verified workers, filtered by service.
- About section and "how it works" steps.
- English and Hindi switch on every main screen.
- Sign up, sign in and forgot password.
- Choose purpose (hire or find work), switchable later in Settings.
- Notifications list (in-app events with deep links).
- Settings: switch mode, sign out, request account deletion.

### For hirers
- One-time setup: name, WhatsApp number, address and an optional Google Maps link.
- **Quick post** (the main path): service, workers needed, daily wage, today or tomorrow, start time, hours, locality, Maps link and notes. A market wage range is shown once 5 or more real postings exist (Decision 15). Eligible nearby workers are notified.
- **Detailed request:** hourly, daily, fixed-term or monthly work, with schedule windows, headcount, budget or quote, and service-specific requirements.
- My requests: list, status, timeline, interested workers (first name, skills, experience, completed jobs, real review score, distance), choose a worker, cancel with a reason.
- Assignment view: worker summary, shifts, replacement request, incident report, review after completion.

### For workers
- Resumable 10-step onboarding: basic details, photo, services, experience, languages, locations, availability, identity document, police verification, payout.
- Status "under review" until operations activates the worker.
- Home: go online or offline (needs GPS), today's work, permanent jobs, coming-soon tiles, current assignments.
- Nearby jobs feed: 2/5/10/20 km, skill, today only, minimum wage, daily or permanent. Shows "in your area" when the job has no map pin.
- "I am available" (express interest) and withdraw.
- Offers: accept or decline. After selection, a contact card offers "Chat on WhatsApp", "Call" and "Open location in Google Maps".
- Work day: start journey, arrived, check in (GPS geofence), complete shift, manual check-in request with a reason.
- Earnings: balance and ledger entries.
- Replacement request, incident report and review.

### Coming soon (labelled screens only, no content, Decision 16)
Learn skills, apprenticeship, start your own work.

## 5. Flows
### 5.1 App launch
1. The app restores the session from SecureStore (refresh token).
2. Signed in: the user goes to their home for the last active mode (hirer home, worker home, or the setup screen if setup is unfinished).
3. Not signed in: the user lands on the **Guest home**.
4. If the network fails during restore, the user sees Try again and "Look around without signing in", which opens the guest home.

### 5.2 Guest browsing
1. On the Guest home, a guest sees the city label, the headline, two role cards ("I want work", "I want to hire"), a trust strip and a service grid (8 tiles, then "More").
2. Below the service grid the guest home also explains the three kinds of work (daily, contract, permanent), shows sourced India labour-market figures (tap opens the source) and a "Since 2023" card linking to Instagram, so the app is useful even with no listings.
3. The guest switches between the "Open jobs near you" and "Verified workers" tabs, and can filter by tapping a service tile.
4. Job cards show service, wage per day, locality, engagement type, start time and openings left.
5. Worker cards show first name, skills, area, experience, review score or "No reviews yet", and availability.
6. Any action ("Create a free account to apply" or "...to hire") opens **Sign up**. The fixed bottom bar always offers Sign in and Create account.
7. Public data never includes IDs, phone numbers, exact coordinates, notes or employer identity.

### 5.3 Sign up
1. Fields: full name, email, mobile number, password, confirm password.
2. The app checks before sending: name of at least 2 letters, valid email, 10-digit mobile, password of at least 12 characters (a live counter shows "9 characters of 12"), and passwords that match.
3. Errors appear under the exact field with a red border. Server field errors are mapped the same way.
4. The server normalizes email and phone, so case and +91 variants collide with existing accounts. Passwords are hashed with Argon2id.
5. On success, tokens are stored (refresh token in SecureStore) and the user goes to **Choose purpose**.
6. There is no phone OTP in this release.

### 5.4 Sign in
1. Email and password. On success, the user goes to the home for their mode.
2. Links: Forgot password, Create account, language switch.

### 5.5 Forgot password
1. The user enters their email, and the server sends a single-use, expiring reset link. The response looks the same whether or not the email exists.
2. The link opens the reset screen with a token: new password and confirmation.
3. Success shows a confirmation, and the user signs in again.

### 5.6 Choose purpose
- "Hire staff" adds the CLIENT role. "Find work" adds the WORKER role. Either can be added later through Settings > Switch mode.

### 5.7 Hirer setup
1. Name, WhatsApp number (prefilled from the account phone), city, address label, address line, locality, state and PIN code.
2. Optional Google Maps link: "Open Google Maps", drop a pin, Share, copy, paste.
3. The server reads the pin from the link. Short `maps.app.goo.gl` links are followed safely, contacting only Google Maps hosts. With no link, the address uses the service-area centre (AREA precision).
4. A link from another site is rejected with "This is not a Google Maps link".

### 5.8 Quick post
1. Choose the service and see the market wage range if one exists.
2. Enter workers needed, daily wage, today or tomorrow, start time, hours, locality, Maps link and notes.
3. Post. The job opens immediately and nearby eligible workers are notified. The user goes to the job's status screen.
4. The hirer's WhatsApp number is attached to the job but never shown in listings.

### 5.9 Detailed request
- Choose an engagement (hourly, daily, fixed term, monthly), schedule windows, headcount, budget or quote request, requirements and address. Save a draft, review, then submit.

### 5.10 Hirer chooses a worker
1. The job screen lists interested workers with their real profile summary.
2. Tapping "Choose" creates a normal job offer. Headcount limits are enforced, so the job is never overfilled.
3. The worker still has to accept the offer. Contact unlocks for that worker as soon as the offer exists.

### 5.11 Worker onboarding
1. 10 steps, each saved on its own so the worker can leave and resume.
2. Documents are uploaded privately and never shown publicly.
3. After submission the worker waits for operations, who approve or reject with a reason. Retry is supported.
4. A worker cannot verify themselves.

### 5.12 Worker finds and takes work
1. Go online (location permission is asked for here).
2. Open the jobs feed and filter it.
3. Tap "I am available".
4. When chosen, an offer appears. Accept or decline it. The contact card gives WhatsApp, Call and Maps.
5. Before selection, the card reads: "The employer's WhatsApp number and location unlock when they choose you."

### 5.13 Work day
1. Start journey, then arrived.
2. Check in: the worker's GPS must be inside the geofence (the configured radius for pinned jobs, the service area for AREA jobs), within the time window and accurate enough.
3. If check-in fails, the worker can request a manual check-in with a reason, which operations reviews.
4. Complete shift. The earning is created exactly once.
5. Multi-shift work repeats this for each shift.

### 5.14 After work
- Review: one review per completed assignment.
- Replacement request and incident report: available on any active assignment.
- Earnings: the worker's derived balance and immutable ledger.

### 5.15 Account
- Switch mode, language, sign out.
- Delete account: password confirmation, then a deletion request goes to operations.

## 6. Screens that exist today
Paths are under `apps/mobile/app`. "Seen" means the screen was viewed on the iOS simulator after the latest redesign. Other screens are built and typecheck, and pick up the new palette through shared components, but have not been reviewed by hand.

| Screen | File | Who | Purpose | Seen |
|---|---|---|---|---|
| Launch / redirect | `index.tsx` | All | Restore session and route | Yes |
| Guest home | `(public)/home.tsx` | Guest | Browse jobs and workers, About, sign-up prompts | Yes (empty state, English) |
| Sign in | `(public)/login.tsx` | Guest | Email and password | Earlier palette only |
| Sign up | `(public)/register.tsx` | Guest | Registration with field-level errors | Yes (before the field-error change) |
| Reset password | `(public)/reset.tsx` | Guest | Request link, set new password | No |
| Choose purpose | `shared/purpose.tsx` | New user | Hire or find work | No |
| Hirer setup | `shared/client-setup.tsx` | Hirer | Name, WhatsApp, address, Maps link | Earlier version only |
| Hirer home | `(client)/index.tsx` | Hirer | Quick post entry, services, notifications | No |
| Quick post | `shared/quick-post.tsx` | Hirer | One-step daily job | No |
| Detailed request | `shared/new-request.tsx` | Hirer | Multi-step request with schedules | No |
| My requests | `(client)/requests.tsx` | Hirer | Active requests list | No |
| Job status | `shared/job/[id].tsx` | Hirer, offered worker | Status, timeline, interested workers, choose, cancel | No |
| Worker setup | `shared/worker-setup.tsx` | Worker | 10-step onboarding | No |
| Worker home | `(worker)/index.tsx` | Worker | Online toggle, today's work, permanent jobs, coming soon, assignments | No |
| Nearby jobs | `(worker)/jobs.tsx` | Worker | Feed with filters, I am available | No |
| Offers | `(worker)/offers.tsx` | Worker | Accept or decline, contact card | No |
| Earnings | `(worker)/earnings.tsx` | Worker | Balance and ledger | No |
| Assignment | `shared/assignment/[id].tsx` | Hirer, worker | Shifts, check-in, completion, replacement, incident, review, contact card | No |
| Notifications | `shared/notifications.tsx` | Signed in | In-app updates | No |
| Settings / account | `shared/settings.tsx` (also `(client)/account.tsx`, `(worker)/account.tsx`) | Signed in | Mode, sign out, delete account, policy links | No |
| Coming soon | `shared/coming-soon.tsx` | Worker | Labelled placeholders | No |

**Navigation:**
- Guest and auth screens sit in a stack.
- Hirer tabs: Home, Requests, Account.
- Worker tabs: Home, Jobs, Offers, Earnings, Account.

**Shared components:**
- `src/ui.tsx`: Screen, Button, Field, Card, Copy, Chip, Badge, Empty, ErrorBox.
- `src/LocationForm.tsx`: address form and Maps link field.
- `src/ContactCard.tsx`: hirer contact after selection.

## 7. Typography
Fonts are bundled with the app (`@expo-google-fonts`), so no runtime Google Fonts request is made.

| Role | Font | Size and spacing | Notes |
|---|---|---|---|
| Display headings (screen titles, guest headline) | **Anton** 400 | 32 px, line height 40 (guest headline 36/44), letter spacing 0.2 | Sentence case, no forced capitals (Decision 20) |
| Wage figures on job cards | Anton 400 | 22 to 24 px | Onyx |
| Body text | **Open Sans** 400 | 16 px, line height 25 | Charcoal |
| Strong text, labels, buttons, chips, tabs | Open Sans 600 SemiBold | Labels 15, buttons 17, chips and tabs 15, big tiles 20 | |
| Inputs | Open Sans 400 | 17 px | Carbon Black text, Dim Grey placeholder |
| Small captions (trust strip, tile labels, hints) | Open Sans 400 or 600 | 12 to 14 px | Dim Grey or Charcoal |
| Hindi | System Devanagari (Noto Sans Devanagari on Android) | Same sizes | Anton and Open Sans have no Devanagari |

## 8. Colours
Owner palette, light theme (Decision 20). No gradients anywhere. Tokens are in `apps/mobile/src/ui.tsx`. The website uses the same values in `apps/web/app/globals.css`.

| Name | Hex | Token | Used for |
|---|---|---|---|
| Onyx | `#0B0C0C` | `ink` | Headings, primary buttons, selected chips, tabs and tiles, the "I want to hire" card, wage figures |
| Carbon Black | `#1C1E20` | `text` | Strong body text, card titles |
| Gunmetal | `#35393C` | `lineStrong`, `blue` | Outlines of secondary buttons, the "Permanent jobs" tile, the website's worker panel |
| Charcoal | `#555B60` | `muted` | Body copy (about 6.4:1 contrast on the page background) |
| Dim Grey | `#646B71` | `quiet` | Captions, placeholders, inactive tabs, coming-soon tiles (about 5:1) |
| Brass | `#C9A15A` | `accent` | The single accent: "I want work" card, website primary call to action. Always with Onyx text |
| Dark brass | `#7A5C22` | `accentText` | Brass used as text or icon (city label, trust icons, "More", verified shield) |
| Page background | `#F4F4F2` | `paper` | Screen background |
| Card surface | `#FFFFFF` | `white` | Cards, inputs, bottom action bar, tab bar |
| Raised | `#ECEDEC` | `soft` | Icon circles, badges, segmented control background |
| Divider | `#DADCDD` | `line` | Card and input borders, dividers |
| On dark | `#FFFFFF` | `onInk` | Text on Onyx and Gunmetal surfaces |
| On brass | `#0B0C0C` | `onAccent` | Text on brass |
| Error | `#B3261E` on `#FBEAE8` | `danger`, `dangerBg` | Field errors and the error box |

**Rules:**
- Dark text on light backgrounds.
- Brass appears once or twice per screen, never as body text, and only in its dark shade when used as text.
- Selected states use Onyx with white.

## 9. Shape, spacing and icons
- **Radii:** cards 20; buttons 14; service tiles and role cards 16 to 18; inputs 12; chips 22 (pill); badges 30.
- **Touch targets:** at least 44 px. Buttons are 54 px, inputs 52 px.
- **Spacing:** page padding 24 (guest home 20), section gap 20, maximum content width 680.
- **Icons:** Ionicons from `@expo/vector-icons`. Service icons come from the database catalog (`icon` field).
- **Status bar:** dark content on the light background.

## 10. Technology
- **Mobile:** Expo (React Native) with expo-router, TypeScript, SecureStore for tokens, expo-location (worker only) and expo-document-picker.
- **Backend:** FastAPI modular monolith, PostgreSQL with PostGIS, Alembic migrations (latest `0003_contact_maps`).
- **Website:** Next.js with Tailwind and shadcn/ui: public site, information pages, `/app` smart link and operations admin.
- **Data:** service categories and localities come from the database; there are no hard-coded city or category lists.
- **API base:** `EXPO_PUBLIC_API_URL`, default `http://localhost:8000/api/v1`.

## 11. Not done yet
- Hindi copy needs native-speaker review.
- Most screens have not been reviewed by hand after the redesign. Large text and small devices are not checked.
- No physical iPhone test, signed build or TestFlight. Production hosting, email and store links are not configured.
- WhatsApp, Call and real `maps.app.goo.gl` resolution are not tested on a device or over the internet.
- Legal pages are drafts pending owner review.
