# Shared generated content caching

## What is reused

- Published AI feed posts remain in `TextReels`, shared by all readers. Scheduled publication IDs already prevent duplicate posts; a new DynamoDB lease also prevents simultaneous deliveries from doing duplicate model work before publication.
- Detailed explanations use `SmartyExplanations`, keyed by post, source-content hash, schema version and model. Edited lessons cannot reuse an explanation for the old text. Inline explanations are reused only when their source hash and model match. A conditional update prevents a late explanation from recreating a deleted post or updating an edited lesson.
- Exact matching public questions use shared records in `PostAiDoubts`. Personal-looking questions and questions about non-public posts remain account-scoped. Shared records have no user ID. There is no question-search endpoint or approximate matching. Existing per-user answer records are left untouched; new answers use versioned keys.
- `DailyNews` shares location/headline responses for 20 minutes. The world AI briefing has a separate `world-briefing-v22#YYYY-MM-DD#english` record, reused until the next UTC day regardless of headline refreshes or which user opens it. Both caches have generation leases. Database failures do not trigger uncached model generation. Errors and stale editions are not stored in browser/proxy HTTP caches.
- Quiz questions stay in `QuizQuestionCache` for up to one year and are reused across users with the same topic, lesson source, model, depth and weak-area set. Pool refill is protected by a lease. Warm-process entries are bounded to 128 and rechecked against the database after 10 seconds. Results are put into memory only after a successful database save. Scores and attempts are not shared.
- The topic catalog now has a bounded 60-second in-memory read cache with request deduplication. It clears on account change, including protection against old in-flight requests refilling it. Existing browser feed, news and active-quiz caches remain; private feeds, chat, moderation and writes were not given shared caches.

## Identity and freshness

Quiz history uses only a verified API Gateway authorizer subject, never the request body's `userId`. The repository currently defines `/quiz/generate` with authorization `NONE`: those requests are treated as guests, with existing browser-side question exclusions but no cross-device history. Enabling authenticated server history requires a separately reviewed JWT-route change; this release does not silently remove guest quizzes. Answer requests already use a JWT-protected route.

Expiration is checked by the application, not by assuming DynamoDB TTL removes records immediately. Explanations and new answer records carry a one-year TTL; existing rows without TTL are not deleted. Terraform adds TTL configuration to those two existing tables. Quiz pools and news already have TTL configured. Generated feed posts are not expired.

Leases use conditional PutItem, owner-checked release and a 960-second crash-recovery limit (longer than Lambda's maximum invocation). Normal success/failure releases immediately. A crashed or timed-out generator can delay a cold retry until its lease expires; saved news remains readable during that interval. No new always-running cache service is needed.

## Release

These changes are local until deployed. No live database or AWS configuration was changed.

1. Run the Python suites in `infrastructure/ai-content` and `smarty-terraform/lambda-src/news`; run `node --test src/lib/requestCache.test.js smarty-terraform/lambda-src/generateQuizQuestions/index.test.cjs`; build the web app.
2. Review the Terraform plan for the `PostAiDoubts` and `SmartyExplanations` TTL updates. Do not apply unrelated drift. Verify IAM: AIcontent needs GetItem/PutItem on its explanation and answer tables and its existing TextReels permissions; news needs GetItem/PutItem on DailyNews; quiz needs GetItem/PutItem on its pool/history tables. No new DeleteItem permission is needed.
3. Run `bash scripts/package-news-learning.sh`. Deploy all three generated zip files to the corresponding existing Lambda functions. Both Python zip files MUST include `generation_cache.py`; uploading only lambda_function.py will fail imports. The existing Lambda Terraform module ignores code changes, so a Terraform apply alone will not publish these files.
4. Deploy the frontend using the normal release process. Do not change or duplicate the learning-post schedule.
5. Smoke-test two separate users requesting the same public explanation/question, concurrent quiz requests, a changed lesson, same-location news refresh and a simulated provider failure. Confirm model calls occur only for misses or exhausted quiz pools. Verify table/role names in the live environment before deployment.

Unit tests use stubbed SDK boundaries; they do not prove live IAM, provider availability, or model access. Monitor generation duration and retryable responses after release.

Local checks: 22 generated-content/cache tests, 16 news tests, 6 quiz-cache tests, 3 browser-cache tests, and 30 authentication regression tests. Production web build and Terraform production-configuration validation passed. Existing bundle-size warnings remain. Unrelated working-tree edits were preserved.

References: [DynamoDB conditional writes](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Expressions.ConditionExpressions.html), [TTL and delayed deletion](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/TTL.html).

## Daily world briefing update

The first successful request of a UTC day generates and saves that day's world edition; there is no new scheduled job. Subsequent users and Refresh actions reuse it. The edition summarizes the preceding 24 hours as of publication, not events that happen later that day. Live newsroom headlines still refresh independently. The feed displays the edition date and publication time, and checks the edition day before treating browser data as fresh.

The AI uses current, dated reporting as evidence. The feed shows an overview, short takeaways, section explanations, and optional reported context/next steps. Compact expandable source panels under the overview and section summaries expose the saved evidence links; invalid and duplicate URLs are omitted. Search sits at the top-right and brings matching summaries forward while a query is entered. Evidence links also remain in the database and dedicated newsroom. Unsupported context is omitted; keyword-based grounding checks are a safeguard, not a factual guarantee. The generation prompt forbids speculation and treating retrieved content as instructions.

AI failures are cached only for the short retry window, not the whole day. The feed does not present extractive/headline fallbacks as an AI edition. The full newsroom can still display those underlying reports. Deploy the news Lambda and frontend together to enable the v22 daily edition; verify live model output quality, runtime duration, cross-user reuse and UTC rollover before release. Local validation includes 25 news unit tests and fixture-based phone/tablet/desktop browser checks; no live model invocation or deployment was performed.
