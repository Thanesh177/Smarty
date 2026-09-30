# Saved-login restoration fix

## September 29 follow-up: reopening the mobile app

The reported failure affects Google, Apple and email sign-in, not just one provider.

- Reproduced an immediate logged-out screen when a native app reopens an already-consumed OAuth callback, even with a valid saved account. Startup now redeems only the pending attempt's matching state; an old callback instead restores the saved account. Tests cover both current and expired saved tokens and replayed provider errors.
- Leftover OAuth-attempt state no longer blocks a durable native account's renewal, including foreground recovery. A new login still invalidates previous operations; logout and revocation still clear the session.
- Added `src/bootstrap.js` as the HTML entry. Device-session restoration now finishes **before importing the app and authentication SDK**, not merely before rendering React. An unavailable device store stops startup safely without initializing an empty auth session. This applies to social and email session records alike.
- Updated the separate Android project at `/Users/thaneshn/AndroidStudioProjects/SmartyApp`: returning launches open the feed; callbacks are consumed and delivered in-page when possible; callback URLs are no longer logged. Native detection uses the `SmartyAndroid` user agent. Public-domain/relative app links are mapped onto the existing origin to preserve installed users' web storage. Notification targets are restricted to app destinations, and push data is injected only into the app origin rather than exposing a native interface to every frame.
- The Android origin is intentionally unchanged. Both it and `https://smarty.wiki` were checked and served `index-CCkiUA9X.js`, including the prior persistence fix, before these edits. Therefore an outdated web deployment did not explain the report.

Local verification: 60 authentication/bootstrap/storage tests pass; Android debug build and 5 JVM tests pass. The web production build succeeds. An isolated production-build browser test covers Google and Apple button flows, session persistence, reopening consumed callbacks with both iOS-device-store and Android-web-storage fixtures, and logout followed by relaunch. The real Amplify email SDK also restores synthetic persisted email records on two fresh browser launches. All network traffic in this test is intercepted; no real provider sign-ins or physical-device storage are exercised. No iOS native files were changed in this follow-up. These checks do not prove the exact failure on the user's physical device.

Release this follow-up by deploying **the whole new web build**, including the new bootstrap entry and its dynamically loaded app assets, to both app origins. Rebuild and distribute Android separately for its wrapper changes. An iOS app that already contains the Keychain bridge does not need another native rebuild for this web-only follow-up. Do not uninstall or clear app data when testing an update. Nothing in this local work deploys or updates an installed app automatically.

Acceptance test on each physical platform: Google, Apple where supported, and email separately; sign in; force-close and reopen immediately three times; open Profile/Chat to confirm the same account; repeat after an hour and offline/reconnect; sign out explicitly and confirm reopening stays signed out. Provider expiry/revocation can still legitimately require sign-in. If a failure remains, capture the method, app build, launch URL without callback query parameters, and whether restoration failed before or after the loader. Do not capture tokens or authorization codes.

## Changes

- Native Google/Apple restoration now uses the saved refresh session even when the separate UI profile cache is missing. It rebuilds the profile only from the validated refresh response, without falling through to an unrelated Amplify account.
- Email users reopening offline retain the remembered account view and renew on reconnect. Expired tokens remain expired and cannot authorize API requests. Confirmed revocation still clears the account.
- Concurrent renewal requests share one operation, including forced refresh calls, to avoid competing refreshes.
- Amplify email/web sign-out events no longer erase the independent native Google/Apple refresh session, including during startup refresh. Explicit app logout still clears both stores.
- Refresh responses check session ownership before handling errors. A delayed failure from an older account cannot clear a newer login; new logins do not reuse an old account's pending refresh.
- Service configuration and network failures preserve the native refresh record. Confirmed revocation and identity mismatches invalidate it.
- Returning to the foreground or reconnecting retries native session restoration. Requests still require current tokens; an expired access token is not made valid by keeping the UI session.
- The iOS wrapper now adds an origin-checked, main-frame-only Keychain bridge alongside WebKit's persistent store. It stores only allowlisted session records, separately per installation and origin, with device-only protection. Keychain work is serialized off the UI thread.
- Web startup restores that record before rendering authenticated routes. Existing web sessions migrate automatically. Google/Apple refresh records and Amplify email session/device records are covered. Temporary Keychain failures stop startup with a reload option instead of erasing the saved login.
- Login waits for durable writes; logout and account deletion wait before navigating away. An empty device record represents logout and overrides stale web data. No user passwords, content caches, or pending OAuth/PKCE attempts are mirrored.

## Verification and release

Run `npm run test:auth` and the production build. Tests use synthetic sessions only; no real credentials or private browser storage are accessed.

Local verification: 53 automated authentication/storage tests pass; the web production build and unsigned iOS Simulator build compile successfully. Isolated production-build browser checks cover fresh web processes, device-store read failure, logout write failure/retry, and remaining signed out on relaunch. The browser bridge is a synthetic fixture, not a physical-device Keychain test.

Deploy the updated web build through the existing release process **and build/distribute the updated iOS app** containing `Authentication/NativeSessionStore.swift`. Both parts are required for device-backed persistence. Either release order is compatible: older wrappers/browsers keep their existing web-storage behavior. This checkout does not update installed apps automatically. A session already erased by an older version cannot be recovered: sign in once after updating.

The public `smarty.wiki` build was checked on September 28, 2026 and already contained the earlier web-only restoration fixes. This change addresses the remaining web-storage dependency; the exact cause on the reported physical device has not been directly observed.

On a physical iPhone and iPad, verify email, Google, and Apple separately: update the existing app without uninstalling; sign in; force-close and relaunch; background and resume after access-token expiry; reopen offline, then reconnect; explicitly log out and relaunch. Confirm the same account is restored and logout remains effective. Also test fresh installation, account deletion, and revocation with dedicated test accounts. Physical-device/provider verification is still required before release.

Native implementation references: [WebKit reply-capable message handler](https://developer.apple.com/documentation/webkit/wkscriptmessagehandlerwithreply), [device-only Keychain accessibility](https://developer.apple.com/documentation/security/ksecattraccessibleafterfirstunlockthisdeviceonly).

For the underlying SDK's refresh and storage behavior, see [Amplify session management](https://docs.amplify.aws/gen1/react/build-a-backend/auth/manage-user-session/). Refresh sessions have provider-defined expiry and can be revoked; this fix does not bypass either condition.
