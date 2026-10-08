# Basic-to-advanced learning posts

These changes are local. Deploy the web frontend and the AIcontent backend to
enable the full flow. No existing posts were rewritten or bulk generated.

## Content plan

There are 637 specific lesson targets across 90 subjects. Every subject has a
concrete foundation, the existing narrower component/mechanism lessons, and an
advanced integrative capstone. Topics remain balanced across the existing domains;
the three daily scheduled slots and models are unchanged.

For example, AI progresses through training versus inference, tokenization,
embeddings, attention, caching, retrieval, adaptation, routing, quantization,
diffusion, preference training, prompt-injection boundaries, and a final tradeoff.
Each post stays focused on its assigned concept, not a category-wide overview.

The generation prompt matches the stage: accessible definitions at the start,
named intermediate steps in the middle, and assumptions, edge cases, comparisons,
and justified tradeoffs at advanced stages. Detailed explanations reconnect the
prerequisite and bridge to the next specific subject. These stages do not certify
exam readiness or factual accuracy; generated copy still needs editorial review.

## Persistence and retry safety

- Posts store level, objective, order, path/version, prerequisite subject, and
  previous/next lesson IDs in the existing post table.
- Progress and scheduled-slot bindings use the existing explanation table with
  no expiry. Ordinary explanation caching remains separate from path progress.
- Publication and per-path generation leases prevent concurrent duplicate work.
- A deterministic post ID identifies each curriculum step. Publication is a
  conditional insert; progress advances only after the insert succeeds.
- If a process fails between publication and progress persistence, the next
  attempt finds that post by ID and completes the progress write without another
  model call. These are two writes with recovery, not an atomic transaction.
- Failed drafts retry the same missing lesson. Cache/progress failures stop
  generation rather than falling back to random advanced content.
- A retried completed slot cannot regenerate a subsequently deleted lesson.
  Moderation visibility is still enforced by the normal read APIs.
- Source-matched explanations are embedded at publication, so an interrupted
  shared-cache backfill does not force the AI to write the lesson again.
- Explanation hashes include teaching metadata when present; old posts without
  that metadata retain their previous hash and shared-cache behavior.
- Completed paths do not loop back to duplicate basics. That scheduled slot
  returns a no-repeat result. Extend/version curricula deliberately after review;
  a changed catalog signature fails closed instead of silently resetting progress.

Do not edit the order of an already-published curriculum without a reviewed
version/migration plan. Existing topic rotation visits all subjects before a new
cycle; this does not generate all 637 readings immediately. New introductory
lessons accumulate first, then later visits deepen each subject.

## Reader flow

The feed and explanation show a quiet level/lesson label. In My learning, a
selected subject's loaded curriculum posts appear in path order rather than newest
first. Earlier and later posts can still be opened freely; there is no artificial
unlock gate. Historical/community posts receive no invented difficulty label.

Recommendations prioritize the adjacent published lesson. Direct reads of the
previous/next IDs make links work even when those lessons are outside the latest
20 feed results. Missing, removed, or unpublished lessons are not offered as broken
links. The existing focused quiz continues to use the actual lesson context.
Reading history preserves progression metadata per account on the device.

## Verification and rollout

Local checks: 46 AIcontent/cache/curriculum tests, 178 frontend tests, and the web
release build passed. Browser fixtures at widths 320, 390, 834, and 1512 checked
stage labels, ordered lesson lists, adjacent recommendations, missing-next-step
handling, runtime errors, and horizontal overflow.

Tests use mocked services, not live Bedrock or DynamoDB integrations. No cloud
resources, provider credentials, publication frequency, or live content changed.
The release packaging script already includes the updated content catalog and
shared lease helper. CI now runs all AIcontent test modules.

Before production, check that /reels and /reel preserve the new post metadata,
verify scheduled retry/recovery on an isolated staging path, and review real
foundation/intermediate/advanced output for accuracy and teaching quality. Check
the deployed role's existing table read/write permissions and real lease expiry.
