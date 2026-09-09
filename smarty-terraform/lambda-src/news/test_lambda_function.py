import json
import os
import sys
import types
import unittest
from unittest.mock import patch


os.environ.setdefault("AWS_EC2_METADATA_DISABLED", "true")


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
        articles = [
            make_article("one", "State opens a new public hospital", "Health", ""),
            make_article("two", "University launches a robotics lab", "Technology", ""),
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
