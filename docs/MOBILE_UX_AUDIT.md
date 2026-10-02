# Mobile UX audit
Updated: 2 October 2026. Scope: static review of the Expo Client and Worker screens using the mobile-app-ux-auditor skill. This is not device usability evidence.

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
