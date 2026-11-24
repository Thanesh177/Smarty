# Background word meanings

This service is an additive release, not a change to Smarty's existing posting
schedule. It creates separate Lambda functions, queues, logs, IAM roles and
alarms; model calls are billable. Deployment and a controlled live smoke test
require approval before enabling the feature in production.

## Release checks - 2026-11-24

The approved release uses stack `smarty-post-vocabulary-production` in
`us-east-1`, with the existing JWT-protected HTTP API. The production route
input is saved in `environment/prod/post-vocabulary.auto.tfvars` so later plans
do not inadvertently remove the new integration.

- 553 frontend tests, 217 backend tests, a fresh production build and the
  startup speed budget passed.
- CloudFormation schema and change-set validation passed. Queue transport
  policies must target one queue per statement; each queue has its own policy.
- 24 live IAM simulation scenarios (45 action/resource assertions) passed,
  including negative ownership-scope, queue and model-profile permission cases.
- An isolated synthetic post completed one real model attempt and saved seven
  meanings. Cached GET/POST and duplicate worker delivery reused that result.
  Source edits and moderation correctly prevented stale or hidden results.
- Unsigned HTTP requests to the production glossary route returned 401.
- Existing feed/single-post index projections preserve the glossary. Writer
  and reader startup probes passed without publishing a test post.
- Model invocation text logging was not configured. No user posts were used
  in the live model test, and no automatic historical backfill was performed.

CloudFormation Guard was explicitly skipped by the operator. Physical-device
testing of this feature and live failure/DLQ redrive drills were not performed;
local failure-handling tests are not a claim that those device/drill checks ran.
The existing state table has TTL disabled. Hourly budget items contain an
`expiresAt` cleanup hint but are retained until a separately approved cleanup
policy is configured; no global TTL setting was changed in this release.

## Behaviour and limits

- `POST /posts/glossary` accepts `{postId}` under the existing JWT authorizer.
  The API reads the saved post, checks unambiguous author ownership and content
  availability, and sends only `postId`, `sourceHash`, and `authorId` to SQS.
  It returns 202 only after durable enqueue or proof of existing queued work.
  A producer's temporary enqueue lease is not treated as durable acceptance.
- `GET /posts/glossary?postId=...` is an author-only, read-only status request.
  It returns ready with saved meanings, preparing, or unavailable. It never
  enqueues work or invokes an AI model.
- The worker checks source, owner, deletion and moderation again before work.
  Its conditional update cannot recreate deleted posts or attach stale meanings.
  Meanings are stored on the post, reused across readers, and have no expiry.
- An intentional empty terms list is reusable. Malformed or wholly invalid
  nonempty model output is retryable, never permanently cached as an empty list.
- Each author can enqueue up to 10 new sources per UTC hour. Active retries and
  status reads do not consume new enqueue budget. Each source has at most three
  model attempts, including attempts interrupted by a crash. SDK model retries
  are disabled so that cap counts actual Converse requests.
- FIFO delivery is grouped by post and deduplicated by source. The worker is
  limited to two concurrent deliveries, one message per invocation. Failed and
  unprocessed messages use partial batch failure handling and a retained DLQ.
  Work is retained for seven days; failed messages for fourteen days. Logs retain
  thirty days. Job counters retain only hashes and state, not source content.
- Browser confirmation never waits for AI. Its bounded outbox stores only ids
  and timestamps, is scoped to the signed-in account, expires after seven days,
  and retries enqueue up to three times per activation. Status checks stop after
  six polls or a terminal response. Normal feed loading remains the fallback.

The existing `TextReels` key is `id`; the existing `SmartyExplanations` key is
`explanationId`. This stack creates no table, index, stream, credential, or auth
provider. Job keys use `post-vocabulary#v1#<hash>`; hourly budget keys use
`post-vocabulary-budget#<author-hash>#<UTC-hour>`. Reads use exact keys and strong
consistency where accepting a save or claiming work requires it, never scans.
Role access to the state table is restricted to these prefixes. Post-table
authorization remains application-level ownership checks plus conditional
writes; this does not claim to change the existing table's tenant-key schema.

The worker uses the existing regular-post model, `us.anthropic.claude-sonnet-4-6`,
with a maximum output of 2,800 tokens. It does not change follow-up question,
quiz or news models. Full prompts and source text are not logged by this code.
Keep Bedrock invocation logging off for private posts unless its destination has
the necessary privacy controls. The deployment is intended for `us-east-1`;
verify model access and the profile's destination regions before the live test.

## Local checks and build

From the repository root:

```sh
python3 -B -m unittest discover -s infrastructure/post-vocabulary
python3 -B -m unittest discover -s infrastructure/ai-content
cfn-lint --format json --regions us-east-1 -t infrastructure/post-vocabulary/template.yaml
terraform -chdir=smarty-terraform validate
npm test
npm run build
```

SAM uses the Makefile to include the shared validated `post_glossary.py` with
each small package; it does not import the full AI publisher or its unrelated
storage/image dependencies. Build without deploying:

```sh
sam build --template-file infrastructure/post-vocabulary/template.yaml
```

Alternatively, `bash scripts/package-post-vocabulary.sh` locally checks both
Makefile targets and creates two minimal zip packages with checksums in a fresh
temporary directory. It does not deploy, send jobs, or run a model. The shared
source is copied from the repository during local builds; do not use an isolated
container build unless that shared source is included in the container mount.

IAM Policy Autopilot was run as a static review only. Its broad baseline includes
optional guardrail/tool, replication, bearer-token and KMS actions not used by
this IAM-role, non-replicated, SSE-SQS configuration. Do not upload that baseline.
The template retains exact workload actions and resource scopes; live policy
simulation remains a release gate. Reproduce the baseline review without
uploading, reading Terraform state, or resolving any credentials:

```sh
DISABLE_IAM_POLICY_AUTOPILOT_TELEMETRY=true uvx iam-policy-autopilot@latest generate-policies \
  /absolute/path/to/Smarty/infrastructure/post-vocabulary/api.py \
  /absolute/path/to/Smarty/infrastructure/post-vocabulary/common.py \
  /absolute/path/to/Smarty/infrastructure/post-vocabulary/worker.py \
  --region us-east-1 --service-hints dynamodb sqs bedrock-runtime --pretty
```

## Controlled release

1. Use isolated test tables with the key schemas above. Check model access,
   IAM policy simulation, account quotas and table recovery settings. Do not use
   real user posts for the first model test. Local mocks cannot prove these
   service integrations.
2. Build and review a CloudFormation change set. `WorkerEnabled` defaults to
   false; initial production provisioning must keep it false. Existing queues
   and user-data resources must not be replaced. Review alarms and the retained
   queue recovery policy before applying anything.
3. In an isolated test environment, enable the worker for a controlled synthetic
   post. Check queued acknowledgement, saved meanings, read-only polling, source
   edits, moderation, duplicate delivery, transient failures, and DLQ recovery.
   Enabling work invokes the paid model; get approval for that test.
4. Set Terraform's `post_glossary_api_function_arn` to the reviewed stack's
   `GlossaryApiArn`. This variable is exposed in `environment/prod` and defaults
   to empty. Review the plan for only the new integration, GET/POST routes and
   method-scoped Lambda permissions; never apply unrelated imported drift.
   No variable means no new routes, not a fallback to the long-running publisher.
5. Release the AI publisher with shared glossary validation and the updated
   feed reader. Verify `FeedIndex` projects `postGlossary` and the single-post
   endpoint also returns it. Do not change an existing index projection in place.
6. After the controlled checks pass, approve enabling the production worker and
   publish the frontend. Check a new post on mobile/desktop in both themes, then
   close/reopen the app and verify saved meanings are reused without more model
   calls. Old posts are unchanged; no automatic backfill is included.

For each future release, repeat the applicable checks above. Never infer
physical-device coverage or a successful failure-recovery drill from local
mocks, IAM simulation, or a successful single-message smoke test.

## Pause and rollback

Set `WorkerEnabled=false` to stop new model work while retaining queued jobs.
Remove the new route configuration and restore the earlier frontend/reader
packages if necessary. Keep the optional saved glossary attribute; old clients
ignore it. Retain the queues and inspect DLQ entries before any replay. Never
reset attempt counters or repeatedly redrive failed sources without investigating
the failure and getting approval for additional paid work.
