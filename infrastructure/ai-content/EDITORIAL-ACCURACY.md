# Source-led learning posts

The existing daily schedule, curriculum order and basic-to-advanced progression
are unchanged. The balanced subject/domain rotation already includes world,
ancient, political, economic, diplomatic, colonial and other history subjects.

## Editorial mix

- Make something: materials, steps, a check and a variation for a safe tabletop
  project. For example, “How to make a paper bridge that holds more.”
- Questions hiding in plain sight: start with a familiar detail and explain why
  it happens. For example, “Why do checkout lines move at different speeds?”
- A different way to think: reveal an overlooked connection, try a clearly
  labeled thought experiment, or explain what would help resolve a real open
  question. For example, “What if maps measured time instead of distance?”
- Documented history: real events, objects, actors, chronology, consequences and
  the limitations of surviving evidence. No invented dialogue, private motives,
  fictional anecdotes or disputed interpretations presented as settled facts.
- Current connections: explain a specific learning concept through a relevant
  retrieved report from the last seven days. Attribute claims, retain the report
  date and distinguish announced plans and preliminary findings from outcomes.
- Deeper questions: trace an interesting causal puzzle and its constraints without
  clickbait, conspiracy framing or generic motivational filler.
- Existing mechanisms, experiments, failure modes, tradeoffs and comparisons
  remain available. Lenses do not replace the assigned curriculum subject/stage.

The three curiosity formats get extra weight in the existing rotation. Rotation
counts up to 24 recognized formats in the sampled AI posts, ignoring community
posts and unrecognized formats. It avoids repeating the most recent format when
an equally underused eligible one exists. The same editorial review checks that
each post delivers on its format. If a tabletop build doesn't pass review, the
final retry can explain the same lesson without the build; nothing skips the
curriculum step or increases the retry limit.

## Readable across majors

Write for a curious adult meeting the subject for the first time. Start with
something they can picture, explain specialist terms when they become useful,
then show why a different condition changes the outcome. For instance, start
with why a crowded café can suddenly stop serving people quickly, then name
the bottleneck and explain why adding more tables would not help if the kitchen
cannot fill orders any faster. Keep the specific mechanism and its limits;
advanced lessons go further into the reasoning, not further into jargon.

The first paragraph answers a concrete question; the second should move the
lesson forward with an application, prediction, contrast, or limit. A local
check rejects copied or nearly identical paragraphs before paying for a review.
The existing editorial review checks accuracy and readability separately and
gets the exact subject, learning objective, and difficulty level so that a
well-written draft about the wrong concept still fails. For sensitive subjects,
posts use non-operational examples rather than hazardous procedures, attacks,
or personalized health, legal, or financial advice.

Actionable feedback from both local checks and the reviewer is reused within the
existing draft retry limit. An accepted draft still uses one writing call and one
review call. The updated review version only invalidates earlier unpublished
drafts; published posts and saved explanations are not rewritten.
If length is the issue, the retry receives each paragraph's actual word count
and the accepted range; the check does not trim or pad a draft.
The writer and topic validator share the same title and body term requirements.
If either field misses, the retry names that field and the acceptable terms.
This does not replace the editor's check that the post teaches the right concept.
The editor also checks whether the title's claim is supported by the article.
Longer lessons have the same teaching and safety criteria whether reviewed
against supplied sources or established concepts. Sourced lessons now get one
focused rewrite when the reviewer gives actionable findings. A malformed verdict
never authorizes a retry or publication, and an accepted first draft takes no
extra model call. Existing saved lessons are reused rather than reprocessed.

## Retrieval and safeguards

History subjects retrieve up to two relevant Wikipedia reference extracts using
the MediaWiki API. Named events/objects use title matching; broad introductory
lessons use their central concept, following an explicit page redirect if present.
Redirects still have to pass excerpt relevance and hostname checks. Wikipedia is an encyclopedia, not a primary
archive or independent verification service, and is attributed as such.

Current connections read bounded NASA and BBC World RSS descriptions, selecting
only relevant, dated reports. This is not comprehensive world-news coverage. No
paid search API or additional key is required. No full publisher articles are
scraped. Unavailable, dateless, old, future-dated, unrelated or unsafe records are
not accepted. URLs and redirects have exact HTTPS hostname allowlists; requests
have time/size limits, and XML entity declarations are rejected.

The model can cite only supplied source IDs. Unknown or duplicate IDs fail.
Source-required historical drafts cannot publish without material. When no recent
report matches an ordinary concept, the generator falls back to a stable lesson,
not invented news. Current language in an unsourced conceptual/historical draft
is rejected. A second model pass checks factual case details against the retrieved
excerpts; failed or malformed verdicts stop publication. Drafts are not padded or
truncated after the check.

These are conservative consistency checks, NOT a guarantee of truth. The same
model can miss errors, the retrieved source can be wrong, and a short extract can
omit context. Human editorial review, primary-source corroboration and correction
workflows remain necessary for consequential or disputed claims. Do not label
posts “verified” or promise that AI never makes mistakes.

Missing history sources end the current attempt without spending model calls or
repeating the cached lookup. Direct invocations distinguish this from exhausted
editorial retries and model-service failures with `historical_evidence_unavailable`,
`post_quality_checks_exhausted`, and `post_model_unavailable`. Scheduled invocations
still fail for the scheduler to retry; none of these cases advances the lesson.

### Scheduled recovery

A failed source lookup or exhausted draft retries can defer the blocked topic
and select one alternate topic for the same scheduled run. The alternate still
needs a reviewed post and a saved deeper explanation. The original topic keeps
its place in its own learning path; it can be retried on a future rotation.
The scheduled run records the switch before attempting the alternate. When the
invocation is too close to its deadline, the next delivery resumes the recorded
switch instead of redrafting the blocked lesson. Duplicate deliveries return the
same published post. Provider, database, and unfinished deeper-lesson failures
retry the current assignment without switching topics. If neither topic is ready,
the run reports failure so the existing retry policy can handle it.

Publication locks cover the Lambda deadline with a small margin. If an
invocation times out before releasing its locks, a retry does not have to wait
for the shared 16-minute default. No new table, index, permissions, or scheduled
jobs are needed.

The scheduler uses the existing slot and topic-path locks; a second lock for
the same slot has been removed. Draft retries share one evidence lookup per
subject and mode within the run. Current reports are refreshed if they cross
the freshness boundary. Existing database cache lifetimes are unchanged.

## Persistence and deeper explanations

Sources, evidence excerpts, reporting/retrieval dates, editorial mode and policy
version are stored with each generated post in the existing post table. Sources
are displayed by the existing Sources section on the deeper-explanation page.
New deeper explanations receive the same evidence and undergo the same consistency
check. Unsupported detail returns an unavailable explanation rather than saving it.

The existing explanation table caches successful historical retrieval for seven
days, current retrieval for fifteen minutes, and empty retrieval for one minute.
Freshness is checked in code, not by assuming DynamoDB TTL deletes immediately.
Completed posts and their citations remain stored and reused; no existing posts
or explanations are deleted. Evidence changes invalidate the shared explanation
hash, with consistent hashing before/after DynamoDB Decimal conversion. Conditional
explanation writes also guard the evidence snapshot against concurrent edits.

## Release and validation

The review and efficiency improvements above are prepared locally. All 147
local tests passed, including evidence reuse, expiry during retry, grounded
rewrite, and duplicate delivery. These changes have not been deployed.

Production `AIcontent` in `us-east-1` was updated to version 7 on 2026-11-12.
All 141 local tests passed, including alternate-topic recovery and duplicate
delivery; the live code matched the tested archive and its non-publishing
model check returned ready. Version 6 preserves the previous live code.
The posting schedule is unchanged. No additional manual post was published.

Production version 8 was deployed on 2026-11-13 after 142 local tests and a
successful non-publishing model check. Near the invocation deadline, the
worker now uses a default cover rather than waiting for image services after
the reviewed lesson is ready. Scheduled runs log the result, slot, and post ID
without logging lesson text. Version 7 is the rollback point.

Before the version 8 rollout, the public post endpoint returned all three
lessons aligned with the most recent schedule cycle (Space, Aviation, and
Artificial Intelligence), each with a saved deeper explanation. The schedule
remains enabled at 08:00, 14:00, and 20:00 IST. Two asynchronous execution retries
are configured. There is no on-failure destination yet: exhausted events
require operational monitoring or a separately configured replay destination.

A one-time version 6 run at `2026-11-12T14:47:41Z` published the Finance lesson
`learning-28cc8b7144b72f5eac1cad4b8b699112` with its deeper explanation saved.
The public post endpoint returned the same lesson ID. Do not use a new
timestamp to retry this publication.

Run `python3 -m unittest discover -s infrastructure/ai-content -p 'test_*.py'`.
`scripts/package-news-learning.sh` includes `editorial_sources.py` in AIcontent.zip.
Deploy that complete package through the existing reviewed backend release flow,
not just lambda_function.py. No new IAM permissions or tables are needed.

Before enabling production generation, review real model output for at least one
history, current and conceptual lesson in staging. Validate API metadata round trips
and the Sources section. Unit tests use mocked models/database calls; public-source
retrieval checks do not establish live Bedrock or DynamoDB integration. Increasing
generation frequency, rewriting old posts or publishing a batch requires a separate
release decision; this change does none of those.
