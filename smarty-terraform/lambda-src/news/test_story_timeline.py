import json
import unittest
from contextlib import nullcontext
from unittest.mock import patch
import xml.etree.ElementTree as ET
from test_lambda_function import news, make_article, _ClientError


class StoryTimelineTests(unittest.TestCase):
    def request(self, **params):
        return news.lambda_handler({"queryStringParameters": {"view": "story", "query": "Gaza", "year": "2023", **params}}, None)

    def test_invalid_queries_dates_and_operators_are_rejected_before_storage(self):
        with patch.object(news, "get_cached") as read:
            for params in [{"query": "x"}, {"query": "site:example.com"}, {"query": "a" * 101}, {"year": "1999"}, {"year": "9999"}, {"month": "13"}, {"year": "recent", "month": "2"}]:
                with self.subTest(params=params):
                    self.assertEqual(self.request(**params)["statusCode"], 400)
            read.assert_not_called()

    def test_calendar_ranges_and_cache_keys(self):
        first = news.story_request({"query": "Gaza", "year": "2023"})
        second = news.story_request({"query": " gaza ", "year": "2023"})
        self.assertEqual(first[-1], second[-1])
        self.assertEqual(len(first[3]), 4)
        self.assertEqual(first[3][0][0].isoformat(), '2023-01-01T00:00:00+00:00')
        self.assertEqual(first[3][-1][1].isoformat(), '2024-01-01T00:00:00+00:00')
        month = news.story_request({"query": "Gaza", "year": "2024", "month": "2"})
        self.assertEqual((month[3][0][1] - month[3][0][0]).days, 29)
        self.assertNotEqual(first[-1], month[-1])

    def test_shared_database_cache_skips_provider_fetch(self):
        payload = {"kind": "story-timeline", "articles": []}
        with patch.object(news, "get_cached", return_value={"freshUntil": news.time.time() + 600, "payload": payload}), patch.object(news, "fetch_story_range") as fetch:
            result = self.request()
            self.assertEqual(json.loads(result["body"])["cacheStatus"], "fresh-cache")
            fetch.assert_not_called()

    def test_cache_failure_does_not_fetch(self):
        with patch.object(news, "get_cached", side_effect=_ClientError()), patch.object(news, "fetch_story_range") as fetch:
            self.assertEqual(self.request()["statusCode"], 503)
            fetch.assert_not_called()

    def test_rechecks_shared_cache_after_lease_to_avoid_duplicate_work(self):
        cached = {'freshUntil': news.time.time() + 600, 'payload': {'kind': 'story-timeline', 'articles': []}}
        with patch.object(news, 'get_cached', side_effect=[None, cached]), patch.object(news, 'generation_lease', return_value=nullcontext()), patch.object(news, 'fetch_story_range') as fetch:
            result = self.request()
            self.assertEqual(json.loads(result['body'])['cacheStatus'], 'fresh-cache')
            fetch.assert_not_called()

    def test_partial_provider_failure_keeps_saved_reports_and_discloses_gap(self):
        saved = make_article('older', 'Earlier Gaza reporting', 'World', '2023-01-02T12:00:00Z')
        later = make_article('later', 'Later Gaza reporting', 'World', '2023-11-02T12:00:00Z')
        cached = {'freshUntil': 0, 'payload': {'kind': 'story-timeline', 'articles': [saved]}}
        with patch.object(news, 'get_cached', return_value=cached), patch.object(news, 'generation_lease', return_value=nullcontext()), patch.object(news, 'fetch_story_range', side_effect=[TimeoutError(), [], [], [later]]), patch.object(news.NEWS_CACHE, 'put_item'):
            payload = json.loads(self.request()['body'])
            self.assertEqual(payload['sourceFailures'], 1)
            self.assertEqual([a['title'] for a in payload['articles']], [saved['title'], later['title']])
            self.assertIn('could not be refreshed', payload['notice'])

    def test_persists_historical_coverage_without_expiry(self):
        article = make_article('older', 'Gaza talks', 'World', '2023-02-01T12:00:00Z')
        with patch.object(news, "get_cached", return_value=None), patch.object(news, "generation_lease", return_value=nullcontext()), patch.object(news, "fetch_story_range", return_value=[article]), patch.object(news.NEWS_CACHE, "put_item") as write:
            result = self.request()
            self.assertEqual(result["statusCode"], 200)
            item = write.call_args.kwargs['Item']
            self.assertNotIn('expiresAt', item)
            self.assertEqual(item['recordType'], 'story-archive')
            self.assertEqual(len(item['payload']['articles']), 1)
            self.assertTrue(item['payload']['stored'])

    def test_saved_reports_survive_provider_failure(self):
        cached = {"freshUntil": 0, "payload": {"kind": "story-timeline", "articles": [{"title": "Saved report"}]}}
        with patch.object(news, "get_cached", return_value=cached), patch.object(news, "generation_lease", return_value=nullcontext()), patch.object(news, "fetch_story_range", side_effect=TimeoutError), patch.object(news.NEWS_CACHE, "put_item") as write:
            result = self.request()
            self.assertEqual(result["statusCode"], 200)
            self.assertEqual(json.loads(result["body"])["cacheStatus"], 'stale-cache')
            self.assertEqual(result['headers']['Cache-Control'], 'no-store')
            write.assert_not_called()

    def test_storage_write_failure_never_claims_saved_success(self):
        with patch.object(news, "get_cached", return_value=None), patch.object(news, "generation_lease", return_value=nullcontext()), patch.object(news, "fetch_story_range", return_value=[]), patch.object(news.NEWS_CACHE, "put_item", side_effect=_ClientError()):
            self.assertEqual(self.request()["statusCode"], 503)

    def test_rss_date_filter_is_rechecked(self):
        root = ET.fromstring('''<rss><channel>
          <item><title>Gaza report</title><link>https://example.org/a</link><pubDate>Wed, 01 Feb 2023 12:00:00 GMT</pubDate></item>
          <item><title>Wrong year</title><link>https://example.org/b</link><pubDate>Thu, 01 Feb 2024 12:00:00 GMT</pubDate></item>
          <item><title>Undated</title><link>https://example.org/c</link></item>
        </channel></rss>''')
        _, _, _, ranges, _ = news.story_request({"query": "Gaza", "year": "2023", "month": "2"})
        with patch.object(news, 'fetch_xml', return_value=root):
            result = news.fetch_story_range('Gaza', *ranges[0])
            self.assertEqual([a['title'] for a in result], ['Gaza report'])

    def test_bounded_results_retain_both_ends_and_safe_urls(self):
        records = [make_article(str(i), f'Report {i}', 'World', f'2023-01-{i + 1:02d}T12:00:00Z') for i in range(25)]
        result = news.story_archive_articles(records + [{**records[0], 'news_link': 'javascript:alert(1)'}], limit=5)
        self.assertEqual(len(result), 5)
        self.assertEqual(result[0]['title'], 'Report 0')
        self.assertEqual(result[-1]['title'], 'Report 24')


if __name__ == '__main__':
    unittest.main()
