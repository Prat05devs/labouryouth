# Mobile app wireframes and design system
Updated: 6 October 2026. Governs the Expo app presentation (Decision 30). Behaviour, API calls and state machines are unchanged; this document only changes how screens are laid out and navigated.

## Why the redesign
The previous screens shared one web-page shell: a logo bar, a 32 to 50 px display headline, paragraphs, then full-width buttons stacked down the page. Choices were stacked buttons with a text tick, tabs had no icons, there were no native headers, sticky actions, list rows, pull-to-refresh or skeletons, and the guest home was a scrolling marketing page with a floating photo collage. It read as a website inside a phone.

## Principles
1. **Native patterns first.** Bottom tab bar with icons for every mode, native stack headers with a back chevron on detail screens, large titles only on tab roots, grouped list rows for settings, segmented controls and chips for choices, bottom sheets for filters.
2. **One primary action per screen, in the thumb zone.** Detail, form and step screens pin their primary action in a sticky bottom bar above the home indicator.
3. **Content before chrome.** No logo bar on every screen. The brand appears on the guest home header, the sign-in entry and the splash.
4. **Scan, then act.** Lists use compact cards with an icon, title, one meta line, a wage or status on the right and a chevron. Detail screens carry the rest.
5. **Honest states.** Every list has skeleton loading, an empty state with an icon and next step, an inline error banner with retry, and pull-to-refresh.
6. **Bilingual and accessible.** All copy from en/hi locale files, 44 px minimum targets, labelled icon buttons, live regions for errors, Reduce Motion respected, layouts that survive large text and Hindi length.

## Account boundary (owner concept)
Nobody is asked to log in while browsing. Services, open roles, role details, available workers and worker details are all public. Login or sign up is asked only when someone taps Apply for this role or Request this worker, and the chosen action continues automatically after login and any required setup (Decision 28). The `(o)` user button sits top right on every browse screen and opens log in or sign up at any time.

## Design tokens
- **Colour** (Decision 29 palette): trust blue `#1F4FD1` primary actions and selection; care teal `#0B7A6E` success, online, verified; courage saffron `#F08A24` and its ink `#9C4708` for pending and attention; warmth rose for destructive emphasis only through danger red `#B3261E`; calm violet and marigold as category tints. Screen canvas `#F4F3EF`, cards white, hairline `#E3E1DB`, text ink `#0B0C0C`, body `#555D64`, captions `#626970`.
- **Type** (Open Sans, system Devanagari fallback): large title 28/34 bold, title 20/26 bold, headline 17/22 semibold, body 16/23, callout 15/21, footnote 13/18, caption 12/16. Anton is kept for brand moments only: the guest home headline in English and money amounts on the earnings balance.
- **Spacing**: 4 pt grid. Screen gutter 16. Card padding 16. Section gap 24. List row height at least 56.
- **Radius**: 12 inputs and buttons, 16 cards and sheets, full for chips and avatars.
- **Elevation**: hairline border plus one soft shadow on cards; the tab bar and sticky bars use a top hairline.
- **Icons**: Ionicons outline for idle, filled for the selected tab.

## Component inventory (`apps/mobile/src/ui.tsx`)
`Screen` (scroll container with optional large title, pull-to-refresh and sticky `footer`), `Button` (primary, secondary, ghost, danger; lg, md, sm; optional icon), `IconButton`, `Field` (label, prefix, icon, password reveal, hint, error), `Card` (optional onPress), `Section` (heading with optional action link), `ListGroup` and `ListRow` (icon tile, title, subtitle, value, chevron, switch or custom right side), `Chip` and `ChipScroller`, `Segmented`, `OptionRow` (radio or checkbox list row), `Stepper` (minus, value, plus), `StepProgress`, `StatusPill` (tone derived from status), `Avatar`, `Banner` (info, success, error) and `ErrorBox`, `EmptyState`, `Skeleton`, `Sheet` (bottom sheet modal), `Copy`, `Txt`.

## Navigation map
```
/                     bootstrap, redirects to role home or /browse
/browse  (tabs)       Guest: Home | Jobs | Workers | Profile
/(client) (tabs)      Hirer: Home | Requests | Updates | Account
/(worker) (tabs)      Worker: Home | Find work | Offers | Earnings | Account
Stack screens with native header and back chevron:
  (public)/job/[id], (public)/worker/[id], (public)/account (sign-in entry),
  login, register, reset, shared/purpose, shared/client-setup, shared/worker-setup,
  shared/quick-post, shared/new-request, shared/job/[id], shared/assignment/[id],
  shared/notifications, shared/coming-soon, shared/delete-account
```
`(public)/home` remains as a redirect to `/browse` for older links.

## Wireframes
Legend: `[Button]`, `( chip )`, `<  >` header controls, `>` chevron, `==` sticky bottom bar, `o` radio, `[x]` checkbox.

### Guest: Home tab
```
+--------------------------------------+
| [LY logo]            (EN|हिं)  (o)   |  brand header, language, profile
|                                      |
| +----------------------------------+ |
| | photo, dark scrim                | |  hero card
| | Work near you, today.            | |
| | Dehradun                         | |
| +----------------------------------+ |
| +---------------+ +----------------+ |
| | [bag] Find    | | [people] Hire  | |  two action tiles
| | work        > | | people       > | |
| +---------------+ +----------------+ |
|                                      |
| Services                    See all  |
| [ Hire people | Find work ]          |  decides where a service tap goes
|  [ic]   [ic]   [ic]   [ic]           |  4-column icon grid, 8 items
|  Maid  Plumb  Elec  Carp             |
|                                      |
| Open jobs                   See all  |
| +--------------+ +--------------+ >> |  horizontal job cards
| | Helper  ₹700 | | Cook    ₹600 |    |
| | Raipur . Day | | ISBT . Day   |    |
| +--------------+ +--------------+    |
|                                      |
| Verified workers            See all  |
| (A) Amit  (S) Sunita  (R) ...    >>  |  horizontal worker cards
|                                      |
| How it works                         |
|  1  Employer posts work              |
|  2  Workers say they are available   |
|  3  Team-verified workers listed     |
| caption: representative images       |
+--------------------------------------+
| [Home]  [Jobs]  [Workers] [Profile]  |  tab bar
+--------------------------------------+
```

### Guest: Jobs tab and Workers tab
```
+--------------------------------------+
| Jobs                            (o)  |  large title, user button
| ( All )( Maid )( Plumber )( Cook )>> |  service chip scroller
|                                      |
| +----------------------------------+ |
| | [ic] Helper               ₹700   | |  job card
| |      Raipur . Daily      /day    | |
| |      12 Oct . 2 openings       > | |
| +----------------------------------+ |
| skeleton x3 while loading            |
| empty: [icon] No open jobs. text     |
+--------------------------------------+
```
Workers tab uses the same layout with worker cards: avatar initial, first name with verified shield, online dot, skills, area and experience, chevron.

### Guest: Profile tab
```
| Profile                              |
| +----------------------------------+ |
| | (LY) Log in or sign up           | |
| | Save work, apply, hire.          | |
| | [Log in]  [Create account]       | |
| +----------------------------------+ |
| PREFERENCES                          |
| | [globe] Language        English >| |
| HELP AND INFORMATION                 |
| | [info] About Labour Youth       >| |
| | [help] Support                  >| |
| | [doc]  Privacy                  >| |
| | [doc]  Terms of use             >| |
```

### Public job detail and worker profile (stack)
```
| <                               (o)  |  native header, user button
| [ic]  Helper                         |
|       Raipur . Daily                 |
| +----------------------------------+ |
| | ₹700            Stated pay       | |  wage card
| +----------------------------------+ |
| +-------------+ +-------------+      |
| | Starts      | | Ends        |      |  2x2 facts grid
| | Openings    | | Work area   |      |
| +-------------+ +-------------+      |
| [lock] Private until you are chosen  |
|======================================|
| [ Apply for this role ]              |  sticky bar
+--------------------------------------+
```
Worker profile: centred avatar, name with shield, online state; stats strip (experience | jobs done | rating); services chips; languages and area rows; privacy note; sticky Request this worker.

### Sign-in entry, log in, register, reset
```
| <                                    |
|           [LY logo]                  |
|   Log in or sign up                  |
|   Your place is saved.               |
| [ Log in ]                           |
| [ Create account ]                   |
| Continue browsing                    |  text link
```
Log in: title, email field with mail icon, password field with reveal eye, `Forgot password?` link right aligned, sticky Sign in, `New here? Create account` link. Register: same fields grouped, live password counter, sticky Create account. Reset: one field and sticky action, success banner.

### Choose purpose
```
| What brings you here?                |
| +----------------------------------+ |
| | [briefcase] Hire staff         > | |  large option cards
| | text                             | |
| +----------------------------------+ |
| | [hammer] Find work             > | |
```

### Client: Home tab
```
| Namaste, Priya               (bell)  |
| +----------------------------------+ |
| | Need workers today?              | |  primary blue card
| | Post work in 60 seconds          | |
| | [ + Post work ]                  | |
| +----------------------------------+ |
| Choose a service           Detailed> |
|  [ic] [ic] [ic] [ic]                 |  grid, opens quick post
| Your requests               See all  |
| | [ic] Plumber   Submitted (pill) >| |  3 latest
| Browse verified workers           >  |
```

### Client: Requests tab
Large title, segmented `Active | Past`, list rows: service icon, service name, date and engagement, status pill, chevron. Empty state with Post work button.

### Client: request detail (stack)
Status header (service, status pill, schedule), details list group (when, where, workers needed, notes), interested workers list with Choose, assignments rows, vertical timeline, and a danger section with reason field and Cancel request.

### Quick post (stack, sticky Post work)
```
| <  Post work                         |
| SERVICE                              |
| ( Maid )( Helper )( Cook ) ...  >>   |
| WHEN                                 |
| [ Today | Tomorrow ]                 |  segmented
| Start time [08:00]   Hours  [- 8 +]  |
| WORKERS AND PAY                      |
| Workers needed            [- 1 +]    |
| Daily wage   ₹ [      ]              |
| Recent local rate ₹500 to ₹800       |
| WHERE                                |
| ( ISBT )( Raipur )( Patel Nagar )    |
| Maps link [               ] Open Maps|
| NOTES  [                    ]        |
|======================================|
| [ Post work ]                        |
```

### Detailed request (stack, 6 steps)
Progress bar with "Step 2 of 6", step title, content as option rows (radio) and steppers, sticky Back and Continue. Review step is a summary list.

### Worker: Home tab
```
| Namaste, Ramesh              (bell)  |
| +----------------------------------+ |
| | (o) Available for offers  [ON ]  | |  availability switch card
| | Location used only when online   | |
| +----------------------------------+ |
| (under review: verification checklist card)
| +---------------+ +----------------+ |
| | Today's work  | | Permanent jobs | |
| +---------------+ +----------------+ |
| My work                              |
| | [ic] Accepted . View assignment >| |
| Coming soon                          |
| [Learn skills] [Apprenticeship] >>   |  muted tiles, "Coming soon"
```

### Worker: Find work tab
Large title, segmented `Today | Permanent`, distance chips 2/5/10/20 km, service chip scroller, filter icon opening a sheet for minimum wage. Job cards show service, wage per day, distance or "in your area", time, openings, employer and rating, notes clipped to two lines, and an inline I am available or Withdraw button.

### Worker: Offers, Earnings
Offers: cards with amount, expiry, status pill, contact card when selected, side-by-side Decline and Accept. Earnings: dark trust-blue balance card with Anton amount, then ledger rows (type, date, amount right aligned).

### Assignment (stack)
Five-step progress strip (Accepted, On the way, Arrived, Working, Done), worker card with photo, contact card, shifts list, sticky state-specific primary action, collapsible "Need help?" with manual check-in, replacement and issue report, and a tap-to-rate star row for completed work.

### Worker setup (stack, 10 steps)
Progress bar and "Step 3 of 10", step title and help, content (field, upload drop zone, checkbox rows), sticky Back and Save and continue. The final step shows a checklist summary and Submit for review.

### Account (both modes)
Profile header (avatar initials, name, current mode), groups: Mode (Switch or add a mode), Preferences (Language value), Help and information (Support, Privacy, Terms, Worker policy), Account (Sign out, Delete account opens its own screen with password and confirmation).

## Device acceptance (pending)
Owner review on the physical iPhone: tab bars, sticky bars above the home indicator, keyboard over forms, largest text size, Hindi labels, VoiceOver order, pull-to-refresh. Record results in IMPLEMENTATION_STATUS.md.
