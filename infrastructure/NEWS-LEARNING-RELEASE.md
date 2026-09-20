# News briefings and three daily lessons

## Behavior

- The news page includes a world briefing alongside country/state news. World coverage explicitly collects World, Politics, Business, Technology, Science, Health, Environment, Education, Sports, Culture, and Justice.
- Only timestamped reports from the past 24 hours enter fresh world and local briefings. Duplicates are removed and world sectors are balanced before the 60-story limit. Unavailable sectors are identified rather than invented. Source-based fallback highlights are explicitly distinguished from AI summaries.
- AI targets a 220–320-word overview and 50–90 words per sector, shortened when evidence is limited. Paragraphs, source links, and source-based fallback summaries remain available if AI cannot complete. Summaries remain cached in DailyNews for 20 minutes; the browser cache is versioned separately.
- `Daily_content` changes in place to 08:00, 14:00, and 20:00 Asia/Calcutta (IST), with one learning post per invocation and no flexible delay. The existing reminder schedule is unchanged.
- Scheduled timestamps produce deterministic post IDs. Repeated deliveries reuse the published post; concurrent writes cannot publish duplicate posts for the same scheduled instant. Failed scheduled generations raise errors so Lambda records the failure and can retry. Topic and subtopic rotation and quality checks remain in place.

## Release order

These repository changes do not activate the live schedule by themselves.

1. Run the news and content unit tests and the web build.
2. Run `bash scripts/package-news-learning.sh` from the repository root. It writes two clean zip files to a new temporary release directory.
3. Deploy **AIcontent.zip first**, including both Python files, to the existing `AIcontent` Lambda in `us-east-1`; wait for its code update to finish. This installs duplicate protection before increasing the frequency.
4. Deploy `news.zip` to the existing `news` Lambda, and set its timeout to **28 seconds**. Preserve all existing environment variables, roles, and other settings. The browser allows 30 seconds. The Terraform Lambda module currently ignores code and timeout changes, so Terraform alone will not deploy these two updates.
5. Review a Terraform plan scoped to `module.scheduler.aws_scheduler_schedule.this["Daily_content"]`, then apply that reviewed plan. Confirm three daily times, IST, window OFF, and the scheduled-time payload. Do not create an additional schedule or remove the existing one.
6. Deploy the web build through the existing Amplify release workflow. Old news caches use version 19; the new client/backend use version 20.

## Verification

Local verification on 2026-09-20: 12 news tests, 11 generated-content tests, and 20 authentication tests passed; the production web build passed. Mock-data browser checks at 390, 820, and 1440 pixels confirmed 11 world sectors, working sector navigation, no horizontal overflow, and no browser runtime errors. Terraform validation and formatting passed. These checks do not replace live provider/model and scheduled-run verification after deployment.

The broader learning-journey suite has one existing failure (8 of 9 pass): its recommendation question assertion expects “behave differently” while the unchanged implementation returns “Predict first…”. Neither that implementation nor its test was changed in this release.

- Check a local country/state view and the separate world briefing on phone, tablet, and desktop.
- Verify original report links, sector selection, refresh, and a failed-provider fallback.
- After the next scheduled run, verify exactly one new `scheduled-learning-…` post. Replaying that same scheduled timestamp must return the saved post without another AI call.
- Monitor generation failures and duration after deployment. Briefings must disclose limited coverage instead of suggesting that every world event is covered.

Scheduler context attributes follow the [AWS Scheduler documentation](https://docs.aws.amazon.com/scheduler/latest/UserGuide/managing-schedule-context-attributes.html).
