# Compact News and underline feed navigation

## Frontend

- All posts, News and Videos use an animated underline instead of a boxed segment.
  The shared header, accessible links, 44px touch targets and reduced-motion support
  remain. Saved stays in the main menu, not the top toggle.
- News opens with a compact world/local edition row, a short heading and search.
  The location form opens on demand, replacing duplicate country/state controls.
  Long briefing paragraphs and key developments expand on demand. No summary
  paragraphs are discarded. Sources, story timelines, following, save/share,
  filters, retry and larger reading text remain accessible.
- Reports render before the briefing. Summary-only responses are accepted and
  merged without replacing existing reports. Unrelated editions are rejected.
  Empty sections do not hide valid top-level articles. Malformed responses, prose,
  locations and links are normalized rather than crashing the page.
- Section selection in the briefing uses available summary sections, not only
  report sections. Location-save failure always clears its busy state.
- Small-screen card text clears the floating navigation rail. Legacy fade-from-zero
  animations and large decorative backgrounds are removed from the newsroom.

## Approved News-only backend deployment

On October 13, 2026, the public world-report endpoint returned HTTP 500 after
approximately 21 seconds. CloudWatch confirmed a 20-second Lambda timeout.
With explicit user approval, the existing `news` Lambda in us-east-1 was updated
to the tested parallel report/cache implementation with a 28-second timeout.

Existing role permissions, environment variables, credentials, tables and other
functions were preserved. The configured Terraform timeout was already 28 seconds;
its legacy lifecycle ignores timeout/code drift, so the documented existing code
release procedure was used instead of applying unrelated infrastructure changes.

The old timed-out invocation left a 960-second generation lease. It was allowed to
expire naturally; no records were deleted or forced unlocked. News now explicitly
uses 90-second generation leases, above its 28-second invocation lifetime. Other
consumers retain the original shared helper's 960-second default. If increasing the
News Lambda timeout in future, increase its lease duration to exceed the full runtime.

Final deployed code SHA-256 (base64):
`PjDebw7O0ugQVqv60GpibZ4s9RoW8gf4LfvRV8rSgr0=`

The first live briefing used source-based highlights because the model's generic
overview failed the existing source-grounding check. The prompt now requires every
sentence to retain concrete reported names/events and forbids unsupported generic
transitions. Grounding validation was not weakened. Briefing prompt revision 2
versions only daily briefing records and full-briefing response keys. Report caches
and story archive keys remain unchanged; old saved briefing records were retained.

Opaque rollback package and non-secret metadata are saved at
`/private/tmp/smarty-news-deploy-20261013.1g5SO3/rollback.zip` and
`/private/tmp/smarty-news-deploy-20261013.1g5SO3/rollback-metadata.json`.
The original code hash was verified before deployment. Configuration/code writes
used RevisionId guards. The rollback archive was not inspected for embedded secrets.

## Checks

- 250 frontend tests passed; production build passed.
- 42 News backend tests and 68 generated-content/shared-cache tests passed.
- Browser fixtures at 320, 390, 834 and 1512 pixels checked delayed-summary merging,
  search without extra requests, save, follow failure/retry, location persistence,
  summary sections, mode links, reduced motion, overflow and initial failure/retry.
- Live world reports returned HTTP 200: 60 reports across 11 sections.
- Live full briefing returned HTTP 200 with an editorial overview (2,752 characters)
  and 11 sector digests in 5.71 seconds. The next request reused its saved result in
  0.51 seconds. Individual sector text still falls back to source-based highlights
  if it fails grounding. These checks establish service/cache health, not independent
  verification of every publisher claim.
- Frontend changes remain local until the existing website release is run. This
  News-only deployment did not deploy AIcontent or change publication schedules.
