# News pages production check - October 13, 2026

## Interface changes

- Authentication screens have no app navigation or search overlay. Login,
  registration, verification, trailing-slash aliases and OAuth completion are
  covered. Authentication spacing is symmetric again without a reserved rail.
- Newsroom, feed briefing and story timelines retain app navigation, sources,
  place choice, search, saving, sharing, following, filtering and larger text.
- A valid same-day briefing stays readable while refreshed reports/summary arrive.
  Prior-day briefings are not blended into new reports. Summary-only cached
  responses remain usable; malformed/future-dated cache entries are rejected.
- Saved reports are normalized, bounded and isolated by account. Rapid toggles use
  the latest saved state. Storage failures are honestly labelled session-only.
- Personalized follow/update responses are normalized before cards/notifications
  use them. Duplicate IDs/subjects, broken fields and oversized lists are filtered.
  Mutation invalidation stays tied to the account that started the action.
- Follow/place actions use synchronous duplicate guards. Failed preference loading
  offers a reconnect step rather than blindly toggling an unknown followed state.
  Late status responses cannot overwrite a newly selected account/story.
- Timeline Refresh bypasses the browser read cache but still reuses shared server
  caches. Failed refresh keeps saved coverage. Query changes cancel stale UI writes.
  Cached/new timeline data is normalized, subject-checked and rejects credentialed
  or unsafe report links. Empty archives stay labelled incomplete, not false history.
- Timeline typography and bottom padding are more compact. No claim of independent
  fact verification is attached to missing sectors or source-grounded AI summaries.

## Checks

- 267 frontend tests passed; production build passed.
- 42 public News backend and 19 personalization/push tests passed.
- Browser checks at 320, 390, 834 and 1512px passed for authentication without
  navigation, newsroom/feed loading, summary merging, search, save, follow retry,
  location choice, malformed saved-data recovery, saved-report account isolation,
  timeline pagination/filtering, manual refresh, failed-refresh
  saved coverage, retry, date controls, stale-query races, overflow and reduced motion.
- Live public reports: HTTP 200, 60 reports, 1.35 seconds.
- Live briefing: HTTP 200, editorial summary, 1.06 seconds.
- Live example story timeline: HTTP 200, 98 reports, 1.26 seconds.
- Anonymous private-personalization access returned HTTP 401. No private records,
  credentials or real account actions were used in the checks.

## Release boundary

These interface changes are local; no website/native release, infrastructure
mutation, user-data deletion or automatic schedule activation occurred in this task.
The public News backend was already deployed in the earlier approved release.

Automatic story checking and push dispatch remain documented as disabled pending
physical-device acceptance. Followed subjects/timelines can be saved/read now,
but automatic notification delivery is not claimed as production-complete. Complete
device acceptance and obtain activation approval before enabling those schedules.
