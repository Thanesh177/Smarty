# Related news story timelines

## What changed

- Individual news story cards offer **Follow the story** links. Briefings, section summaries, and takeaway cards do not show this action.
- `/news/story?q=...` opens related dated reports. Readers can refine the suggested subject, choose a year (2000 onward) or month, read earlier-to-latest or newest-first, and open the original publisher. The chosen query and period are shareable in the URL.
- The current free Google News RSS discovery source is reused. No additional API key or AI model is required. Date filtering is rechecked locally. The UI explicitly describes incomplete coverage; it does not claim to contain every report or the actual beginning of an event.
- Search suggestions are editable heuristics, not AI interpretations or factual event histories. News reports are attributed to their publishers. Full article bodies are not scraped or copied.

## Shared storage

The existing `DailyNews` table stores `story-v1#<hash>` items. Identity includes normalized query, year, and month; recent-coverage snapshots additionally include the UTC date so earlier daily snapshots are retained. No user identity is included: all readers reuse the same result.

Nonempty archive snapshots deliberately omit `expiresAt`, so the daily-news TTL does not delete them. Recent/current-year queries refresh after 20 minutes; past years refresh after seven days. Empty results and partially failed requests retry after five minutes. Empty records expire after one day. Previously saved results remain available when providers fail.

Each request makes at most four parallel provider calls, each with a five-second timeout and an existing response-size limit. Snapshots are deduplicated by URL and bounded to 160 report references and 260 KB. Large selections preserve both ends of the date range; readers can narrow to a month for additional reports. This is a bounded discovery archive, not an exhaustive publisher archive. Archive storage grows as new subjects and periods are explored; monitor `DailyNews` storage and request costs. A complete licensed archive would require a separate provider agreement.

Browser storage keeps up to 12 recent timeline responses for quick revisits. Canceled or superseded requests cannot replace the current story. Shared database writes must succeed before the API claims a newly fetched snapshot was saved.

## Release

1. Run `python3 -m unittest discover -s smarty-terraform/lambda-src/news -p 'test*.py'` and `node --test src/lib/newsStories.test.js`, then build the web app.
2. Package the existing news handler together with `infrastructure/shared/generation_cache.py`, using the existing `scripts/package-news-learning.sh` workflow. This feature requires **only the news package**, not the other packages produced by that script.
3. Update the existing news Lambda through the normal release process, preserving its settings. It already has GetItem/PutItem access to `DailyNews`. No new table, API route, model, schedule, or permission is required. The existing `GET /latest` route accepts `view=story&query=...&year=...&month=...`.
4. Deploy the frontend after the backend. The client deliberately rejects an old server's normal daily-news payload instead of mislabeling unrelated news as a story timeline.
5. Verify a fresh story request, a repeated request returning `fresh-cache`, a historical period, a month, a no-results case, and a saved fallback. Inspect a nonempty `story-archive` item to confirm no TTL attribute. Do not infer live persistence from local mock tests.

## Verification status

Local backend/frontend tests and browser checks use fixtures. A read-only live-provider check returned 86 dated reports for the example query `Gaza` in October 2023, with gaps at the start of the selected period, confirming why the incomplete-coverage label is necessary. TLS verification remained enabled.

Verification on 2026-10-02: 36 backend tests and three frontend helper tests passed. Browser checks at 320, 390, 834, and 1512 pixels covered entry from individual news cards, absence of follow-story actions on briefings, year/month selection, chronological sorting, no-results handling, local cache reuse, retry with saved data, and returning to the originating news view. The production build passed. These are not live DynamoDB integration tests or physical-device tests.

## News-only production release - 2026-10-03

The user approved deployment of the news backend only. Updated `arn:aws:lambda:us-east-1:147179611217:function:news`, reached by `GET /latest` on API `po2hwyb2c6`. The previous backend ignored `view=story` and returned daily news, causing the frontend's server-version error.

- Deployed the tested `lambda_function.py` plus `generation_cache.py`. AWS reports `Active` and `Successful`; deployed package SHA-256 (base64): `km+dB2aQqO+gmeoj3v0V+SOQ0TYvOY22bVWm3a7yAvY=`.
- Preserved runtime Python 3.12, handler, role, environment, 256 MB memory, and the existing 20-second timeout. No changes to API routes, database schema, login, schedules, other functions, or frontend hosting.
- Retested 36 backend tests and three frontend helper tests: all passed.
- Live recent `Israel Gaza` query returned 91 dated reports; October 2023 `Gaza` returned 86. Repeat requests returned `fresh-cache` with unchanged timestamps. An invalid query returned 400, not unrelated daily news.
- The ordinary world news endpoint returned 60 articles and its briefing, then reused its cache successfully. The initial refresh completed in 12.8 seconds.
- A strongly consistent read of the historical record in `DailyNews` confirmed `recordType=story-archive`, `kind=story-timeline`, `stored=true`, matching `updatedAt`, and no `expiresAt` deletion TTL. This checks real database storage, not only fixtures.
- Browser checks against the deployed timeline service at 390, 834, and 1512 pixels verified recent and historical results, loading more reports, no horizontal overflow, and no runtime errors. These are browser checks, not physical-device tests.

A checksum-verified rollback package, deployed package, pre-release metadata, and live API verification report are retained locally at `/Users/thaneshn/Documents/Codex/smarty-news-release-2026-10-03.qhihKP/`. `news-before.zip` contains the prior live package. Rollback requires a fresh revision ID and a scoped news code update; do not replace the function settings. No rollback was needed.

The news backend and shared storage have now been verified live. Frontend hosting was not deployed during this release; the user's existing timeline frontend can use the updated service. Physical-device verification remains a release follow-up.

Provider search capabilities: [Google News search help](https://support.google.com/googlenews/answer/9005601?hl=en-GB).

## Frontend functionality follow-up - 2026-10-03 (not deployed)

- Save up to 50 story timelines and revisit them from **Saved stories** on the News page. The selected year, month, and order are remembered. Unsaving a timeline does not erase its opened-report history.
- **Read reports**, **Continue story**, and **Next unopened** move keyboard focus and scroll to the relevant headline. Earlier/latest jump controls reveal reports beyond the first page when needed. Reduced-motion preferences are respected.
- Filter the loaded reports by publisher, keyword, and unopened headlines without making another API request. Empty filters can be cleared without changing the subject or date range.
- Group only identical headlines on the same UTC date. Other publishers remain available inside each group. This is conservative duplicate grouping, not inferred event clustering or an AI-authored history.
- Publisher links record that a report was opened, not that it was read or understood. Progress is bounded to the latest 200 report identifiers per subject. Personal history and saved timelines are stored on this device separately for each account, with safe handling of malformed storage and full/disabled storage. They do not sync across devices; the shared news archive remains in DynamoDB unchanged.
- Share a timeline with its subject, year, month, and order. Where native sharing and clipboard access are unavailable, expose a selectable link. The headline that started a journey is retained while exploring the same subject.
- Invalid/future URL date selections are normalized to supported periods instead of producing avoidable server errors.

Verification: 13 frontend unit tests passed. Fixture browser checks at 320, 390, 834, and 1512 pixels covered saving/removal, saved-period restoration, opened-report persistence, account isolation, blocked storage, sharing, filters without network calls, duplicate grouping, and navigation to unloaded reports. Existing cache/error/retry/empty-result regression checks passed. Browser checks against the live backend at 390, 834, and 1512 pixels confirmed recent and historical timelines and pagination. No backend or hosting update was made during this frontend follow-up.
