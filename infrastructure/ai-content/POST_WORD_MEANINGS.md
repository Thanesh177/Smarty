# Saved word meanings

New AI posts request a small glossary in the same writing request. The existing
editorial review checks its contextual accuracy along with the post. The final
`TextReels` write includes `postGlossary`; there is no AI request when a reader
taps a word. Generation uses the existing regular-post model and leaves
follow-up question models unchanged.

Unpublished source drafts without valid saved meanings are refreshed before
publication. Already-published posts are not rewritten.

The glossary has `version: 1`, `sourceHash` (SHA-256 of the exact title, newline,
and body), and at most 16 `{term, meaning}` entries. Terms must occur literally
in the post. Validation removes duplicates, markup, excessive lengths and
invented terms. Plain-language explanations use 2 to 4 short sentences, usually
40 to 70 words and capped at 650 characters: what it is, how it works, and its
role in this post. No examples, analogies, or hypothetical situations. They
should stand alone without introducing
unexplained jargon. A simple post may have an
empty, reusable glossary. AI accuracy still requires editorial sampling.

Community post creation/editing confirms the accepted save immediately. A small
account-scoped device outbox requests `POST /posts/glossary` in the background
using only `postId`. The isolated API checks the authenticated author and saved
source, then durably enqueues the work before returning 202. A separate worker
prepares and conditionally stores meanings without extending the publishing
request. The device can retry interrupted enqueue after reopening; it never
resubmits the post. See `../post-vocabulary/README.md` for limits and deployment.

Read-only `GET /posts/glossary?postId=...` checks status after an accepted enqueue.
Polling is finite and never calls a model. When meanings are ready, a shared
browser event updates the matching visible post after exact-source verification,
without a feed reload. Account changes cancel timers and ignore late responses.
Failed optional preparation never turns an accepted publication into a failed
publish. Readers tapping words never trigger generation.

Meanings travel in the normal feed payload and use its existing local caching.
The reader verifies the source hash before showing underlines. Older posts,
unsupported crypto environments and changed posts display normal text without
stale highlights. Original meanings are not applied to translated text. No
automatic migration or paid backfill of old posts is included.

## Release order

1. Package the existing `AIcontent` handler with `post_glossary.py` (included by
   `scripts/package-news-learning.sh`). Keep the previous package for rollback.
2. Follow `../post-vocabulary/README.md`: build and review the isolated service,
   validate against isolated test tables, and connect its `GlossaryApiArn` to the
   existing JWT-protected POST/GET routes with the new Terraform variable. Empty
   configuration leaves these routes disabled. Preserve the normal AI schedule.
3. Release `getTextReels` with its added `postGlossary` projection. Confirm the
   existing FeedIndex projects the attribute (an ALL projection includes it).
   Check the single-post service also returns this field without stripping it.
4. Release the website, then check one newly created AI post and one community
   post. Verify inline meanings in mobile/desktop, both themes, outside-tap,
   Escape, keyboard activation, and unchanged saved meanings after reopening.
   Confirm unauthorized glossary requests fail before model invocation and an
   edit cannot display the prior text's meanings.

Rollback can disable the new route/permission and restore the earlier reader,
writer and website packages. The optional stored attribute can remain; old
clients ignore it. No post content needs deletion or rewriting.

## Local checks

```sh
node --test src/lib/postGlossary.test.js src/components/PostVocabulary.test.cjs
python3 -B -m unittest discover -s infrastructure/ai-content
python3 -B -m unittest discover -s smarty-terraform/lambda-src/getTextReels
npm test
npm run build
```
