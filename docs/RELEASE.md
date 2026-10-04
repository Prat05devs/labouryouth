# Release runbook
## Environment gates
Production PostgreSQL/PostGIS with backups, separate runtime/migration credentials, private durable object storage, HTTPS API/web origins, email reset sender, strong signing secrets, configured service area/rate/verification policy, first SUPER_ADMIN provisioned outside public registration, request logs redacted, monitoring and restore procedure. No default credentials or public document buckets.
Owner supplies official contact/support/Instagram, reviewed About/Privacy/Terms/Worker Policy, Expo project UUID/owner, Apple bundle ID/team/App Store Connect app ID and signing access, Android package ID and store/testing URLs. Do not invent values. Apple/EAS credentials remain with account tooling, never `.env.example`.

## Local validation
Install locks; migrate clean PostGIS; seed twice (idempotent); run API integration/security/concurrency suite; web build/typecheck; mobile typecheck and Expo diagnostics/export. Verify real device against HTTPS staging. Seed only catalog/locations; test identities are fixtures confined to isolated test database. Create admin via operator command with password prompt, not committed password.

## iOS pipeline
Use EAS profile `production` with `distribution: store` for TestFlight, not ad-hoc internal distribution. Configure stable bundle identifier and EAS project, version/build-number increment, foreground location purpose string, private photo/document access explanations and iOS privacy declarations. No background location mode. Use a currently supported EAS Xcode image compatible with App Store requirements.
```sh
cd apps/mobile
npx expo-doctor
npx expo export --platform ios
npx eas-cli build --platform ios --profile production
npx eas-cli submit --platform ios --profile production
```
A JS export is not a signed iOS build. A successful upload is not proof TestFlight processing/review completed. Record build/submission IDs and physical-device acceptance separately. Verify login/logout/reset, both roles/onboarding, upload, offer/assignment, location denial/manual path, completion, account deletion and app foreground/background restoration on device.

Official references checked 1 October 2026:
- https://docs.expo.dev/tutorial/eas/ios-production-build/
- https://docs.expo.dev/build/setup/
- https://docs.expo.dev/eas/json/
- https://nextjs.org/docs/app/getting-started/installation

## Local Xcode and Android builds (Decision 22)
App identifier `in.labouryouth.app` on both platforms. Every release command runs with `LY_RELEASE=1` and `EXPO_PUBLIC_API_URL=https://<deployed-api>/api/v1`; the config refuses to build otherwise.
```sh
cd apps/mobile
export LY_RELEASE=1 EXPO_PUBLIC_API_URL=https://<deployed-api>/api/v1
npx expo prebuild --clean            # generates ios/ and android/ (both git-ignored)
# iOS: open ios/LabourYouth.xcworkspace, set Team and signing, Product > Archive, Distribute App > TestFlight
# Android (SDK at ~/Library/Android/sdk, JDK 17):
export ANDROID_HOME=$HOME/Library/Android/sdk
keytool -genkeypair -v -keystore ~/labouryouth-upload.jks -alias upload -keyalg RSA -keysize 2048 -validity 10000   # once; keep outside Git, back it up
cd android && ./gradlew assembleRelease bundleRelease   # app-release.apk and app-release.aab
```
Configure the upload keystore in `android/gradle.properties` (local, untracked) before the release tasks. Play App Signing holds the app signing key; losing the upload key needs a Play support reset.

## Smart link and rollback
Permanent `/app`: configured iOS TestFlight/App Store target and Android store/testing target; desktop shows available choices. Validate URLs against configured allowlist, never arbitrary user redirect input. If links are unconfigured show honest unavailable state, not a fabricated download.
Deploy backward-compatible migrations before compatible API/mobile. Back up first; irreversible migration rollback requires restore plan. Mobile cannot be instantly recalled: retain API compatibility, use feature flags and server-enforced safety checks. Record build version/schema revision and roll back web/API only when schema compatibility is proven.
