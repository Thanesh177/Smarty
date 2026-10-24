# Automatic learning-post recovery

## Root causes

The live `Daily_content` schedule was still `rate(1 days)` with a flexible
30-minute window, no input and no delivery retries. Empty events entered the
legacy invocation branch, which returned an HTTP-shaped 500 on a generation
failure. Lambda therefore saw a successful invocation and did not retry it.

Recent runs stopped at a rejected deeper lesson and at missing history
references. The World History foundation asks about trade routes, but Wikipedia
search ranking returned narrower route articles rather than the foundation
article. The exact-subject filter correctly rejected those results.

## Changes

- Update the existing schedule in place to 08:00, 14:00 and 20:00 IST, with its
  flexible window disabled. No new posting schedule or missed-day backfill.
- Send the learning source and original scheduled timestamp. Context placeholders
  must remain literal in the input: Terraform `jsonencode` escapes angle brackets,
  so the payload uses a literal JSON heredoc instead.
- Retry delivery failures up to three times within one hour. Configure Lambda
  execution retries separately: two retries, one-hour maximum event age.
- Existing publication bindings, conditional writes and shared draft/lesson caches
  reuse the same post across deliveries. Failed lessons stay unpublished; progress
  advances only after publication. Accuracy and completeness checks are unchanged.
- Resolve known foundation history concepts directly by article title, retaining
  the existing host, excerpt-length, exact-topic and factual-review requirements.
- New regular posts use everyday words, short connected sentences and one concrete
  example. Essential terms are explained immediately and acronyms expanded.
  The guide appears in the system instructions as well as the task prompt, without
  adding another model call. Existing posts and saved lessons are not rewritten.
- Reject titles promising unsupported absolutes such as "forever" or guaranteed
  results. The existing conceptual review also receives an explicit factual-editor
  system instruction so simpler language is not permission for false causal rules.

Reminder schedules, models, follow-up answers, credentials and databases are
unchanged. Scheduler delivery retries do not replace Lambda execution retries:
see [Lambda asynchronous error handling](https://docs.aws.amazon.com/lambda/latest/dg/invocation-async-error-handling.html).

## Verification and rollback

Run `python3 -m unittest discover -s infrastructure/ai-content -p 'test_*.py'`.
The content suite has 108 passing tests, including duplicate delivery, incomplete
lesson rejection, saved-draft recovery, exact history lookup and plain-language
prompt contracts and rejection of unsupported title promises. Terraform validation
also passes.

The live repair used a reviewed saved plan targeted only at
`module.scheduler.aws_scheduler_schedule.this["Daily_content"]` and
`aws_lambda_function_event_invoke_config.learning_publication`. No resources were
deleted. Verify the live target input contains literal scheduled-time placeholders,
not Unicode-escaped brackets.

An approved real publication used the fixed scheduled instant
`2026-10-19T03:49:14Z`. It created
`learning-26d5183a0cf4e668dd58107fe3ca0b9f`, with a saved, reviewed deeper lesson.
Replay the same timestamp to test idempotency; never invent a new timestamp merely
to retry that publication. This one publication predates the plain-language update.
The public `/reels?limit=5` endpoint returned the verification post, and replay
returned the same saved ID with "This learning step was already published".

Each code deployment backs up the deployed zip in a private temporary release
directory, verifies its checksum, preserves unrelated archive files and uses the
current revision ID to prevent overwriting a concurrent update. Roll back only the
relevant code package and schedule fields if needed; do not restore an entire old
Terraform state or delete published posts. No commit or push is part of this repair.
