# Notifications, daily reminders, and faster reads

## For users

Open the navigation menu, choose Notifications, and turn on **A moment to learn**.
Choose a local time and save. On the updated iPhone/iPad app, select **Enable
device** and approve the system permission to allow a reminder while Smarty is
closed. Turning off learning notifications, the master switch, or the daily
reminder cancels the local schedule after saving. Logout cancels it too.

Quiet hours move a daily reminder to the end of the quiet period. All-day quiet
hours pause reminders. A reminder opens My learning; reminders shown inside the
app highlight lessons due for review when there are any. Ordinary browser and
older-wrapper reminders operate only while Smarty is open. There is no claim of
background browser or Android reminder scheduling.

Device permission and push registration are different: permission being granted
does not prove remote delivery. The settings page reports a failed browser push
setup and offers reconnect rather than falsely claiming success.

## Reusable implementation

- `public/notification-policy.js`: one dependency-free delivery, category,
  privacy, quiet-hour, and safe-link policy shared by the app and Firebase worker.
- `src/lib/notificationPreferences.js`: bounded account-specific preference
  cache, activation/logout behavior, worker synchronization without waiting for
  an uninstalled worker, and bounded alert deduplication without per-alert timers.
- `src/hooks/useDailyReminder.js`: one foreground timer plus visibility events,
  rather than continuous polling. Device configuration waits for authentication
  restoration so reopening does not cancel an existing account's reminder.
- The iOS WebView model schedules one repeating local calendar notification,
  replacing rather than accumulating schedules. It does not modify login storage.
  Native requests are restricted to the trusted main-frame app origins.
- `src/lib/requestCache.js`: bounded least-recently-used cache; shared pending
  reads; independent cancellation for each reader; expiry; explicit refresh and
  invalidation; failed requests are never cached. News reuses it with an
  edition-aware freshness policy.

## Cache boundaries

| Read | Lifetime | Isolation |
| --- | --- | --- |
| Public book metadata | 15 minutes, at most 24 entries | Public data only |
| News story timeline | 1 minute for recent; 5 minutes for dated reports, at most 16 entries | Story, year, and month |
| News briefing | Existing 15-minute editorial / 1-minute fallback policy | Location and edition |
| Chat list and feed pages | Concurrent requests only; no retained result | Cleared on authentication change; feed parameters distinguish pages/topics |
| Notification preferences | At most eight account entries; re-read stored value on access | Account-scoped; anonymous delivery disabled |
| Alert deduplication | 60 seconds, at most 128 IDs | Reset on account change |

Pull-to-refresh invalidates the reusable read caches. No messages, mutations,
quiz attempts, private notes, or shelves are placed in the public caches. These
changes reduce duplicate requests; they do not add a new database or pretend
client caching replaces the existing server-side AI persistence.

## Verification and release limits

The regression suite includes preference normalization, account switching,
blocked storage, quiet hours, reminder opt-in and daily claims, native request
coalescing, worker privacy/click behavior, badge sanitization, request sharing,
cancellation, expiry, invalidation, and failure retries. Browser checks use
synthetic accounts and provider responses, not production users.

The iOS wrapper compiles in Debug and Release locally without signing. Release still requires the
updated website and iOS binary plus physical-device reminder tests. The local
`daily-reminder-lambda/index.mjs` is empty; no remote reminder job was configured,
deployed, or invoked. No credentials were retrieved and no broadcast was sent.
The Android wrapper source was not available in these repositories.

FCM automatically displays notification-bearing background payloads. The worker
avoids adding a second banner, but server-side privacy and opt-out checks remain
essential. Use data-only web pushes when the worker must apply preferences;
include the intended `userId` so stale account deliveries can be rejected. Verify
remote registration ownership and logout cleanup on the live server separately.

References: [Firebase message handling](https://firebase.google.com/docs/cloud-messaging/web/receive-messages),
[Apple local calendar reminders](https://developer.apple.com/documentation/usernotifications/uncalendarnotificationtrigger),
and [service-worker readiness](https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerContainer/ready).
