import json
import time
import unittest
from unittest import mock
from email.utils import formatdate
from xml.sax.saxutils import escape
from decimal import Decimal
import editorial_sources as sources
import test_content_quality as quality

LAMBDA = quality.LAMBDA


def evidence(mode="history"):
    now = int(time.time())
    return {"version": 1, "mode": mode, "asOf": "2026-10-13", "sources": [{
        "id": "history-1", "label": "Suez Canal · Wikipedia", "publisher": "Wikipedia",
        "kind": "reference", "url": "https://en.wikipedia.org/wiki/Suez_Canal",
        "retrievedAt": now, "publishedAt": now, "excerpt": "The Suez Canal connects the Mediterranean and Red seas. Ships can use the canal rather than sailing around Africa. A shorter route changes travel time, but access and tolls also constrain shipping.",
    }]}


class SourceRetrievalTests(unittest.TestCase):
    def test_named_history_cannot_use_a_different_event(self):
        excerpt = "Suez Canal shipping Mediterranean Red seas Europe Asia trade. " * 20
        data = {"query": {"pages": [
            {"pageid": 1, "title": "Eurasia Canal", "fullurl": "https://en.wikipedia.org/wiki/Eurasia_Canal", "extract": excerpt},
            {"pageid": 2, "title": "Suez Canal", "fullurl": "https://en.wikipedia.org/wiki/Suez_Canal", "extract": excerpt},
        ]}}
        with mock.patch.object(sources, "download", return_value=json.dumps(data).encode()) as download:
            result = sources.historical_sources("why the Suez Canal redirected trade between Europe and Asia", 100)
        self.assertEqual([item["id"] for item in result], ["history-2"])
        self.assertIn('intitle%3A%22Suez+Canal%22', download.call_args.args[0])

    def test_unavailable_history_is_empty_not_model_memory(self):
        with mock.patch.object(sources, "download", side_effect=OSError("offline")):
            pack = sources.retrieve_sources("World History", "Suez Canal", "History and civilization", "mechanism", 100)
        self.assertEqual(pack["mode"], "history")
        self.assertEqual(pack["sources"], [])

    def test_foundation_history_search_uses_the_exact_central_concept(self):
        data = {"query": {"pages": [{"pageid": 1, "title": "Primary source", "fullurl": "https://en.wikipedia.org/wiki/Primary_source", "extract": "A primary source records an event. A later interpretation uses sources. " * 10}]}}
        with mock.patch.object(sources, "download", return_value=json.dumps(data).encode()) as download:
            result = sources.historical_sources("how a primary source differs from a later interpretation of an event", 100)
        self.assertEqual(len(result), 1)
        self.assertIn('titles=primary+source', download.call_args.args[0])
        self.assertNotIn('generator=search', download.call_args.args[0])
        self.assertIn('exintro=1', download.call_args.args[0])
        self.assertIn('exchars=1200', download.call_args.args[0])

    def test_trade_route_resolves_the_foundation_not_search_ranked_routes(self):
        data = {"query": {"pages": [{"pageid": 7, "title": "Trade route",
                "fullurl": "https://en.wikipedia.org/wiki/Trade_route",
                "extract": "Trade routes connect goods and people across regions. " * 20}]}}
        with mock.patch.object(sources, "download", return_value=json.dumps(data).encode()) as download:
            result = sources.historical_sources("how a trade route connects goods, people, and ideas across regions", 100)
        self.assertEqual([item["id"] for item in result], ["history-7"])
        self.assertIn('titles=trade+route', download.call_args.args[0])
        self.assertIn('redirects=1', download.call_args.args[0])

    def test_exact_concept_still_rejects_missing_or_unrelated_articles(self):
        data = {"query": {"pages": [{"title": "trade route", "missing": True},
                {"pageid": 8, "title": "Sea lane", "fullurl": "https://en.wikipedia.org/wiki/Sea_lane",
                 "extract": "Trade routes connect goods and people across regions. " * 20}]}}
        with mock.patch.object(sources, "download", return_value=json.dumps(data).encode()):
            self.assertEqual(sources.historical_sources("how a trade route connects goods and people", 100), [])

    def test_bad_links_empty_excerpts_and_unrelated_history_are_rejected(self):
        pages = [{"pageid": 1, "title": "Suez Canal", "fullurl": "https://evil.example/canal", "extract": "canal shipping " * 100},
                 {"pageid": 2, "title": "Suez Canal", "fullurl": "https://en.wikipedia.org/wiki/Suez_Canal", "extract": "Short text"}]
        with mock.patch.object(sources, "download", return_value=json.dumps({"query": {"pages": pages}}).encode()):
            self.assertEqual(sources.historical_sources("Suez Canal shipping", 100), [])

    def test_current_feed_checks_date_relevance_and_link_host(self):
        now = int(time.time())
        def item(title, age=0, link="https://www.nasa.gov/news/telescope/"):
            return f"<item><title>{escape(title)}</title><description>{'space telescope discovery observation evidence ' * 10}</description><link>{escape(link)}</link><pubDate>{formatdate(now-age, usegmt=True)}</pubDate></item>"
        raw = ("<rss><channel>" + item("Space telescope discovery") + item("Space telescope old", 8*86400) + item("Space telescope future", -86400) + item("Space telescope malicious", link="https://127.0.0.1/") + "</channel></rss>").encode()
        with mock.patch.object(sources, "download", side_effect=[raw, OSError("offline")]):
            result = sources.recent_sources("space telescope discovery", now)
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]["publisher"], "NASA")
        self.assertEqual(result[0]["publishedAt"], now)

    def test_entity_declarations_and_dateless_reports_are_rejected(self):
        raw = b'<!DOCTYPE rss [<!ENTITY secret SYSTEM "file:///etc/passwd">]><rss/>'
        with mock.patch.object(sources, "download", return_value=raw):
            self.assertEqual(sources.recent_sources("space telescope", int(time.time())), [])

    def test_bad_date_does_not_hide_a_later_valid_report(self):
        now = int(time.time())
        description = "space telescope discovery observation " * 12
        def item(date):
            return f"<item><title>Space telescope discovery</title><description>{description}</description><link>https://www.nasa.gov/discovery/</link><pubDate>{date}</pubDate></item>"
        raw = ("<rss><channel>" + item("invalid") + item(formatdate(now, usegmt=True)) + "</channel></rss>").encode()
        with mock.patch.object(sources, "download", side_effect=[raw, OSError("offline")]):
            self.assertEqual(len(sources.recent_sources("space telescope discovery", now)), 1)

    def test_source_ids_cannot_invent_or_duplicate_citations(self):
        pack = evidence()
        for ids in (["invented"], ["history-1", "history-1"], [], "history-1", [123]):
            self.assertEqual(sources.selected_sources(pack, ids), [])
        self.assertEqual(len(sources.selected_sources(pack, ["history-1"])), 1)

    def test_requests_cannot_fetch_private_hosts_or_unsafe_redirects(self):
        for url in ("https://127.0.0.1/", "http://www.nasa.gov/", "https://www.nasa.gov:8080/", "https://user:pass@www.nasa.gov/"):
            with self.assertRaises(ValueError): sources.download(url)
        with self.assertRaises(ValueError):
            sources._TrustedRedirect().redirect_request(None, None, 302, "", {}, "https://evil.example/")

    def test_current_language_and_this_year_require_recent_reports(self):
        self.assertTrue(sources.claims_current("The latest spacecraft launch"))
        self.assertTrue(sources.claims_current("A launch in " + str(sources.datetime.now(sources.timezone.utc).year)))
        self.assertFalse(sources.claims_current("The railway changed timekeeping in 1883"))


class EditorialPublicationTests(unittest.TestCase):
    def candidate(self):
        paragraph = ("The Suez Canal connects the Mediterranean and Red seas and changes shipping routes. Ships can avoid travelling around Africa, so a shorter route changes travel time between Europe and Asia. The canal therefore links a geographic shortcut to a commercial decision. That decision also depends on tolls, access and shipping constraints, rather than distance alone. This distinction explains why a canal can alter trade without eliminating every difficulty of a voyage.")
        return {"title": "How the Suez Canal Changed Shipping Routes", "mechanismParagraph": paragraph, "exampleParagraph": paragraph, "sourceIds": ["history-1"]}

    def test_history_without_evidence_never_calls_the_model(self):
        with mock.patch.object(LAMBDA, "load_editorial_evidence", return_value={"mode": "history", "sources": []}), mock.patch.object(LAMBDA, "call_bedrock_text") as model:
            self.assertIsNone(LAMBDA.generate_specific_post("World History", "how the Suez Canal changed shipping trade", LAMBDA.resolve_content_angle("mechanism"), []))
        model.assert_not_called()

    def test_source_grounded_history_is_saved_with_real_citations(self):
        with mock.patch.object(LAMBDA, "load_editorial_evidence", return_value=evidence()), mock.patch.object(LAMBDA, "call_bedrock_text", side_effect=[json.dumps(self.candidate()), '{"supported":true,"issues":[]}']):
            post = LAMBDA.generate_specific_post("World History", "how the Suez Canal changed shipping trade", LAMBDA.resolve_content_angle("mechanism"), [])
        self.assertEqual(post["editorialMode"], "history")
        self.assertEqual(post["sources"][0]["url"], evidence()["sources"][0]["url"])
        self.assertNotIn("excerpt", post["sources"][0])
        self.assertEqual(post["sourceEvidence"]["sources"][0]["id"], "history-1")

    def test_unsupported_claim_and_fabricated_citation_stop_publication(self):
        for verdict in ('{"supported":false,"issues":["invented motive"]}', '{"supported":"true","issues":[]}', '{"supported":true,"issues":["wrong date"]}', '{}'):
            with mock.patch.object(LAMBDA, "load_editorial_evidence", return_value=evidence()), mock.patch.object(LAMBDA, "call_bedrock_text", side_effect=[json.dumps(self.candidate()), verdict]):
                self.assertIsNone(LAMBDA.generate_specific_post("World History", "how the Suez Canal changed shipping trade", LAMBDA.resolve_content_angle("mechanism"), []))
        draft = {**self.candidate(), "sourceIds": ["invented"]}
        with mock.patch.object(LAMBDA, "load_editorial_evidence", return_value=evidence()), mock.patch.object(LAMBDA, "call_bedrock_text", return_value=json.dumps(draft)) as model:
            self.assertIsNone(LAMBDA.generate_specific_post("World History", "how the Suez Canal changed shipping trade", LAMBDA.resolve_content_angle("mechanism"), []))
        self.assertEqual(model.call_count, 1)

    def test_missing_recent_reports_fall_back_to_a_concept_not_invented_news(self):
        draft = {**self.candidate(), "sourceIds": []}
        with mock.patch.object(LAMBDA, "load_editorial_evidence", return_value={"mode": "current", "sources": []}), mock.patch.object(LAMBDA, "call_bedrock_text", side_effect=[json.dumps(draft), '{"accurate":true,"issues":[]}']):
            post = LAMBDA.generate_specific_post("Engineering", "how the Suez Canal changed shipping trade", LAMBDA.resolve_content_angle("current_connection"), [])
        self.assertEqual(post["editorialMode"], "concept")
        self.assertEqual(post["contentAngle"], "mechanism")
        self.assertEqual(post["sources"], [])

    def test_conceptual_error_stops_publication(self):
        draft = {**self.candidate(), "sourceIds": []}
        with (mock.patch.object(LAMBDA, "load_editorial_evidence", return_value={"mode": "concept", "sources": []}),
              mock.patch.object(LAMBDA, "call_bedrock_text", side_effect=[json.dumps(draft), '{"accurate":false,"issues":["incorrect mechanism"]}'])):
            self.assertIsNone(LAMBDA.generate_specific_post("Engineering", "how a canal changes shipping routes", LAMBDA.resolve_content_angle("mechanism"), []))

    def test_recent_report_is_retained_with_its_original_date(self):
        pack = evidence("current")
        draft = {**self.candidate(), "exampleParagraph": "Today " + self.candidate()["exampleParagraph"]}
        with mock.patch.object(LAMBDA, "load_editorial_evidence", return_value=pack), mock.patch.object(LAMBDA, "call_bedrock_text", side_effect=[json.dumps(draft), '{"supported":true,"issues":[]}']):
            post = LAMBDA.generate_specific_post("Engineering", "how the Suez Canal changed shipping trade", LAMBDA.resolve_content_angle("current_connection"), [])
        self.assertEqual(post["editorialMode"], "current")
        self.assertEqual(post["sources"][0]["publishedAt"], pack["sources"][0]["publishedAt"])

    def test_unretrieved_current_claim_cannot_pass_as_stable_concept(self):
        draft = {**self.candidate(), "sourceIds": [], "exampleParagraph": "Today " + self.candidate()["exampleParagraph"]}
        with mock.patch.object(LAMBDA, "load_editorial_evidence", return_value={"mode": "concept", "sources": []}), mock.patch.object(LAMBDA, "call_bedrock_text", return_value=json.dumps(draft)):
            self.assertIsNone(LAMBDA.generate_specific_post("Engineering", "how the Suez Canal changed shipping trade", LAMBDA.resolve_content_angle("mechanism"), []))

    def test_shared_fresh_source_cache_avoids_another_fetch(self):
        now = int(time.time())
        with mock.patch.object(LAMBDA, "explanations_table") as table, mock.patch.object(LAMBDA, "retrieve_sources") as fetch:
            table.get_item.return_value = {"Item": {"freshUntil": now+120, "evidence": evidence()}}
            self.assertEqual(LAMBDA.load_editorial_evidence("World History", "Suez Canal", "mechanism")["mode"], "history")
        fetch.assert_not_called()

    def test_stale_source_cache_is_refreshed(self):
        now = int(time.time())
        with mock.patch.object(LAMBDA, "explanations_table") as table, mock.patch.object(LAMBDA, "retrieve_sources", return_value=evidence()) as fetch:
            table.get_item.return_value = {"Item": {"freshUntil": now-1, "evidence": evidence()}}
            LAMBDA.load_editorial_evidence("World History", "Suez Canal", "mechanism")
        fetch.assert_called_once()
        self.assertEqual(table.put_item.call_args.kwargs["Item"]["entryType"], "editorialSources")

    def test_evidence_change_invalidates_explanation_but_database_types_do_not(self):
        pack = evidence()
        source = {"title": "A lesson", "body": "A source", "sourceEvidence": pack}
        first = LAMBDA.explanation_source_hash(source)
        decimal_pack = {**pack, "version": Decimal(1), "sources": [{**pack["sources"][0], "retrievedAt": Decimal(pack["sources"][0]["retrievedAt"]), "publishedAt": Decimal(pack["sources"][0]["publishedAt"])}]}
        self.assertEqual(first, LAMBDA.explanation_source_hash({**source, "sourceEvidence": decimal_pack}))
        changed = {**pack, "sources": [{**pack["sources"][0], "excerpt": "A corrected source passage."}]}
        self.assertNotEqual(first, LAMBDA.explanation_source_hash({**source, "sourceEvidence": changed}))

    def test_deep_lesson_with_unsupported_details_is_not_stored(self):
        with mock.patch.object(LAMBDA, "call_bedrock_text", side_effect=[quality.ContentCatalogTests.complete_explanation(), '{"supported":false,"issues":["unsupported detail"]}']):
            result = LAMBDA.generate_detailed_explanation("Suez Canal", "Source", "World History", source_evidence=evidence())
        self.assertEqual(result, "")

    def test_history_lens_only_applies_to_history_and_cannot_choose_live_news(self):
        for _ in range(80):
            self.assertNotEqual(LAMBDA.choose_content_angle([], "Physics")["id"], "documented_history")
            self.assertNotEqual(LAMBDA.choose_content_angle([], "World History")["id"], "current_connection")
        self.assertEqual(LAMBDA.resolve_content_angle("unknown")["id"], "mechanism")


if __name__ == "__main__":
    unittest.main()
