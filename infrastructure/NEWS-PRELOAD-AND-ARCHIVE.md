# News warm-up and saved editions

The app warms the selected World or local edition after startup and when returning
online or to the foreground. News tab intent starts the same warm-up immediately.
It loads the route and requests the combined briefing and reports in the background.
The feed's News tab joins that request instead of waiting for a separate reports
request first. When the combined request fails, it can still show current reports.
The full News page keeps the reports-first path so readers can browse while the
briefing prepares. Both views can render a saved device copy immediately. Background warm-up skips
offline, hidden and data-saving sessions. It does not block startup or load every
location. No new server schedule is required.

Reports and briefings retain separate freshness information on the device.
Browsing a saved edition or finishing a summary-only refresh does not renew an
older report list. A degraded response cannot replace better reports already on
the device, and tagged responses for another region are rejected before display
or storage. The News page keeps a dated saved briefing available even when
current reports cannot load.

`DailyNews` still uses its existing public place/date keys and generation lease.
Readers of one place's UTC edition reuse one successfully published briefing, even
when the rolling reports refresh. Successful editions are kept indefinitely, with
no automatic expiration. The same atomic write stores `recordType=daily-briefing`
and `editionArchive` containing
the place and up to 60 public article references (title, publisher, section, date
and source link). The archive does not add article bodies, previews, images or
account data. A saved edition stops being today's briefing at the same UTC day
boundary; it is not deleted. Failed/extractive drafts and rolling caches retain
their existing expiry. Archive storage grows as editions accumulate. This change
does not backfill or change the expiry of previously written records.

The backend can retrieve an archive by place and UTC date with
`read_archived_edition`, without contacting news providers or invoking the model.
If reports fail and no current briefing exists, the live read can show the same
place's previous-day archive, still marked with its original date. That response
is not cached as today's edition. No new table, index or permissions are needed.
On an outage, the app can also show usable rolling reports or today's saved
archive, including its source references. Failed or in-progress briefing
generation returns available reports without presenting a substitute summary
as editorial coverage. Fallback responses aren't cached as fresh, and stale
reports don't trigger a new AI briefing.

## Briefing generation

The same model handles a fresh edition with one request. Identical headlines
within a section are sent once, and small editions get a smaller output budget.
The model is asked to distinguish proposals, announcements and completed events,
and leave the context or outlook blank when the reports do not support it.

Local checks reuse tokenized evidence across the overview, key developments
and sections. A claim must share at least two meaningful headline terms, and
figures in the same claim must occur together in one matching headline.
Unrelated takeaway titles and unsupported details are left out. An incomplete
model response falls back to clearly labeled source highlights. These checks
raise the bar for evidence matching; they do not independently verify claims or
establish that a headline entails every part of the prose. Existing editions
are reused unchanged. No live model call or deployment was made for this change.
