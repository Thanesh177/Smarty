# Authentication hardening - October 13, 2026

## Implemented locally

- Sign-in, registration and confirmation share a restrained dark, responsive
  layout with underline navigation, readable 16px inputs, keyboard focus,
  reduced-motion support, and space for the floating navigation rail.
- Duplicate submissions are guarded synchronously. Mode changes are disabled
  while requests are pending, and late component responses cannot navigate away
  from the page the user selected. Server calls have bounded waiting states.
- Successful email confirmation remains successful even if automatic sign-in
  fails. Users can continue to sign-in with their verified email prefilled;
  passwords/codes are cleared rather than persisted by the registration form.
- Unnecessary email-existence lookup removed. Login errors do not disclose
  account existence or display raw provider/configuration details.
- Verification/resend validation, cooldown cleanup, recovery, password limits,
  required challenge attributes and manual authenticator setup are supported.
- Password challenges preserve whitespace. Logout invalidates in-flight email
  and challenge completion; late success cannot restore the logged-out account.
- Internal return paths are shared, sanitized and independent of optional
  redirect-storage availability. Native PKCE/nonce and durable restoration remain.
- Social login recovers its busy state when restored by browser back-cache.

## Approved live changes

The existing Cognito pool allowed six-character passwords and the public app
client had five-day refresh sessions. The user explicitly approved changing new
password requirements and extending refresh validity without revoking sessions.

Live policy now requires a minimum of 10 characters with uppercase, lowercase and
a number. The existing symbols policy, temporary-password lifetime, verification,
recovery, MFA settings, triggers and other writable pool settings were preserved.
Existing passwords were not changed, and no password reset was forced.

The same app client now issues refresh sessions valid for 365 days. API token
lifetimes, revocation, Google/Apple providers, authorization-code flows, attributes,
callbacks and all other writable client settings were preserved and compared after
the update. No credentials or provider secret were read or changed.

This applies to newly issued refresh tokens, not retroactively to tokens issued
with the former five-day expiry. Expiry, revocation, account deletion and explicit
logout can still require sign-in. A one-year refresh lifetime is not an unlimited
or irrevocable session.

`auth-production-settings.cjs` records the desired values and performs a read/merge
update of the existing resources. These auth resources are outside this repository's
Gen2/backend resource definitions; no replacement pool/client or unrelated stack
deployment was introduced. Run it without `--apply` for a read-only plan. Cognito
resets omitted update parameters to defaults, so the script projects/preserves all
supported writable settings and verifies snapshots before and after updates.

Original rollback snapshots (non-secret settings, protected files) are in:
`/var/folders/rv/nkk9f0w10q1bbz722lph7rvr0000gn/T/smarty-auth-settings-20261013-M14t7T`.
The subsequent successful client update has an additional snapshot in:
`/var/folders/rv/nkk9f0w10q1bbz722lph7rvr0000gn/T/smarty-auth-settings-20261013-8YuHWl`.
The first update succeeded at the service but its empty response initially caused
the release script to stop parsing; the policy was read back before completing
the client update. No blind retries or resource replacement were used.

## Verification and release boundary

- 260 automated frontend tests pass, including native restart/offline restoration,
  duplicate callbacks, first email sign-in, logout races and identity isolation.
- Production build passes. Existing mixed-import/large-chunk warnings remain.
- Synthetic browser flows at 320, 390, 834 and 1512px cover validation, duplicate
  guards, security challenges, recovery, terms consent, verification/sign-in
  failure recovery, field sizing, overflow and reduced motion.
- Live native authorization checks for Google and Apple returned HTTP 302 to
  their expected provider hosts. No credentials were entered or accounts created.
- The local OAuth preview is `http://127.0.0.1:5173/login`. Port 5175 is not an
  approved Cognito web callback; do not test browser OAuth on that preview port.
- Website/interface code remains local. Only the explicitly approved settings
  are live. This task did not update installed native builds or deploy the website.

Before releasing the interface changes, complete a physical iPhone/iPad and Android
check: fresh email signup/verification, recovery, Google/Apple first sign-in,
cancel/retry, background/force-close/reopen, offline reconnect and explicit logout.
Do not uninstall or clear device data when checking existing session preservation.

References:
- https://docs.aws.amazon.com/cognito-user-identity-pools/latest/APIReference/API_UpdateUserPool.html
- https://docs.aws.amazon.com/cognito-user-identity-pools/latest/APIReference/API_UpdateUserPoolClient.html
