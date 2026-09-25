# Saved-login restoration fix

## Changes

- Native Google/Apple restoration now uses the saved refresh session even when the separate UI profile cache is missing. It rebuilds the profile only from the validated refresh response, without falling through to an unrelated Amplify account.
- Email users reopening offline retain the remembered account view and renew on reconnect. Expired tokens remain expired and cannot authorize API requests. Confirmed revocation still clears the account.
- Concurrent renewal requests share one operation, including forced refresh calls, to avoid competing refreshes.
- Amplify email/web sign-out events no longer erase the independent native Google/Apple refresh session, including during startup refresh. Explicit app logout still clears both stores.
- Refresh responses check session ownership before handling errors. A delayed failure from an older account cannot clear a newer login; new logins do not reuse an old account's pending refresh.
- Service configuration and network failures preserve the native refresh record. Confirmed revocation and identity mismatches invalidate it.
- Returning to the foreground or reconnecting retries native session restoration. Requests still require current tokens; an expired access token is not made valid by keeping the UI session.
- The iOS wrapper already uses WebKit's persistent website store. No native source changes are required for this patch.

## Verification and release

Run `npm run test:auth` and the production build. Tests use synthetic sessions only; no real credentials or private browser storage are accessed.

Deploy the updated web build through the existing release process. This checkout does not update the live app automatically. A session already erased by an older version cannot be recovered: sign in once after deployment.

On a physical iPhone and iPad, verify email, Google, and Apple separately: sign in; close and relaunch; background and resume after access-token expiry; reopen offline, then reconnect; explicitly log out and relaunch. Confirm the same account is restored and logout remains effective. Check revocation with a dedicated test account. Physical-device/provider verification is still required before release.

For the underlying SDK's refresh and storage behavior, see [Amplify session management](https://docs.amplify.aws/gen1/react/build-a-backend/auth/manage-user-session/). Refresh sessions have provider-defined expiry and can be revoked; this fix does not bypass either condition.
