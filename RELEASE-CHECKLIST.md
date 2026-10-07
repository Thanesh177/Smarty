# Smarty release checks

Local readiness pass: October 7, 2026. These changes are not deployed, and a
passing frontend build is not a certification of the live backend or mobile apps.

## Repeatable local checks

Run `npm test` for the complete frontend regression suite. Run `npm run check`
to run those tests and build the release files. Do not submit a release with
failing tests. This pass added coverage for safe action confirmation, rejected
deletions, page-error recovery, and deployment-chunk reload protection.

The suite also covers session restoration, account-specific caches, learning
connections, quiz answers and review, news caches, books, drafts, and topic-picker
positioning. The login/API tests use synthetic identities, not live accounts.
All 148 tests passed in this pass, and the release build succeeded.

## Browser checks performed in this pass

- Navigation and search: guest and signed-in fixtures at 320, 390, 834, 844
  (landscape), and 1512 pixel widths. Keyboard focus, Escape, overlay placement,
  menu scrolling, route changes, and search focus were checked.
- News: phone, tablet, and desktop filtering; country and region isolation;
  unavailable briefing fallback; retry; preservation of reports after a failed
  refresh.
- Community: saved-post filtering and bookmark undo; creator filters and request
  approval; stale people-search protection; profile navigation; mobile action
  buttons remaining reachable beside the floating rail.
- Quiz progress: phone, tablet, and desktop review notebooks, saved-question
  removal, and progress calculation.
- Post editor and account deletion: screen-filling layout, stable typing,
  deletion confirmation, failed deletion retaining the account, and duplicate
  submission protection.
- Action confirmation: cancellation, backdrop dismissal, focus trapping,
  navigation cancelling a pending action, rejected deletion retaining content,
  retry, and offline feedback without clearing the account.
- Conversations: the app rail and feed topic picker remain hidden inside an
  active direct message or room chat and return on leaving the conversation.
- Book reader: phone and desktop cached text, section bookmarks, full-text
  search, reading notes, restored progress, failed refresh preserving unsaved
  notes, soft pull-to-refresh, and account isolation.

The built release bundle was separately checked for navigation/search,
confirmation/cancellation, offline feedback, and community actions. These checks
passed without unexpected browser runtime errors.

All browser service responses were fixtures. They test frontend behavior, not
live provider availability, real permissions, or successful server-side writes.

## Required before production submission

- [ ] Install the release build on a real iPhone, iPad, and Android device. Record
  the exact device models, OS versions, and build numbers actually tested.
- [ ] Test email, Google, and Apple sign-in on a fresh install and an update.
  Close and reopen the app immediately, after token expiry, and offline. Only
  explicit logout or server revocation should end a valid remembered session.
- [ ] Test real post, comment, bookmark, message, room, media, report, and block
  operations using dedicated test accounts. Verify failures preserve content
  and prevent false success notices. Never use real users for destructive tests.
- [ ] Verify account deletion removes the account and associated data on the
  server, and does not restore it on reopening.
- [ ] Verify the live server, not just the client, enforces ownership and admin
  authorization; non-admin accounts must not access moderation operations.
- [ ] Verify reporting, blocking, and moderation end-to-end, including immediate
  feed removal and administrator review. Confirm terms, privacy, and support
  links are accessible and accurate.
- [ ] Test denied camera, microphone, photo-library, and notification permissions;
  slow connectivity; reconnecting; interrupted uploads; and broken media URLs.
- [ ] Review generated learning explanations, exam questions, and news briefings
  for accuracy. News must have dated sources and must not fabricate current
  events. Cached material should be labeled when it is not a current edition.
- [ ] Test the deployed staging origin against the real API, OAuth redirects,
  CORS, caching, source providers, and notification delivery.
- [ ] Check dependency vulnerabilities and resolve applicable high-risk issues.
  Measure startup memory and scroll performance on a lower-end physical device.
  Existing bundle/import warnings remain an optimization follow-up.
- [ ] Supply App Review with the requested physical-device recording, actual
  tested-device list, reviewer access instructions, service list, and regional
  behavior. Do not claim device testing that has not occurred.

Deployment, infrastructure changes, native builds, live OAuth/provider tests,
push delivery, store submission, and physical-device verification were not
performed in this pass.
