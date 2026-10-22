# Public account and data deletion resources

Date: October 22, 2026

## Play Console URLs

- Account and associated-data deletion: `https://smarty.wiki/delete-account.html`
- Selected-data deletion while keeping the account: `https://smarty.wiki/delete-data.html`

Use these exact HTTPS URLs in the Data safety declaration after verifying the live deployment. Existing short paths `/delete-account`, `/account-deletion`, `/delete-data` and `/data-deletion` have public SPA fallbacks as well.

## Implementation

The Vite build emits two real HTML files with inline styling, readable without JavaScript, app installation, sign-in or API access. A shared repository-authored content module also powers the SPA fallbacks; those bypass authentication providers and the app opening screen. Support and Privacy link to both resources.

The request mechanism is email to the existing support address, `ntthanesh@gmail.com`. The button opens a pre-filled email draft; the page explicitly states that the user must send it and provides the address as a fallback. There is no fake form submission or automatic deletion triggered by visiting a link. Ownership must be verified before processing.

The app owner approved a completion commitment of **within 14 days after ownership verification**. Monitor the mailbox, process requests, confirm completion, and explain any limited retention, its reason and applicable retention period or deletion date. Do not ask users to send passwords or sign-in codes.

Both pages explain deletion scope, shared-record limits and independently saved/device-local copies. They distinguish Smarty account deletion from Google/Apple account deletion and offer an email route for users unable to sign in. The existing in-app Profile deletion flow is preserved.

## Validation

- Seven new tests cover public routes, email draft details, scope, standalone generation, middleware and auth-independent fallbacks.
- Full frontend suite: **297 passed, zero failed**.
- Production build passed and emitted both standalone HTML files.
- Local browser checks confirmed headings, readable styling, request links and complete selected-data instructions.
- No real user account or data was deleted to test this change.

Before resubmitting, update both fields in Play Console under **App content → Data safety → Data deletion** and open each link while signed out. Website publishing does not update the Play Console declaration automatically.

Policy reference: https://support.google.com/googleplay/android-developer/answer/13327111
