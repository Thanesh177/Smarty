# Source-led learning posts

This update is prepared locally; it does not publish posts or deploy the backend.
The existing daily schedule, curriculum order and basic-to-advanced progression
are unchanged. The balanced subject/domain rotation already includes world,
ancient, political, economic, diplomatic, colonial and other history subjects.

## Editorial mix

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

## Retrieval and safeguards

History subjects retrieve up to two relevant Wikipedia reference extracts using
the MediaWiki API. Named events/objects use title matching; broad introductory
lessons use their central concept. Wikipedia is an encyclopedia, not a primary
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
