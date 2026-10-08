# Connected learning lessons - version 5

The frontend and AIcontent backend changes are local until separately deployed.
Deploy both together for the improved generation format; frontend-only release
removes generic labels from saved lessons, but cannot update the server prompt.

## Changes

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
- Render chapter titles and paragraphs as safe text. No generated HTML is executed.

## Shared cache behavior

Explanation schema 5 replaces schema 4 on demand; there is no mass regeneration
or deletion. Existing model/source-hash cache keys, database persistence,
conditional source updates and generation leases remain in place. Follow-up
answer keys include the teaching version so earlier answers do not override the
new format. Personal questions remain account-scoped. Saved old-format lessons
remain readable as continuous prose during a frontend/backend rollout.

Generation uses an explicit 2800-token ceiling on the existing model, not a new
provider or service. First-time requests allow 35 seconds in the client, matching
the configured 30-second integration plus network overhead. If the integration
times out, it may still be generating on the server; retry reads the shared cache
or respects the existing generation lease rather than launching duplicate work.

## Verification

Run the existing AIcontent unit suites and the explanation-format,
learning-journey and request-cache frontend suites. Browser checks use synthetic
accounts and mocked generation responses, not real model calls. After deploying,
verify a previously cached version-4 post refreshes once, then confirm another
account receives the version-5 cached lesson without a second generation. Review
real generated content for factual accuracy and example clarity before rollout.

Local checks: 174 frontend regression tests and 29 AIcontent/cache tests passed.
Phone (320/390), tablet (834), and desktop (1512) fixture checks passed for new
lessons, saved version-5 lessons, and older-server responses, with no runtime
errors or horizontal overflow. The release build passed. No live model invocation,
database migration, or deployment was performed.
