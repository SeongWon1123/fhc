# FitConnect App Store Readiness

Status date: 2026-06-04

This document tracks iOS, TestFlight, and App Store readiness for `apps/mobile`. It intentionally uses placeholders only. Do not commit Apple account passwords, App Store Connect API private keys, distribution certificates, provisioning profiles, or real signing credentials.

## Current iOS Configuration

- Expo app name: `FitConnect`
- Expo slug: `fitconnect`
- URL scheme: `fitconnect`
- iOS bundle identifier candidate: `kr.fitconnect.app`
- iOS marketing version: `1.0.0`
- iOS build number: `1`
- Android package candidate: `kr.fitconnect.app`
- EAS project ID placeholder: `00000000-0000-0000-0000-000000000000`
- App Store metadata placeholders:
  - Privacy policy URL: `https://example.com/fitconnect/privacy`
  - Support URL: `https://example.com/fitconnect/support`
  - Marketing URL: `https://example.com/fitconnect`
  - SKU: `FITCONNECT-IOS-001`

Before a real TestFlight build, confirm that `kr.fitconnect.app` is the final bundle identifier registered in Apple Developer. Replace the EAS project ID placeholder with the value created by `eas init`.

## Local Commands

Run these from `apps/mobile`.

```powershell
npm run validate:env
npm run typecheck
npm run doctor
npm run build:ios:simulator
npm run build:ios:preview
npm run build:ios:production
npm run submit:ios
```

`build:ios:simulator` creates an unsigned simulator build. `build:ios:preview` is for internal device distribution through EAS-managed Apple credentials. `build:ios:production` is the TestFlight/App Store candidate build.

## Required Placeholder Replacement

- Replace `00000000-0000-0000-0000-000000000000` in `app.json` after `eas init`.
- Replace `REPLACE_WITH_APP_STORE_CONNECT_APP_ID` in `eas.json`.
- Replace `REPLACE_WITH_APPLE_TEAM_ID` in `eas.json`.
- Replace `https://example.com/fitconnect/privacy`, `support`, and `marketing` URLs with live public pages.
- Set EAS environment values for `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_API_URL`, and `EXPO_PUBLIC_BFF_URL`; use `.env.example` only as the local template.
- Confirm the final bundle identifier and App Store SKU before creating the App Store Connect app record.

Use EAS-managed credentials or EAS secrets for sensitive material. Keep `.p8`, `.p12`, `.mobileprovision`, `.key`, `.pem`, and local `.env` files out of the repository and EAS upload context.

## Privacy And Data Notes

FitConnect currently appears to collect or process these categories:

- Contact info: email address and optional profile name.
- Identifiers: Supabase user ID and authentication session identifiers.
- User content: chat messages, meal descriptions, selected meal photo uploads, and booking notes/status.
- Health and fitness: fitness goals, preferred sports, diet logs, calorie/macro estimates, coaching preferences, and workout preferences.
- Photos: selected meal images from the photo library for diet analysis.
- Location: coach/studio location data may be displayed, but the mobile app does not currently request device location.
- Diagnostics/analytics: no production analytics SDK is configured in `apps/mobile` at this time.
- Tracking: no advertising SDK or App Tracking Transparency flow is configured at this time.

App Store privacy nutrition labels should mark collected data as linked to the user where it is stored with the authenticated profile or booking/diet records. If analytics, crash reporting, ads, push notifications, HealthKit, precise location, camera capture, or payment SDKs are added later, update the labels and permissions before submission.

The app requests photo library access for meal image analysis. `app.json` includes `NSPhotoLibraryUsageDescription` and the `expo-image-picker` config plugin permission string. The app does not currently call camera capture APIs.

## TestFlight Checklist

- [ ] Apple Developer Program membership is active.
- [ ] App Store Connect app record exists for the final bundle identifier.
- [ ] Bundle ID, SKU, App Store Connect app ID, Apple team ID, privacy URL, support URL, and marketing URL placeholders are replaced.
- [ ] `eas init` has linked the project and written the real EAS project ID.
- [ ] EAS environment values are set for preview and production.
- [ ] EAS remote iOS credentials are configured or uploaded through EAS, not committed.
- [ ] `npm run validate:env` passes against local or CI environment values.
- [ ] `npm run typecheck` passes.
- [ ] `npm run doctor` passes or documented warnings are accepted.
- [ ] `npm run build:ios:simulator` opens on an iOS Simulator for a smoke test.
- [ ] `npm run build:ios:preview` installs on internal test devices.
- [ ] Login/sign-up, onboarding, coach list/detail, booking, diet chat, meal image upload, diet logs, clothing recommendations, and profile/logout are smoke tested.
- [ ] Production API/Supabase endpoints are reachable from a physical iOS device.
- [ ] App icons and splash assets are reviewed at production sizes.
- [ ] Export compliance answer matches the final encryption posture. Current config declares no non-exempt encryption.
- [ ] App Review demo account is prepared if reviewers cannot self-register.
- [ ] Screenshots are captured for required iPhone sizes.
- [ ] Age rating questionnaire is completed based on health/fitness and user-generated meal/photo content.
- [ ] App Privacy labels are completed from the data notes above.
- [ ] TestFlight external testing notes explain the MVP flow and any backend limitations.

## App Store Submission Checklist

- [ ] Production build number is higher than every previous TestFlight build.
- [ ] `npm run build:ios:production` completed successfully.
- [ ] `npm run submit:ios` uploaded the selected build to App Store Connect.
- [ ] App Store title, subtitle, description, keywords, category, support URL, privacy URL, screenshots, and review notes are complete.
- [ ] Sign-in/demo credentials are provided in App Review notes if needed.
- [ ] Any third-party SDK privacy manifests are present in the generated native project during EAS build.
- [ ] No local `.env`, Apple credential files, certificates, provisioning profiles, or API private keys are committed or uploaded.

## References

- Expo EAS `eas.json`: https://docs.expo.dev/build/eas-json/
- Expo app config: https://docs.expo.dev/versions/latest/config/app/
- Expo ImagePicker permissions: https://docs.expo.dev/versions/latest/sdk/imagepicker/
