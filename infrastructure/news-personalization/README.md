# Personalized news release

Status on 2026-10-13: the private service is deployed as `smarty-news-personalization` in us-east-1. The existing `sendmsg` sender was updated without reading or replacing its credentials. Both automatic schedules remain DISABLED pending physical-device acceptance. The public news cache changes in `smarty-terraform/lambda-src/news` remain a separate, not-yet-deployed release.

The first stack creation rolled back because the account cannot allocate the requested Lambda concurrency reservations. Its empty retained database was preserved and reused: `smarty-news-personalization-PersonalNews-1D99P96M3SWDZ`. The approved retry uses conditional 180-second database leases for one active checker/dispatcher at a time, plus per-alert and per-device delivery receipts. No existing function's concurrency was reduced. Retained logs from the rollback remain available for diagnosis.

Live web hosting is `d3qiuefonbp8n9`, branch `main`, in **us-east-2**, attached to `smarty.wiki` and used by the older Android origin. Do not confuse it with the separate us-east-1 staging/production hosting app.

## User flow

- The newsroom and News feed load on demand. Cold requests show original reports first, then the daily AI briefing. Reopening uses the device cache while a stale edition refreshes. Offscreen cards use browser rendering containment; report lists retain existing incremental pagination.
- First news visit asks where the user wants the daily briefing from. Country and optional region are selected explicitly, without GPS permissions. World and the selected place remain switchable. Choices are account-scoped on device and written to the private service. A new device can restore the server choice; an existing device keeps its explicit local choice if sync fails. The UI says when only device storage succeeded.
- Individual reports and story timelines offer **Follow updates**. A follow is a favorite subject saved to the account in DynamoDB, separate from legacy device-only saved articles/timeline reading history. Following requires login and a successful server response. Up to 50 subjects can be followed; remove them from the updates shelf or timeline.
- A bounded scheduled checker reads recent timeline reports through the existing public news service, reusing its shared database cache. It excludes pre-follow, undated, future, unsafe and weakly matched reports. New reporting is stored as account-private updates, with an atomic checkpoint so retries do not duplicate alerts or resurrect unfollowed stories.
- While the signed-in app is open, one visibility-aware two-minute query refreshes the update shelf and emits a standard in-app notification. Existing category, preview and quiet-hour policy still applies. Notifications rejected by that policy remain in the unread shelf. Opening an update marks it read in the database.
- A durable outbox connects alerts to the existing private FCM sender. It requires explicit account-level news consent, rechecks the active follow revision, skips opened/old updates and defers quiet hours in the user's timezone. Failed deliveries retry with backoff, then place record keys only in an encrypted failure queue. Per-device receipts reduce duplicate delivery during partial retries; delivery is at-least-once, not exactly-once. APNs alerts are used for iOS; web/Android retain data-only messages to avoid duplicate automatic notifications. OS delivery still requires a compatible native build, notification permission, a registered device and verified APNs configuration. Provider acceptance is not proof that the user saw a notification.
- Updates expire after 90 days. Preference and follow records do not expire while the account exists. `DELETE /news/personal` erases private news data; account deletion calls it before revoking the identity. The old deployment path tolerates missing-service 404/405 only; a deployed service must confirm deletion.

## Shared news storage

The existing `DailyNews` table stores public reports per date and location under a separate `#reports` key. `GET /latest?view=reports` does no AI work. Full briefings reuse these reports and a separate daily edition cache. Both world and regional editorial summaries are generated once per UTC day and location, then reused for different users. Source/model failures have short fallback freshness and retry; cache/lease failures do not generate unsaved per-user summaries. The existing `generation_cache.py` must remain in the news release package.

## Private service

`template.yaml` adds or reuses an on-demand encrypted DynamoDB table, three small functions, authenticated routes, two schedulers, retained 30-day logs, alarms and encrypted dead-letter queues. Stateful data is retained if the stack is removed, but the account-deletion endpoint explicitly removes a user's records. Both schedules start **DISABLED** for deployment verification. `ExistingPersonalNewsTableName` supports recovery without replacing retained data; verify both required indexes before using it.

Existing HTTP API and JWT authorizer IDs are parameters. Identity is derived only from verified authorizer `sub`; body user IDs are never trusted. All personal responses are `private, no-store`. The public news cache contains no identity, follow list or reading history.

HTTP routes:

| Route | Purpose |
| --- | --- |
| GET /news/personal | Account choice, followed subjects and latest 30 updates |
| PUT /news/preferences | Save a briefing place and world/local mode |
| PUT /news/push-preferences | Save news consent, previews, timezone and quiet hours |
| POST /news/follows | Idempotent follow/unfollow or acknowledge an update |
| DELETE /news/personal | Erase private news records before account deletion |

## Rollout

1. Retest news, personalization, frontend and build. Package only the news handler plus shared generation cache using the existing release workflow. Deploy the public news change before the frontend; an old server ignores `view=reports` and still waits for the full summary.
2. Build/package/deploy this SAM stack through the normal infrastructure release process. Supply the actual existing API ID, JWT authorizer ID, HTTPS `/latest` endpoint and origin. Inspect the change set before executing. Do not deploy unrelated Terraform imports or replace the existing news/database resources.
3. Verify two real accounts cannot read/acknowledge/delete each other's records, one follow/unfollow cycle, the 50-subject limit, preferences on a second device and confirmed deletion.
4. Invoke the worker with a controlled follow and a newly dated report. Check a durable alert/checkpoint, repeated-run deduplication and an unfollow racing a worker. Enable `WorkerState=ENABLED` only after this succeeds. Verify the failure queue, scheduler permission and alarm monitoring.
5. Deploy the frontend. Check reports-before-summary, same-day cross-user cache hits, first-visit choice, local/world switches, server failure/device fallback, quiet hours, alert acknowledgement and logout/account isolation on physical iOS/Android devices.

The story-check schedule runs every 15 minutes; push dispatch runs every five minutes once explicitly enabled. A database-lease-protected worker processes at most 25 follows and eight distinct public queries per invocation, checkpoints its cursor and resumes later. This limits provider load and spend, but alert delay increases with the number of followed subjects. Measure backlog before increasing frequency; for larger usage, shard the active index and fan out through a queue. This implementation does not promise instant alerts or zero AWS cost.

## Verification

- Pure frontend and backend tests use fixtures, not AWS integration mocks presented as live verification.
- CloudFormation schema validation is run with `cfn-lint` in an approved temporary environment. IAM changes, scheduler execution, live storage and device tests still require release verification.
- Local results: 232 frontend tests, 39 news-cache/timeline tests and nine personal-news tests passed. Fixture browser checks at 320, 390, 834 and 1512 pixels covered staged loading while the summary request was held, restored local/world choices, failed follow/retry, stored updates, notification display, unfollow and device-only preference fallback. The web build passed and cfn-lint returned no errors, warnings or informational findings.
- The scheduled source is [SAM ScheduleV2](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/sam-property-function-schedulev2.html). Atomic alert/checkpoint writes follow [DynamoDB transactions](https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_TransactWriteItems.html).
