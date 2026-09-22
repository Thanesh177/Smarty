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
            self.assertEqual(save.call_args.kwargs["fresh_until"], start + news.CACHE_TTL_SECONDS)

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
