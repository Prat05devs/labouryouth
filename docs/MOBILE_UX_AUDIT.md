# Mobile UX audit
Updated: 5 October 2026. Scope: static review of the Expo Client, Worker and public marketplace screens using the mobile-app-ux-auditor skill. This is not device usability evidence.

## Reviewed and improved
- Client home starts with service needs and active requests; the app does not present an empty worker feed.
- Worker work details provide one state-specific primary action. Check-in requests foreground GPS after the worker taps Start Shift; a visible manual request path handles GPS failure.
- Worker onboarding saves each step. Selecting an offline service area no longer demands location permission; permission is requested when the worker chooses to go online or checks in.
- Shared controls have 52–54 px minimum heights, explicit accessibility labels, visible busy/disabled states and structured localized errors. Auth and onboarding can recover from network failures without losing server-saved steps.
- English and Hindi locale keys cover current screen copy and domain errors. Backend codes, rather than message text, drive the error copy.

## Release acceptance still required
- On a physical iPhone and Android device, inspect small and large text sizes, keyboard overlap, VoiceOver/TalkBack order, Hindi truncation, touch targets, screen-reader labels and low-connectivity retries.
- Complete the full Client → Admin → Worker loop with real PostGIS data. Verify that offer expiry, assignment changes, check-in rejection and manual review display accurate state after refresh.
- Confirm camera/document selection behavior on devices and the private worker photo display in both app modes.

An iPhone simulator is booted locally, but neither Expo Go nor a Labour Youth native build is installed there. A screen-level review still needs an installed build and a responsive API.

No static P0/P1 finding remains from this pass. Device findings may change that assessment and must be fixed before release.

## 4 October 2026: homepage and motion pass

| Priority | Evidence and impact | Change or remaining check |
|---|---|---|
| P2, addressed in source | Guest catalog failures were swallowed and listings had no loading indicator or retry. | Explicit loading, catalog empty/error and listing retry states; stale list responses cannot overwrite a newer filter. |
| P2, addressed in source | Four-column service labels were truncated, and the fixed authentication bar reserved a constant bottom gap. | Two columns, one column at compact width or increased font scale, full labels, and authentication actions in normal layout. |
| P2, pending device QA | New photo collage, card/heading entrances and button press feedback affect layouts across screens. | Native-driver opacity/transforms, short finite motion and live Reduce Motion handling implemented; physical-device, VoiceOver and largest-text verification still required. |

Before: guest role cards and every listing action pushed registration before the visitor could inspect the role or worker. After: the app opens as a service-filtered marketplace. Role and worker cards open public detail screens, and a top-right user control offers login or registration at any time. Authentication begins only from Apply for this role or Request this worker. The selected action survives login, registration and required role onboarding, then continues automatically.

The public worker detail exposes work information only. The public role detail excludes employer identity, contact, exact location and notes. A preferred-worker request enters the existing job and offer state machine, so the worker still accepts or declines before any assignment exists.

Static scan after the marketplace change: no P0 signal. One P1 heuristic matched the shared Button implementation, which already provides button role, label, disabled state and busy state. Three P2 text matches remain in existing notification/navigation screens. TypeScript and bundle checks validate source and packaging, not device behavior. No new media playback, location request or background activity was added. Populated public cards, large text, Hindi layouts, VoiceOver/TalkBack order and low-connectivity continuation still require device QA.
