# Private push delivery

This package updates the existing `sendmsg` Lambda in us-east-1. It keeps the legacy `{userId,title,body,data}` invocation contract and its already-installed provider credential. No service-account file, APNs private key, or device registration belongs in this repository or logs.

The sender is private: HTTP-style events are rejected. Trusted IAM backend functions may invoke it. The Firebase project is `smarty-c17cf`; the iOS bundle is `thanesh.smarty`. Native initialization deliberately excludes Firebase Authentication so the existing login/session bridge remains unchanged.

News calls include a notification ID and the private table name. IAM limits access to that exact table. The sender checks consent and previews again and stores opaque per-device delivery receipts. Only a structured FCM UNREGISTERED error removes a registration; invalid payloads and provider authentication failures do not delete valid devices. An internal `targetPlatform: "ios"` option narrows a controlled test to iOS devices, never a broadcast.

Run `npm ci --ignore-scripts` and `npm test` here. Package only `index.mjs`, `message.mjs`, dependencies and the manifest. Preserve the existing Lambda environment; do not copy credentials into deployment parameters. The pre-change opaque rollback archive is `/private/tmp/smarty-push-audit.knhH4s/sendmsg.zip` on the development machine, not in Git.

## iPhone acceptance

The native project is `/Users/thaneshn/Documents/smarty`. It contains FirebaseCore/FirebaseMessaging, an explicit APNs mapping, notification capability, consent-time registration and an origin-checked bridge. Remote alerts share the local-reminder delegate. Cold-start taps wait for authenticated web listeners. Registration changes are uploaded through the existing JWT-protected endpoint. Logout/account switches invalidate the previous Firebase registration; do not uninstall to test an update.

Verify on a physical device: permission grant/deny, authenticated registration, background arrival, tap to story, cold-start arrival/tap, logout, account switching, quiet time and disabled news consent. Confirm both development and production APNs configuration before TestFlight/App Store distribution. No new TestFlight or App Store build is submitted by installing a development build on the connected phone.
