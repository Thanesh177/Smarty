# Connected learning lessons - version 7

The AIcontent backend has been deployed in us-east-1. The frontend was separately
approved, committed as `34dafcae427020f313f4739e2813a42c4c1111f8`, and deployed
by the live us-east-2 Amplify app `d3qiuefonbp8n9`, branch `main`, job 283.
Only seven frontend source/test files were committed and pushed; backend edits
remain separate. Job 283 succeeded. The previous successful web release (job 282)
has a private immutable artifact backup for rollback.
The new frontend deliberately refuses older generated answers; releasing it
before the backend would show the retry state instead of an upgraded lesson.

## Changes

- Treat the source post as a starting point, not text to paraphrase. Silently
  identify the exact claim, the important parts/concepts, and gaps a newcomer has.
- Limit recap to two opening sentences. Require at least three substantive
  explanatory additions when the subject supports them: underlying causes,
  prerequisites, internal steps, examples, evidence, trade-offs or boundaries.
- Explain the things mentioned inside the post, not a broad overview of its topic.
  Definitions immediately connect to the role each part plays in the example.
- Expand acronyms and explain technical words, including everyday words with
  specialized meanings. Re-establish prerequisites before using a difficult idea.
- Explain relevant origins: a design's motivating problem, a phenomenon's causes,
  or a historical event's documented circumstances. Do not manufacture a tidy
  origin story, inventor, chronology or current development when evidence is absent.
- Replace the fixed nine-heading worksheet with a connected, detailed lesson.
- Start with a concrete puzzle, then resolve it rather than relying on clickbait.
- Aim for 850 to 1200 words with three to five subject-specific chapter titles.
  Evidence and clarity take priority over filling a word count.
- Define terms where needed and explain the missing cause-and-effect links.
  Adapt to mechanisms, historical evidence, or conceptual reasoning as appropriate.
- Carry one example through multiple chapters, showing intermediate changes and an outcome.
- Change one condition to show why the outcome changes. Label invented values
  as hypothetical and separate historical counterfactuals from actual events.
- Connect the next narrow concept to a specific part of the current example.
- Weave applications, consequences, misconceptions, and limits into the story
  instead of separate generic boxes.
- End by tying the mechanism to the example and bridging to one related concept.
- Reject missing openings, empty/too-short chapters, duplicate or generic chapter
  titles, and model responses stopped by the token limit before caching. This is
  structural validation, not factual verification.
- Also reject obvious copied prose (35% or more of lesson tokens covered by
  eight-word runs from a source of at least 24 words) and repeated long sentences
  accounting for 30% or more of the lesson. These are conservative heuristics,
  not semantic novelty or truth guarantees. Brief quotations and shared technical
  vocabulary are allowed. Checks run locally without extra model calls.
- Conceptual posts and deep lessons without retrieved sources also receive a
  separate, bounded Claude knowledge/consistency review. Grounded drafts retain
  their existing evidence review, now including causal consistency. Incomplete,
  malformed or negative verdicts cannot become saved lessons. These model reviews
  can themselves be wrong; they are not independent fact verification or a truth
  guarantee. Real content still needs editorial review, especially in specialist
  or high-stakes subjects.
- A deep lesson with concrete negative review findings gets at most one corrective
  generation, which must pass review too. Invalid/incomplete reviews fail closed
  without launching another generation. Every review is capped at 450 tokens;
  every full lesson generation remains capped at 2800 tokens.
- An unsuccessful generation returns a retryable 503, not an empty 200 answer.
- Add follow-up prompts for difficult terms and background/origins on AI posts.
  Curated guides retain their existing local question/section mapping.
- Render chapter titles and paragraphs as safe text. No generated HTML is executed.

## Shared cache behavior

### Prepare new AI posts before publishing

New AI learning posts are held until their complete reviewed explanation has
been written to the shared database. The public post is then inserted with the
same explanation and its source/model/schema/review metadata already attached.
The existing reader UI can use the inline lesson immediately; an API lookup
also reuses the shared record without a model call. This changes future AI
publications, not user-authored posting or the existing first-open fallback for
older posts. No bulk regeneration of historical posts was started.

Unpublished source drafts are saved under `learning-draft#v1#` keys in
SmartyExplanations, separate from the feed. Retries retain the same source and
curriculum step. A failed feed write also reuses an already cached lesson rather
than invoking either model again. Drafts expire after seven days and cannot be
reused with a different post model, review version or learning target. Dated
reports are rechecked for freshness before a pending draft can be published.
When fewer than 120 seconds remain in the existing 183-second invocation, a
source-only draft is deferred to a fresh scheduled retry instead of starting a
long lesson at the timeout boundary. Published-post retries remain idempotent;
draft, cache and progress failures never advance an unpublished learning step.
The posting schedule, question-answer model, table configuration and native app
are unchanged. No new infrastructure is required.

Explanation schema 7 replaces older schemas on demand. Existing model/source-hash cache keys, database persistence,
conditional source updates and generation leases remain in place. Follow-up
answer keys include the teaching version so earlier answers do not override the
new format. Personal questions remain account-scoped. With the owner's approval,
201 outdated inline explanations and six legacy AI answer records were removed
after private backups. Seven posts required a separately approved timestamp-type
repair: the exact numeric timestamp value was preserved as a string to satisfy
the existing secondary index. No posts or account records were deleted. A
concurrently changed record was skipped; a final scan found no outdated inline
explanations. Simple explanations/translation caches and current lessons remain.
Current inline and shared-cache lessons are checked for obvious
copying/padding before reuse. The browser and API adapter both require versioned
answers; unversioned fallback text cannot bypass the new lesson requirements.
Curated local guides are independent of the generated-explanation schema.

After the owner enabled the provider agreement, AWS reported Sonnet 4.6 access
AVAILABLE/AUTHORIZED and the IAM-only 32-token probe passed from the actual
AIcontent runtime. Regular posts and deep lessons now default to
`us.anthropic.claude-sonnet-4-6` through Bedrock in us-east-1. This was a code-only
backend release; the existing frontend release did not need another deployment.
The user subsequently excluded question answers from the stronger-model upgrade.
`ANSWER_MODEL_ID` is independent of `POST_MODEL_ID` and `DETAILS_MODEL_ID`,
defaults to Nova 2 Lite, and controls answer generation, saved answer metadata
and cache identities. Changing the lesson model alone does not regenerate
saved inexpensive answers. Source changes and teaching-version changes still
invalidate them; personal answers remain isolated by account.
Regular posts retain a 700-token ceiling and incomplete-response rejection.
The shared cache and inline lesson carry review revision 1. Backend requests do
not reuse unreviewed lessons, even when their model and teaching schema match.
The teaching schema stays at 7, so the model change alone does not invalidate
inexpensive saved follow-up answers. Previously delivered browser-inline lessons
may remain until the client requests a new lesson; this release does not force
every open browser to reload or delete all current explanations.
First-time requests allow 35 seconds in the client, matching
the configured 30-second integration plus network overhead. If the integration
times out, it may still be generating on the server; retry reads the shared cache
or respects the existing generation lease rather than launching duplicate work.

## Verification

Run the existing AIcontent unit suites and the explanation-format,
learning-journey and request-cache frontend suites. Browser checks use synthetic
accounts and mocked generation responses, not real model calls. After deploying,
verify a previously cached post refreshes once, then confirm a subsequent
request receives the version-7 cached lesson without a second generation. Review
real generated content for factual accuracy and example clarity before rollout.

Unit coverage includes version migration without deletion, shared reuse, source
edits, copied/padded output rejection, safe text rendering, text/version pairing
in the API adapter, prompt depth/accuracy requirements, and failed generation.
Fixture-based checks do not establish the quality of real model output. Before
release, review real lessons on science, history, current events and nontechnical
topics for genuinely new explanation, inline definitions, source support and a
clear example. Do not claim the copying check verifies facts.

The initial Nova release and first Claude release both passed direct Lambda
generation/persistence/cache checks on a public gyroscope post. Manual review
then found misleading causal claims, demonstrating why structure and model choice
alone are insufficient. The unreviewed Claude test lesson was privately backed
up and removed with exact-value/concurrency conditions, preserving its source
post. The new bounded review-and-correction flow was exercised on unpublished
drafts. Its verdicts are fallible and must not be described as scientific proof.
The deployed review flow also generated a 972-word economics lesson with
review revision 1; it persisted successfully and the second direct invocation
returned cached=true/persisted=true. Manual review still identified oversimplified
claims in this sample. Both temporary test lessons and their shared-cache copies
were removed after private backups, leaving the source posts intact. These are
direct backend checks, not authenticated mobile end-to-end tests, and not an
endorsement of the samples' factual accuracy. No sample feed posts were published.

The catalog now contains 99 topics and 501 narrow targets across 11 domains.
Nine added paths cover cosmology, zoology, botany, marine biology, scientific
method, discoveries, scientific mysteries, education and literature. Existing
curriculum version 1 and existing target order are preserved. Frontend aliases
place books, animals, plants, sea creatures and cosmos within existing main
categories rather than creating more top-level filters. Publishing schedules,
news, quizzes, authentication and native apps were not changed.

Local verification: 274 frontend tests previously passed; the prepare-first
backend release passes 104 AIcontent tests. New regression cases cover missing
lessons, shared-cache write failure, source-draft storage failure, deferred
generation near timeout, source/lesson reuse after a failed feed write, stale
draft refresh, model upgrades while pending, and reader reuse without AI calls.
The new publishing path was verified with local service/model fixtures, not by
publishing an artificial test post to the live feed. The deployment check uses
the bounded non-publishing runtime probe. The previous frontend release
build passed. Synthetic browser checks at 320, 390, 834 and 1512 pixels passed for
upgraded lessons, inline reuse, term/background prompts, old-server rejection,
retry recovery and curated-guide follow-ups, without horizontal overflow or
runtime errors. These are browser checks, not physical-device or live-model tests.

Rollback: immutable Lambda version AIcontent:1 preserves the original pre-release
code; AIcontent:2 preserves the preceding Nova version-7 release with independent
inexpensive question answers. AIcontent:3 preserves the reviewed-Claude release
before prepare-first publishing. The deployed prepare-first code SHA256 is
`KVcBqafC1vDvqAMQ7gU9UnlzuwpBVkCVJFcB+IRQkfc=` (base64). These release
artifacts are preserved locally for rollback. No Lambda environment values,
credentials, IAM policies, schedules, database configuration, news or quiz settings changed.
Private cleanup backups and reports are stored under the Codex workspace, not
in this repository. Do not publish those backups or saved user questions.

Public live HTML and assets were checked after job 283 succeeded: the expanded
topic labels, difficult-term/background prompts and versioned retry UI are
present at smarty.wiki. This is release verification, not a physical-device
login or end-to-end generation test.

## Claude cost scenario

Using standard US geographic inference pricing derived from Anthropic's
published $3/$15 per million tokens and 10% geographic premium gives $3.30
input and $16.50 output. For a 30-day month, 90 posts plus their deep lessons
are estimated at $6.68. Assumptions: 2000 input/700 output tokens per post and
3000 input/2800 output tokens per lesson. One thousand additional new lessons
would add approximately $56.10. These are scenario estimates, not observed
monthly spend or spending limits. Retries, source-review calls, hosting,
storage, taxes and cheaper question-answer usage are excluded. Reusing an
existing saved lesson avoids a new model invocation.
The subsequent consistency review adds a bounded call for newly generated
content, and a rejected lesson can incur one corrective generation plus another
review. These were not included in the original $6.68 scenario; actual spend
depends on input size, review rejection rate and usage. Shared-cache hits do not
repeat generation or review.

Pricing reference: https://platform.claude.com/docs/en/about-claude/pricing
