# Smarty performance pass

## Implemented locally

- Deferred 12 heavy route modules (quiz, progress, game profile, books, reader,
  chat, rooms, lesson, moderation, create and edit). Existing error boundaries
  still handle failed chunks. Authentication checks are unchanged.
- Accessible, theme-aware route skeletons with reduced-motion support.
- Removed the all-in-one vendor bundle. Route dependencies now follow Vite's
  dependency graph. Presentation CSS stays eager to preserve the app's theme
  cascade; this pass deliberately optimizes JavaScript, not CSS payload size.
- Fixed request-cache eviction under capacity pressure: active promises remain
  shared until completion. Settled results remain bounded. Authentication changes
  still clear the cache; failed reads are not retained.
- Coalesced simultaneous profile reads without retaining stale profiles across
  requests. Profile writes invalidate the matching read key.
- Responsive Unsplash feed images with automatic format negotiation and width
  variants. Attribution parameters and crops are preserved. Other URLs,
  including signed media, remain byte-for-byte unchanged. Existing lazy image
  loading stays in place. This does not transcode stored user images.
- Added a 350 KiB gzip startup JavaScript budget and deferred-route assertions.
  CI and future release runs now execute tests and the budget before publishing.

## Verification

- 354 automated tests passed; production build passed.
- Modern startup graph: 296.0 KiB gzip across bootstrap and application scripts.
  Earlier build was approximately 480 KiB including its vendor bundle: about
  38% less startup JavaScript. This is a transfer-size measurement, not a claim
  of an equivalent improvement in real-device loading time.
- Build metadata: `dist/.vite/manifest.json`.
- Run `npm test`, `npm run build`, then `npm run test:performance`.
- For an isolated build: `node scripts/check-performance.mjs /path/to/build`.
- Public hosting check: a current hashed JavaScript asset returned HTTP 200,
  `content-encoding: br`, `x-cache: Hit from cloudfront`, and
  `cache-control: public, max-age=0, s-maxage=31536000`.
  CDN delivery, Brotli and edge caching already exist. Browser immutable caching
  is not enabled by that header and needs a separate hosting configuration change.
- Local production preview verified the route skeleton and deferred quiz load.
  Feed data did not load in that preview: full feed/authenticated smoke tests
  still need a production-equivalent API origin/configuration. This pass does
  not claim those live workflows or slow-device testing passed.

## Existing mechanisms retained

- Universal/chat search debounce and cancellation; topic filtering is local.
- Feed cursors and limits; books pagination; chat-history prefetch near the edge.
- Read-request deduplication and account-cache isolation.
- News/learning shared content caches, browser metadata caches, native downloads.
- External HTTP timeouts and parallel independent provider requests.
- Feed image lazy loading, memoized cards, and optimistic chat messages.
- System-font stacks; no Google Fonts request was found in the entry/styles.

## Remaining checklist: not silently deployed or enabled

| Request | Follow-up / constraint |
| --- | --- |
| Redis | Evaluate cache hit rate first. Visible services already use shared DynamoDB content caches; Redis adds another service and cost. |
| Job queue | Separate worker/retry/dead-letter/idempotency design and infrastructure review are needed for slow generation work. |
| AI token streaming | Requires an end-to-end streaming transport, disconnect handling and stored-answer compatibility. No fake typewriter animation was added. |
| N+1 queries and projections | Audit live access patterns and batched author reads; this pass fixes duplicate profile HTTP reads, not database N+1 queries. |
| Database indexes | Validate existing keys and query telemetry before adding DynamoDB indexes and backfill costs. |
| Database connection pooling | Apply to SQL databases if present; do not add SQL pooling to DynamoDB clients. |
| OpenTelemetry | Instrument backend spans with privacy-safe attributes, sampling and an exporter; needs a backend-specific release. |
| Real-user monitoring | Choose a collector, retention and privacy policy before sending user performance telemetry. |
| Server/database locality | Inspect actual deployments and replication before moving resources. No live region changes. |
| Load balancing | Inspect serverless concurrency/throttling before adding app instances or a paid load balancer. |
| Server/build rendering | Restrict to public pages; do not prerender private feeds, chats or account data. |
| Virtualization | Use a measured target list first; retain keyboard focus, unread anchors and variable-height media. Not blanket CSS hiding. |
| Optimistic updates | Already used for chat; extend mutations only with rollback and permission-error tests. |
| Unused dependencies | Verify scripts/native/backend use before removal. For example google-auth-library is used by the push sender and has a separate service package. |
| Third-party scripts | SDK loading needs login/push regression tests; no authentication or push initialization was deferred blindly. |
| Browser asset caching | Apply immutable headers only to hashed assets; keep HTML/version metadata fresh. Requires hosting release. |
| Slow phones/networks | Real-device and throttled-network tests remain; build-size and local browser tests do not substitute for them. |

Image URL behavior follows the provider's documented width/auto-format support:
https://unsplash.com/documentation#dynamically-resizable-images

No production deployment, database migration, paid service, telemetry collector
or native-app installation is included in this pass.
