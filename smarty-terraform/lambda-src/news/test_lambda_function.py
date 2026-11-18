import json
import os
import sys
import types
import unittest
from contextlib import nullcontext
from pathlib import Path
from unittest.mock import patch


os.environ.setdefault("AWS_EC2_METADATA_DISABLED", "true")
sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "infrastructure" / "shared"))

class _Attr:
    def __init__(self, *args): pass
    def not_exists(self): return self
    def lte(self, value): return self
    def eq(self, value): return self
    def __or__(self, other): return self

boto3_conditions = types.ModuleType("boto3.dynamodb.conditions")
boto3_conditions.Attr = _Attr
sys.modules.setdefault("boto3.dynamodb.conditions", boto3_conditions)


class _DummyTable:
    def get_item(self, **_kwargs):
        return {}

    def put_item(self, **_kwargs):
        return None


class _DummyDynamo:
    def Table(self, _name):
        return _DummyTable()


class _DummyBedrock:
    def converse(self, **_kwargs):
        raise RuntimeError("Bedrock is disabled in unit tests.")


class _Config:
    def __init__(self, **_kwargs):
        pass


class _BotoCoreError(Exception):
    pass


class _ClientError(Exception):
    response = {"Error": {"Code": "TestError"}}


boto3_module = types.ModuleType("boto3")
boto3_module.resource = lambda *_args, **_kwargs: _DummyDynamo()
boto3_module.client = lambda *_args, **_kwargs: _DummyBedrock()
botocore_module = types.ModuleType("botocore")
botocore_config_module = types.ModuleType("botocore.config")
botocore_config_module.Config = _Config
botocore_exceptions_module = types.ModuleType("botocore.exceptions")
botocore_exceptions_module.BotoCoreError = _BotoCoreError
botocore_exceptions_module.ClientError = _ClientError
sys.modules.setdefault("boto3", boto3_module)
sys.modules.setdefault("botocore", botocore_module)
sys.modules.setdefault("botocore.config", botocore_config_module)
sys.modules.setdefault("botocore.exceptions", botocore_exceptions_module)

import lambda_function as news


def make_article(identifier, title, section, published_at, source="Test Wire"):
    return {
        "id": identifier,
        "title": title,
        "summary": "",
        "news_link": f"https://example.com/{identifier}",
        "image_link": "",
        "published_at": published_at,
        "source": source,
        "source_country": "India",
        "language": "English",
        "section": section,
        "provider": "Test",
        "rank": 0,
    }


class NewsLambdaTests(unittest.TestCase):
    def test_local_daily_edition_reuses_saved_summary_and_isolates_regions(self):
        store = {}
        def save(key, payload, fresh_until=None):
            store[key] = {"payload": payload, "freshUntil": fresh_until}
        with (patch.object(news, "get_cached", side_effect=lambda key: store.get(key)),
              patch.object(news, "set_cached", side_effect=save),
              patch.object(news, "generation_lease", side_effect=lambda *args: nullcontext()),
              patch.object(news, "build_daily_summary", return_value={"summaryMode": "editorial", "overview": "Daily local news"}) as build):
            first = news.get_world_daily_summary([], news.make_location("IN", "Tamil Nadu"))
            second = news.get_world_daily_summary([{"new": "headlines"}], news.make_location("IN", "Tamil Nadu"))
            self.assertEqual(first, second)
            self.assertEqual(build.call_count, 1)
            news.get_world_daily_summary([], news.make_location("IN", "Kerala"))
            self.assertEqual(build.call_count, 2)

    def test_reports_route_stores_shared_reports_without_running_summary_model(self):
        with (patch.object(news, "get_cached", return_value=None),
              patch.object(news, "generation_lease", return_value=nullcontext()),
              patch.object(news, "build_reports_payload", return_value={"articles": [{"id": "one"}]}) as reports,
              patch.object(news, "set_cached") as save,
              patch.object(news, "build_daily_summary") as model):
            result = news.lambda_handler({"queryStringParameters": {"view": "reports"}}, None)
            self.assertEqual(result["statusCode"], 200)
            self.assertTrue(save.call_args.args[0].endswith("#reports"))
            reports.assert_called_once()
            model.assert_not_called()

    def test_prompt_revision_only_versions_briefings_not_reports_or_history(self):
        location = news.make_location("GLOBAL", "")
        reports_key = news.make_cache_key(location) + "#reports"
        with (patch.object(news, "get_cached", return_value=None),
              patch.object(news, "generation_lease", side_effect=lambda *args: nullcontext()),
              patch.object(news, "build_payload", return_value={"articles": []}),
              patch.object(news, "set_cached") as save):
            news.lambda_handler({"queryStringParameters": {"country": "GLOBAL"}}, None)
            self.assertEqual(save.call_args.args[0], news.make_cache_key(location) + f"#briefing-v{news.BRIEFING_VERSION}")
            self.assertNotIn("briefing-v", reports_key)
        with (patch.object(news, "get_cached", return_value=None),
              patch.object(news, "generation_lease", side_effect=lambda *args: nullcontext()),
              patch.object(news, "build_daily_summary", return_value={"summaryMode": "editorial"}),
              patch.object(news, "set_cached") as save):
            news.get_world_daily_summary([], location)
            self.assertTrue(save.call_args.args[0].endswith(f"#briefing-v{news.BRIEFING_VERSION}"))

    def test_full_briefing_reuses_previously_loaded_reports(self):
        cached = {"freshUntil": int(news.time.time()) + 600, "payload": {"articles": [{"id": "one"}], "sections": {}}}
        with (patch.object(news, "get_cached", return_value=cached),
              patch.object(news, "build_reports_payload") as providers,
              patch.object(news, "get_world_daily_summary", return_value={"overview": "Daily summary"})):
            result = news.build_payload(news.make_location("IN", "Tamil Nadu"))
            self.assertEqual(result["dailySummary"]["overview"], "Daily summary")
            providers.assert_not_called()
            self.assertNotIn("dailySummary", cached["payload"])

    def test_reports_outage_can_serve_the_same_location_saved_briefing_without_writes(self):
        location = news.make_location("IN", "Tamil Nadu")
        summary = {"summaryMode": "editorial", "overview": "Already published for Tamil Nadu."}
        saved = {"freshUntil": int(news.time.time()) + 300, "payload": summary}
        def lookup(key):
            return saved if key.startswith("local-briefing-") else None

        with (patch.object(news, "get_cached", side_effect=lookup),
              patch.object(news, "generation_lease", return_value=nullcontext()),
              patch.object(news, "build_reports_payload", side_effect=RuntimeError("Sources unavailable")),
              patch.object(news, "build_daily_summary") as generate,
              patch.object(news, "set_cached") as save):
            result = news.lambda_handler({"queryStringParameters": {"country": "IN", "region": "Tamil Nadu"}}, None)
            body = json.loads(result["body"])
            self.assertEqual(result["statusCode"], 200)
            self.assertEqual(result["headers"]["Cache-Control"], "no-store")
            self.assertEqual(body["location"]["region"], location["region"])
            self.assertEqual(body["dailySummary"], summary)
            self.assertEqual(body["articles"], [])
            generate.assert_not_called()
            save.assert_not_called()

    def test_reports_outage_does_not_generate_a_briefing_without_any_reports(self):
        with (patch.object(news, "get_cached", return_value=None),
              patch.object(news, "generation_lease", return_value=nullcontext()),
              patch.object(news, "build_reports_payload", side_effect=RuntimeError("Sources unavailable")),
              patch.object(news, "build_daily_summary") as generate):
            result = news.lambda_handler({"queryStringParameters": {"country": "IN", "region": "Tamil Nadu"}}, None)
            self.assertEqual(result["statusCode"], 503)
            generate.assert_not_called()

    def test_daily_edition_failure_keeps_fresh_reports_visible_and_uncached(self):
        location = news.make_location("IN", "Tamil Nadu")
        articles = [make_article("one", "Rail service expands", "Local", "")]
        reports = {"location": location, "articles": articles, "sections": {"Local": articles}}
        for error in (news.GenerationBusy(), _ClientError(), _BotoCoreError()):
            with (self.subTest(error=type(error).__name__),
                  patch.object(news, "get_cached", return_value=None),
                  patch.object(news, "generation_lease", return_value=nullcontext()),
                  patch.object(news, "get_or_build_reports", return_value=reports),
                  patch.object(news, "get_world_daily_summary", side_effect=error),
                  patch.object(news, "set_cached") as save):
                result = news.lambda_handler({"queryStringParameters": {"country": "IN", "region": "Tamil Nadu"}}, None)
                payload = json.loads(result["body"])
                self.assertEqual(result["statusCode"], 200)
                self.assertEqual(result["headers"]["Cache-Control"], "no-store")
                self.assertEqual(payload["articles"], articles)
                self.assertIsNone(payload["dailySummary"])
                self.assertEqual(payload["cacheStatus"], "stale-cache")
                save.assert_not_called()

    def test_stale_rolling_reports_do_not_generate_a_new_briefing(self):
        now = int(news.time.time())
        location = news.make_location("IN", "Tamil Nadu")
        articles = [make_article("one", "Rail service expands", "Local", "")]
        reports = {"location": location, "articles": articles, "generatedAt": "original-time"}
        stored = {"payload": reports, "freshUntil": now - 1, "expiresAt": now + 300}
        with (patch.object(news, "get_cached", side_effect=lambda key: stored if key.endswith("#reports") else None),
              patch.object(news, "generation_lease", return_value=nullcontext()),
              patch.object(news, "build_reports_payload", side_effect=RuntimeError("Sources unavailable")),
              patch.object(news, "build_daily_summary") as generate,
              patch.object(news, "set_cached") as save):
            result = news.lambda_handler({"queryStringParameters": {"country": "IN", "region": "Tamil Nadu"}}, None)
            self.assertEqual(result["statusCode"], 200)
            self.assertEqual(result["headers"]["Cache-Control"], "no-store")
            payload = json.loads(result["body"])
            self.assertEqual(payload["articles"], articles)
            self.assertEqual(payload["generatedAt"], "original-time")
            self.assertIsNone(payload["dailySummary"])
            self.assertNotIn("cacheStatus", reports)
            generate.assert_not_called()
            save.assert_not_called()

    def test_busy_cold_briefing_uses_already_loaded_reports(self):
        now = int(news.time.time())
        articles = [make_article("one", "Rail service expands", "Local", "")]
        saved = {"payload": {"articles": articles}, "freshUntil": now + 60}
        with (patch.object(news, "get_cached", side_effect=lambda key: saved if key.endswith("#reports") else None),
              patch.object(news, "generation_lease", side_effect=news.GenerationBusy()),
              patch.object(news, "build_payload") as build):
            result = news.lambda_handler({}, None)
        self.assertEqual(result["statusCode"], 200)
        self.assertEqual(result["headers"]["Cache-Control"], "no-store")
        self.assertEqual(json.loads(result["body"])["articles"], articles)
        build.assert_not_called()

    def test_published_edition_and_public_references_are_archived_in_one_write(self):
        start = int(news.datetime(2026, 9, 22, 8, tzinfo=news.timezone.utc).timestamp())
        date = "2026-09-22"
        location = news.make_location("IN", "Tamil Nadu")
        article = {**make_article("one", "Marine survey begins", "Science", f"{date}T00:00:00Z"),
                   "summary": "Provider excerpt", "image_link": "https://example.com/photo"}
        store = {}
        def save(Item):
            store[Item["date"]] = Item

        with (patch.object(news.time, "time", return_value=start),
              patch.object(news.NEWS_CACHE, "get_item", side_effect=lambda Key, **_: {"Item": store.get(Key["date"])}),
              patch.object(news.NEWS_CACHE, "put_item", side_effect=save) as write,
              patch.object(news, "generation_lease", return_value=nullcontext()),
              patch.object(news, "build_daily_summary", return_value={"summaryMode": "editorial", "overview": "The marine survey began."}) as generate):
            first = news.get_world_daily_summary([article], location)
            second = news.get_world_daily_summary([article], location)
            self.assertEqual(first, second)
            archived = news.read_archived_edition(location, date, start + 3650 * 86400)
            self.assertEqual(archived["dailySummary"], first)
            self.assertEqual(archived["articles"], [news.story_reference(article)])
            self.assertNotIn("summary", archived["articles"][0])
            self.assertNotIn("image_link", archived["articles"][0])
            self.assertIsNone(news.read_archived_edition(news.make_location("IN", "Kerala"), date, start))
            record = store[news.daily_briefing_key(location, date)]
            self.assertNotIn("expiresAt", record)
            self.assertEqual(record["freshUntil"], int(news.datetime(2026, 9, 23, tzinfo=news.timezone.utc).timestamp()))
            write.assert_called_once()
            generate.assert_called_once()

    def test_temporary_cache_records_still_expire(self):
        start = 1700000000
        with (patch.object(news.time, "time", return_value=start),
              patch.object(news.NEWS_CACHE, "put_item") as write):
            news.set_cached("rolling-reports", {"articles": []})
        item = write.call_args.kwargs["Item"]
        self.assertEqual(item["expiresAt"], start + news.STALE_TTL_SECONDS)
        self.assertNotIn("editionArchive", item)

    def test_cold_outage_reuses_yesterdays_archive_without_ai_or_new_writes(self):
        start = int(news.datetime(2026, 9, 23, 8, tzinfo=news.timezone.utc).timestamp())
        location = news.make_location("GLOBAL", "")
        article = make_article("one", "Marine survey begins", "Science", "2026-09-22T00:00:00Z")
        summary = {"summaryMode": "editorial", "overview": "The marine survey began.", "editionDate": "2026-09-22"}
        archived = {"recordType": "daily-briefing", "payload": summary,
                    "editionArchive": news.edition_archive_for(summary, location, [article])}
        key = news.daily_briefing_key(location, "2026-09-22")
        with (patch.object(news.time, "time", return_value=start),
              patch.object(news, "get_cached", side_effect=lambda cache_key: archived if cache_key == key else None),
              patch.object(news, "generation_lease", return_value=nullcontext()),
              patch.object(news, "build_reports_payload", side_effect=RuntimeError("Sources unavailable")),
              patch.object(news, "build_daily_summary") as generate,
              patch.object(news, "set_cached") as save):
            result = news.lambda_handler({}, None)
        self.assertEqual(result["statusCode"], 200)
        self.assertEqual(result["headers"]["Cache-Control"], "no-store")
        self.assertEqual(json.loads(result["body"])["dailySummary"], summary)
        self.assertEqual(json.loads(result["body"])["articles"], [news.story_reference(article)])
        generate.assert_not_called()
        save.assert_not_called()

    def test_cold_outage_restores_todays_archived_articles_with_the_briefing(self):
        now = int(news.datetime(2026, 9, 23, 8, tzinfo=news.timezone.utc).timestamp())
        location = news.make_location("IN", "Tamil Nadu")
        edition_date = "2026-09-23"
        article = make_article("one", "Marine survey begins", "Science", f"{edition_date}T00:00:00Z")
        summary = {"summaryMode": "editorial", "overview": "The marine survey began.",
                   "editionDate": edition_date, "generatedAt": f"{edition_date}T08:00:00Z"}
        saved = {"recordType": "daily-briefing", "payload": summary, "freshUntil": now + 300,
                 "editionArchive": news.edition_archive_for(summary, location, [article])}
        with (patch.object(news.time, "time", return_value=now),
              patch.object(news, "get_or_build_reports", side_effect=TimeoutError()),
              patch.object(news, "get_cached", return_value=saved) as cache,
              patch.object(news, "build_daily_summary") as generate):
            payload = news.build_payload(location)
        cache.assert_called_once_with(news.daily_briefing_key(location, edition_date))
        self.assertEqual(payload["dailySummary"], summary)
        self.assertEqual(payload["articles"], [news.story_reference(article)])
        self.assertEqual(payload["generatedAt"], summary["generatedAt"])
        self.assertEqual(payload["cacheStatus"], "stale-cache")
        generate.assert_not_called()

    def test_archive_references_stay_inside_the_storage_budget(self):
        location = news.make_location("GLOBAL", "")
        article = make_article("one", "Marine survey begins", "Science", "")
        oversized = {**article, "news_link": "https://example.com/" + "x" * news.MAX_EDITION_ARCHIVE_BYTES}
        archive = news.edition_archive_for({"overview": "A short briefing."}, location, [oversized, article])
        self.assertEqual(archive["articles"], [news.story_reference(article)])

    def test_world_edition_is_shared_for_whole_day_and_changes_next_day(self):
        location = news.make_location("GLOBAL", "")
        start = int(news.datetime(2026, 9, 22, 8, tzinfo=news.timezone.utc).timestamp())
        store = {}
        def save(key, payload, fresh_until=None):
            store[key] = {"payload": payload, "freshUntil": fresh_until}
        with (patch.object(news.time, "time", return_value=start) as clock,
              patch.object(news, "get_cached", side_effect=lambda key: store.get(key)),
              patch.object(news, "set_cached", side_effect=save),
              patch.object(news, "generation_lease", side_effect=lambda *args: nullcontext()),
              patch.object(news, "build_daily_summary", side_effect=lambda *args: {"summaryMode": "editorial", "overview": "Shared world edition"}) as generate):
            first = news.get_world_daily_summary([], location)
            clock.return_value = start + 10 * 3600
            second = news.get_world_daily_summary([{"new": "headlines"}], location)
            self.assertEqual(first, second)
            self.assertEqual(generate.call_count, 1)
            self.assertEqual(first["editionDate"], "2026-09-22")
            self.assertEqual(first["nextEditionAt"], "2026-09-23T00:00:00+00:00")
            clock.return_value = start + 86400
            third = news.get_world_daily_summary([], location)
            self.assertEqual(third["editionDate"], "2026-09-23")
            self.assertEqual(generate.call_count, 2)

    def test_world_ai_failure_is_not_cached_for_the_entire_day(self):
        start = int(news.datetime(2026, 9, 22, 8, tzinfo=news.timezone.utc).timestamp())
        with (patch.object(news.time, "time", return_value=start),
              patch.object(news, "get_cached", return_value=None),
              patch.object(news, "generation_lease", return_value=nullcontext()),
              patch.object(news, "build_daily_summary", return_value={"summaryMode": "extractive"}),
              patch.object(news, "set_cached") as save):
            news.get_world_daily_summary([], news.make_location("GLOBAL", ""))
            self.assertEqual(save.call_args.kwargs["fresh_until"], start + news.BRIEFING_RETRY_SECONDS)
            self.assertNotIn("edition_archive", save.call_args.kwargs)

    def test_combined_fallback_does_not_extend_the_summary_retry_window(self):
        generated = news.datetime.now(news.timezone.utc).replace(microsecond=0)
        fallback = {"articles": [], "dailySummary": {"summaryMode": "extractive", "generatedAt": generated.isoformat()}}
        with (patch.object(news, "get_cached", return_value=None),
              patch.object(news, "generation_lease", return_value=nullcontext()),
              patch.object(news, "build_payload", return_value=fallback),
              patch.object(news, "set_cached") as save):
            response = news.lambda_handler({}, None)
        self.assertEqual(response["statusCode"], 200)
        self.assertEqual(save.call_args.kwargs["fresh_until"], int(generated.timestamp()) + news.BRIEFING_RETRY_SECONDS)
        self.assertEqual(response["headers"]["Cache-Control"], "public, max-age=60, must-revalidate")

    def test_world_edition_rechecks_storage_after_acquiring_lease(self):
        cached = {"freshUntil": int(news.time.time()) + 600, "payload": {"summaryMode": "editorial"}}
        with (patch.object(news, "get_cached", side_effect=[None, cached]),
              patch.object(news, "generation_lease", return_value=nullcontext()),
              patch.object(news, "build_daily_summary") as generate):
            self.assertEqual(news.get_world_daily_summary([], news.make_location("GLOBAL", "")), cached["payload"])
            generate.assert_not_called()

    def test_world_cache_failure_does_not_generate_uncached_briefings(self):
        with (patch.object(news, "get_cached", side_effect=_ClientError()),
              patch.object(news, "build_daily_summary") as generate):
            with self.assertRaises(_ClientError):
                news.get_world_daily_summary([], news.make_location("GLOBAL", ""))
            generate.assert_not_called()

    def test_world_cache_write_failure_does_not_return_an_unsaved_edition(self):
        with (patch.object(news, "get_cached", return_value=None),
              patch.object(news, "generation_lease", return_value=nullcontext()),
              patch.object(news, "build_daily_summary", return_value={"summaryMode": "editorial"}),
              patch.object(news, "set_cached", side_effect=_ClientError())):
            with self.assertRaises(_ClientError):
                news.get_world_daily_summary([], news.make_location("GLOBAL", ""))

    def test_unrelated_overview_is_rejected(self):
        articles = [make_article("one", "Researchers map a deep ocean habitat", "Science", "")]
        with self.assertRaisesRegex(ValueError, "grounded"):
            news.validate_editorial_summary({"overview": "Parliament approved an enormous tax increase affecting every household in the entire country this morning."}, articles, ["Science"])

    def test_overlapping_names_do_not_ground_an_invented_or_combined_figure(self):
        articles = [
            make_article("buses", "Transit agency approves 15 electric buses for downtown routes", "Local", ""),
            make_article("depots", "Transit agency approves electric bus depot work at 8 sites", "Local", ""),
        ]
        accepted = "The transit agency approved 15 electric buses for downtown routes."
        self.assertEqual(
            news.validate_editorial_summary({"overview": accepted}, articles, ["Local"])["overview"],
            accepted,
        )
        for claim in (
            "The transit agency approved 500 electric buses for downtown routes.",
            "The transit agency approved 15 electric buses for downtown routes at 8 sites.",
            accepted + " 8 people died.",
        ):
            with self.subTest(claim=claim), self.assertRaisesRegex(ValueError, "grounded"):
                news.validate_editorial_summary({"overview": claim}, articles, ["Local"])

    def test_one_shared_topic_word_does_not_ground_a_new_development(self):
        articles = [make_article("mars", "NASA launches a Mars rover to study ancient riverbeds", "Science", "")]
        invented = "Parliament approved a major tax package affecting commercial activity on Mars."
        with self.assertRaisesRegex(ValueError, "grounded"):
            news.validate_editorial_summary({"overview": invented}, articles, ["Science"])

    def test_takeaways_keep_supported_claims_and_omit_unsupported_clauses(self):
        articles = [
            make_article("buses", "Transit agency approves 15 electric buses for downtown routes", "Local", ""),
            make_article("riverbeds", "NASA launches a Mars rover to study ancient riverbeds", "Science", ""),
        ]
        result = news.validate_editorial_summary({
            "overview": "The transit agency approved 15 electric buses for downtown routes. NASA launched a Mars rover to study ancient riverbeds.",
            "takeaways": [
                {
                    "title": "Electric buses approved",
                    "summary": "The transit agency approved 15 electric buses for downtown routes.",
                },
                {
                    "title": "Mars rover launches",
                    "summary": "The Mars rover will study ancient riverbeds. Parliament approved a tax increase for the mission.",
                },
                {
                    "title": "Parliament approved tax increases",
                    "summary": "NASA launched a Mars rover to study ancient riverbeds.",
                },
            ],
        }, articles, ["Local", "Science"])
        self.assertEqual(len(result["keyTakeaways"]), 1)
        self.assertEqual([story["id"] for story in result["keyTakeaways"][0]["stories"]], ["buses"])

    def test_partial_editorial_takeaways_are_kept_in_the_daily_briefing(self):
        articles = [
            make_article("buses", "Transit agency approves 15 electric buses for downtown routes", "Local", ""),
            make_article("riverbeds", "NASA launches a Mars rover to study ancient riverbeds", "Science", ""),
        ]
        accepted = {"title": "Electric bus approval", "summary": articles[0]["title"], "stories": [news.story_reference(articles[0])]}
        with patch.object(news, "generate_editorial_summary", return_value={
            "overview": articles[0]["title"],
            "summaryMode": "editorial",
            "keyTakeaways": [accepted],
            "sectionSummaries": {},
        }):
            result = news.build_daily_summary(articles, news.make_location("GLOBAL", ""))
        self.assertIn(accepted, result["keyTakeaways"])

    def test_non_completed_model_responses_do_not_publish_valid_looking_text(self):
        headline = "Researchers map a deep ocean habitat before a planned marine survey"
        article = make_article("one", headline, "Science", "")
        output = {"message": {"content": [{"text": f"OVERVIEW: {headline}."}]}}
        for stop in ("max_tokens", "content_filtered", "guardrail_intervened", "tool_use", None):
            with self.subTest(stop=stop), patch.object(news.BEDROCK_RUNTIME, "converse", return_value={
                "output": output, "stopReason": stop,
            }) as model:
                result = news.generate_editorial_summary([article], news.make_location("GLOBAL", ""), ["Science"])
                self.assertIsNone(result)
                model.assert_called_once()

    def test_duplicate_reporting_only_enters_the_prompt_once(self):
        headline = "Researchers map a deep ocean habitat before a planned marine survey"
        first = make_article("one", headline, "Science", "")
        duplicate = make_article("two", headline.upper() + ".", "Science", "", source="Test Wire Two")
        extra = make_article("three", "Astronomers discover a new planet around a nearby star", "Science", "")
        response = {"output": {"message": {"content": [{"text": f"OVERVIEW: {headline}."}]}}, "stopReason": "end_turn"}
        location = news.make_location("GLOBAL", "")
        with patch.object(news.BEDROCK_RUNTIME, "converse", return_value=response) as model:
            self.assertIsNotNone(news.generate_editorial_summary([first, duplicate], location, ["Science"]))
            initial = model.call_args.kwargs
            self.assertEqual(initial["messages"][0]["content"][0]["text"].casefold().count(headline.casefold()), 1)
            news.generate_editorial_summary([first, duplicate, extra], location, ["Science"])
            self.assertLess(initial["inferenceConfig"]["maxTokens"], model.call_args.kwargs["inferenceConfig"]["maxTokens"])

    def test_empty_evidence_does_not_call_the_model(self):
        with patch.object(news.BEDROCK_RUNTIME, "converse") as model:
            self.assertIsNone(news.generate_editorial_summary([], news.make_location("GLOBAL", ""), []))
            model.assert_not_called()

    def test_briefing_prompt_keeps_concrete_reporting_without_generic_transitions(self):
        headline = "Researchers map a deep ocean habitat before a planned marine survey"
        article = make_article("one", headline, "Science", "")
        response = {"output": {"message": {"content": [{"text":
            f"OVERVIEW: {headline}. {headline}.\nSECTION_1_SUMMARY: {headline}."
        }]}}, "stopReason": "end_turn"}
        with patch.object(news.BEDROCK_RUNTIME, "converse", return_value=response) as model:
            result = news.generate_editorial_summary([article], news.make_location("GLOBAL", ""), ["Science"])
            prompt = model.call_args.kwargs["messages"][0]["content"][0]["text"]
            self.assertIn("Every sentence, including each opening and closing sentence", prompt)
            self.assertIn("Do not add generic scene-setting", prompt)
            self.assertIn("Prefer one reported development per sentence", prompt)
            self.assertIn(headline, prompt)
            self.assertEqual(result["summaryMode"], "editorial")

    def test_small_editions_request_one_supported_takeaway_without_padding(self):
        headline = "Researchers map a deep ocean habitat before a planned marine survey"
        article = make_article("one", headline, "Science", "")
        text = f"OVERVIEW: {headline}.\nTAKEAWAY_1_TITLE: Ocean habitat map\nTAKEAWAY_1_SUMMARY: {headline}.\nSECTION_1_SUMMARY: {headline}."
        response = {"output": {"message": {"content": [{"text": text}]}}, "stopReason": "end_turn"}
        with patch.object(news.BEDROCK_RUNTIME, "converse", return_value=response) as model:
            result = news.generate_editorial_summary([article], news.make_location("IN", "Tamil Nadu"), ["Science"])
        prompt = model.call_args.kwargs["messages"][0]["content"][0]["text"]
        self.assertIn("Include 1 takeaway(s)", prompt)
        self.assertNotIn("TAKEAWAY_2_TITLE", prompt)
        self.assertEqual(len(result["keyTakeaways"]), 1)
        self.assertEqual(result["sectionSummaries"]["Science"], headline + ".")

    def test_numeric_matching_preserves_units_and_uses_only_shown_headlines(self):
        headline = "City transit agency plans to add 1,000 buses to existing downtown routes"
        article = make_article("one", headline + (" overflow" * 25) + " for 20 years", "Local", "")
        evidence = news.BriefingEvidence([article])
        self.assertTrue(evidence.score("City transit agency plans to add 1000 buses to downtown routes"))
        self.assertFalse(evidence.score("City transit agency plans to add 1000 million buses to downtown routes"))
        self.assertFalse(evidence.score("City transit agency plans to add 1000 buses to downtown routes for 20 years"))
        self.assertEqual(news.reported_figures("a 15 percent increase"), {"15%"})
        self.assertNotEqual(news.reported_figures("$15"), news.reported_figures("15"))

    def test_generic_sentence_still_rejects_an_otherwise_supported_overview(self):
        headline = "Researchers map a deep ocean habitat before a planned marine survey"
        articles = [make_article("one", headline, "Science", "")]
        with self.assertRaisesRegex(ValueError, "grounded"):
            news.validate_editorial_summary({"overview":
                f"{headline}. These developments highlight rapid change across the world."
            }, articles, ["Science"])

    def test_context_fields_are_parsed_and_unsupported_context_is_omitted(self):
        headline = "Researchers map a deep ocean habitat before a planned marine survey"
        articles = [make_article("one", headline, "Science", "")]
        parsed = news.parse_editorial_fields(
            f"OVERVIEW: {headline}. {headline}.\nSECTION_1_SUMMARY: {headline}.\n"
            f"SECTION_1_CONTEXT: {headline}.\nSECTION_1_NEXT: A surprise election will change the government next week.", ["Science"])
        result = news.validate_editorial_summary(parsed, articles, ["Science"])
        self.assertIn("context", result["sectionContext"]["Science"])
        self.assertNotIn("next", result["sectionContext"]["Science"])

    def test_daily_window_excludes_undated_stale_and_future_reports(self):
        now = news.datetime.now(news.timezone.utc)
        articles = [make_article("current", "Current news", "World", now.isoformat()),
                    make_article("undated", "Unknown date", "World", ""),
                    make_article("old", "Old news", "World", "2020-01-01T00:00:00Z"),
                    make_article("future", "Future news", "World", "2099-01-01T00:00:00Z")]
        self.assertEqual([item["id"] for item in news.current_articles(articles)], ["current"])

    def test_world_balance_keeps_small_sectors_and_rejects_old_reports(self):
        now = news.datetime.now(news.timezone.utc).isoformat()
        old = "2020-01-01T00:00:00Z"
        articles = [make_article(str(i), f"Business development {i}", "Business", now)
                    for i in range(80)]
        articles += [make_article(sector, f"New {sector} development", sector, now)
                     for sector in news.WORLD_SECTORS if sector != "Business"]
        articles.append(make_article("old", "Outdated report", "World", old))
        balanced = news.balance_world_articles(articles)
        self.assertEqual(len(balanced), news.MAX_ARTICLES)
        self.assertEqual(set(item["section"] for item in balanced), set(news.WORLD_SECTORS))
        self.assertNotIn("old", [item["id"] for item in balanced])

    def test_world_feeds_fetch_every_sector_and_survive_one_failed_source(self):
        location = news.make_location("GLOBAL", "")
        now = news.datetime.now(news.timezone.utc).isoformat()
        article = make_article("one", "New development", "World", now)
        def fetch(url, params, timeout):
            self.assertEqual(timeout, 3)
            self.assertIn("when:1d", params["q"])
            if "climate" in params["q"]:
                raise TimeoutError()
            return params
        with (patch.object(news, "fetch_xml", side_effect=fetch) as fetcher,
              patch.object(news, "normalize_google_articles", return_value=[article])):
            articles = news.fetch_google_articles(location)
        self.assertEqual(fetcher.call_count, len(news.WORLD_SECTORS))
        self.assertEqual(len(articles), len(news.WORLD_SECTORS) - 1)
        self.assertNotIn("Environment", [item["section"] for item in articles])

    def test_long_editorial_sections_are_not_cut_to_the_old_short_limit(self):
        title = "Researchers map a deep ocean habitat"
        article = make_article("science", title, "Science", "")
        paragraph = (title + ". ") * 15
        result = news.validate_editorial_summary({
            "overview": paragraph * 3,
            "sections": [{"section": "Science", "summary": paragraph}],
        }, [article], ["Science"])
        self.assertGreater(len(result["overview"]), 1400)
        self.assertGreater(len(result["sectionSummaries"]["Science"]), 480)

    def test_briefing_marks_unavailable_sectors_and_keeps_source_links(self):
        location = news.make_location("GLOBAL", "")
        article = make_article("science", "Researchers map a deep ocean habitat", "Science", "")
        with patch.object(news, "generate_editorial_summary", return_value=None):
            result = news.build_daily_summary([article], location)
        self.assertIn("Health", result["unavailableSectors"])
        self.assertNotIn("Science", result["unavailableSectors"])
        self.assertTrue(result["overviewParagraphs"])
        self.assertEqual(result["sectionDigests"][0]["topStories"][0]["news_link"], article["news_link"])

    def test_extended_fallback_keeps_more_developments_in_readable_paragraphs(self):
        location = news.make_location("GLOBAL", "")
        articles = [make_article(str(i), f"Researchers map ocean habitat number {i}", "Science", "") for i in range(10)]
        with patch.object(news, "generate_editorial_summary", return_value=None):
            result = news.build_daily_summary(articles, location)
        digest = result["sectionDigests"][0]
        self.assertIn("habitat number 7", digest["summary"])
        self.assertNotIn("habitat number 8", digest["summary"])
        self.assertEqual(len(digest["summaryParagraphs"]), 3)
        self.assertEqual(" ".join(digest["summaryParagraphs"]), digest["summary"])
        self.assertEqual(" ".join(result["overviewParagraphs"]), result["overview"])

    def test_long_section_text_is_preserved_above_previous_limit(self):
        article = make_article("science", "Researchers map a deep ocean habitat", "Science", "")
        summary = (article["title"] + ". ") * 48
        result = news.validate_editorial_summary({
            "overview": summary * 2,
            "sections": [{"section": "Science", "summary": summary}],
        }, [article], ["Science"])
        self.assertEqual(result["sectionSummaries"]["Science"], summary.strip())
        self.assertGreater(len(result["overview"]), 3400)

    def test_classifier_prioritizes_specific_sections_and_word_variants(self):
        self.assertEqual(
            news.classify_article("Government opens hospitals for cancer patients"),
            "Health",
        )
        self.assertEqual(
            news.classify_article("Hurricane warnings issued as storms approach"),
            "Environment",
        )
        self.assertEqual(
            news.classify_article("Court sentences defendant after criminal trial"),
            "Justice",
        )

    def test_unknown_country_is_rejected(self):
        with self.assertRaisesRegex(ValueError, "Unsupported news country"):
            news.make_location("ZZ", "")

    def test_merge_orders_by_recency_and_removes_duplicate_developments(self):
        newest = make_article(
            "newest",
            "Central bank raises interest rates after inflation report",
            "Business",
            "2026-09-09T12:00:00Z",
        )
        duplicate = make_article(
            "duplicate",
            "Central bank raises rates after the inflation report",
            "Business",
            "2026-09-09T11:55:00Z",
            source="Another Wire",
        )
        older = make_article(
            "older",
            "Researchers publish a new climate model",
            "Science",
            "2026-09-09T10:00:00Z",
        )

        merged = news.merge_articles([older, duplicate], [newest])

        self.assertEqual([item["id"] for item in merged], ["newest", "older"])

    def test_extractive_summary_states_developments_instead_of_counts(self):
        articles = [
            make_article("one", "Parliament approves the education bill", "Politics", ""),
            make_article("two", "Researchers map a deep ocean habitat", "Science", ""),
        ]
        location = news.make_location("IN", "")
        digests = [
            news.build_section_digest("Politics", [articles[0]], location),
            news.build_section_digest("Science", [articles[1]], location),
        ]

        summary = news.build_extractive_summary(articles, location, digests)

        self.assertIn("Parliament approves the education bill.", summary["overview"])
        self.assertIn("Researchers map a deep ocean habitat.", summary["overview"])
        self.assertNotIn("stories from", summary["overview"])

    def test_partial_provider_result_still_returns_a_briefing(self):
        now = news.datetime.now(news.timezone.utc).isoformat()
        articles = [
            make_article("one", "State opens a new public hospital", "Health", now),
            make_article("two", "University launches a robotics lab", "Technology", now),
        ]
        location = news.make_location("IN", "Tamil Nadu")

        with (
            patch.object(news, "fetch_google_articles", return_value=articles),
            patch.object(news, "fetch_gdelt_articles", side_effect=TimeoutError()),
            patch.object(news, "generate_editorial_summary", return_value=None),
        ):
            payload = news.build_payload(location)

        self.assertTrue(payload["partial"])
        self.assertEqual(payload["status"], 200)
        self.assertEqual(len(payload["articles"]), 2)
        self.assertTrue(payload["dailySummary"]["overview"])
        self.assertIn("Source-based highlights", payload["dailySummary"]["analysisStatement"])

    def test_fresh_briefing_is_shared_without_model_or_provider_work(self):
        cached = {"freshUntil": int(news.time.time()) + 600, "payload": {"articles": [], "dailySummary": {"overview": "Saved briefing"}}}
        with patch.object(news, "get_cached", return_value=cached), patch.object(news, "build_payload") as build:
            for user in ("alice", "bob"):
                result = news.lambda_handler({"queryStringParameters": {"country": "IN"}, "requestContext": {"authorizer": {"claims": {"sub": user}}}}, None)
                self.assertEqual(json.loads(result["body"])["cacheStatus"], "fresh-cache")
            build.assert_not_called()

    def test_busy_refresh_serves_saved_edition_without_regenerating(self):
        cached = {"freshUntil": 1, "expiresAt": int(news.time.time()) + 600, "payload": {"articles": []}}
        with patch.object(news, "get_cached", return_value=cached), patch.object(news, "generation_lease", side_effect=news.GenerationBusy()), patch.object(news, "build_payload") as build:
            result = news.lambda_handler({}, None)
            self.assertEqual(json.loads(result["body"])["cacheStatus"], "stale-cache")
            self.assertEqual(result["headers"]["Cache-Control"], "no-store")
            build.assert_not_called()

    def test_busy_cold_request_is_retryable_and_not_cacheable(self):
        with patch.object(news, "get_cached", return_value=None), patch.object(news, "generation_lease", side_effect=news.GenerationBusy()):
            result = news.lambda_handler({}, None)
        self.assertEqual(result["statusCode"], 503)
        self.assertEqual(result["headers"]["Retry-After"], "3")
        self.assertEqual(result["headers"]["Cache-Control"], "no-store")

    def test_cache_outage_does_not_trigger_model(self):
        with patch.object(news, "get_cached", side_effect=_ClientError()), patch.object(news, "build_payload") as build:
            self.assertEqual(news.lambda_handler({}, None)["statusCode"], 503)
            build.assert_not_called()

    def test_handler_supports_rest_method_and_rejects_non_get(self):
        response = news.lambda_handler({"httpMethod": "POST"}, None)

        self.assertEqual(response["statusCode"], 405)
        self.assertEqual(json.loads(response["body"])["error"], "Method not allowed.")

    def test_handler_uses_stale_cache_after_unexpected_refresh_error(self):
        now = int(news.time.time())
        cached_payload = {
            "status": 200,
            "articles": [make_article("cached", "Cached development", "World", "")],
            "sections": {},
        }
        cached = {
            "freshUntil": now - 1,
            "expiresAt": now + 600,
            "payload": cached_payload,
        }

        with (
            patch.object(news, "get_cached", return_value=cached),
            patch.object(news, "build_payload", side_effect=KeyError("provider shape")),
            patch.object(news.LOGGER, "exception"),
        ):
            response = news.lambda_handler({
                "requestContext": {"http": {"method": "GET"}},
                "queryStringParameters": {"country": "IN"},
            }, None)

        body = json.loads(response["body"])
        self.assertEqual(response["statusCode"], 200)
        self.assertEqual(body["cacheStatus"], "stale-cache")
        self.assertIn("saved briefing", body["notice"])


if __name__ == "__main__":
    unittest.main()
