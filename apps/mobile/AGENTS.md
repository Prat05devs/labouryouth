# Labour Youth mobile guidance
Follow the repository-root AGENTS.md and governing docs first. This Expo Router app uses `app/` for routes and `src/` for shared UI, API, session and locale code. It is one app with Client and Worker modes; do not create separate apps or demo-only navigation.

Use the installed Expo SDK-compatible APIs and verify changes with the project typecheck, Expo Doctor and an iOS export. Request foreground location only when the action needs it. Keep onboarding resumable, worker actions clear and singular, errors keyed by stable API codes, and all user-facing copy in en/hi locale files. Review docs/MOBILE_UX_AUDIT.md and complete device accessibility checks before release.
