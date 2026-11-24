"""Local glossary validation, model and persistence tests; no cloud access."""
import copy
import json
import unittest
from contextlib import ExitStack
from unittest import mock

from post_glossary import generated_glossary, make_glossary, normalize_terms, saved_glossary, source_hash
from test_content_quality import LAMBDA, ContentCatalogTests
from test_shared_cache import MemoryTable, ConditionalFailure

MEANING = {"term": "chlorophyll", "meaning": "The green substance in a leaf that absorbs light used to make sugars."}
POST = {"id": "p1", "userId": "alice", "title": "A leaf at work", "body": "Photosynthesis begins when chlorophyll absorbs light.", "visibility": "public"}


class GlossaryValidationTests(unittest.TestCase):
    def test_broken_nonempty_results_are_not_cached_as_intentional_empty_meanings(self):
        invalid = [{"term": "absent word", "meaning": MEANING["meaning"]}]
        for entries in (None, {}, invalid):
            with self.assertRaises(ValueError):
                generated_glossary(POST, entries)
        self.assertEqual(generated_glossary(POST, [])["terms"], [])
        stale = {**POST, "postGlossary": {**make_glossary(POST, []), "terms": invalid}}
        self.assertIsNone(saved_glossary(stale))

    def test_terms_are_literal_case_insensitive_bounded_and_plain_text(self):
        dirty = [None, {"term": "not in this post", "meaning": MEANING["meaning"]},
                 {"term": "light", "meaning": "short"}, {"term": "leaf", "meaning": "<b>Not allowed here</b>"},
                 MEANING, {**MEANING, "term": "Chlorophyll"},
                 {"term": "synthesis", "meaning": MEANING["meaning"]}]
        self.assertEqual(normalize_terms(dirty, POST), [MEANING])
        entries = [{"term": "term" + str(n), "meaning": MEANING["meaning"]} for n in range(30)]
        self.assertEqual(len(normalize_terms(entries, {"body": " ".join(entry["term"] for entry in entries)})), 16)
        fuller = {**MEANING, "meaning": ((MEANING["meaning"] + " ") * 6).strip()}
        self.assertGreater(len(fuller["meaning"]), 360)
        self.assertEqual(normalize_terms([fuller], POST), [fuller])
        self.assertEqual(normalize_terms([{**fuller, "meaning": "x" * 651}], POST), [])

    def test_cache_tracks_the_exact_source_and_even_empty_terms_are_reusable(self):
        glossary = make_glossary(POST, [MEANING])
        self.assertEqual(saved_glossary({**POST, "postGlossary": glossary}), glossary)
        for change in ({"body": POST["body"] + " "}, {"title": "New title"}):
            self.assertIsNone(saved_glossary({**POST, **change, "postGlossary": glossary}))
        empty = make_glossary(POST, [])
        self.assertEqual(saved_glossary({**POST, "postGlossary": empty}), empty)
        self.assertIsNone(saved_glossary({**POST, "postGlossary": {**glossary, "version": 2}}))

    def test_ai_writer_includes_meanings_in_the_existing_review_without_extra_model_calls(self):
        draft = {"title": "How a KV Cache Saves Earlier Work", "mechanismParagraph": ContentCatalogTests.kv_cache_mechanism,
                 "exampleParagraph": ContentCatalogTests.kv_cache_example, "sourceIds": [],
                 "wordMeanings": [{"term": "token", "meaning": "A piece of text processed as one unit by the model."}]}
        with (mock.patch.object(LAMBDA, "load_editorial_evidence", return_value={"mode": "concept", "sources": []}),
              mock.patch.object(LAMBDA, "call_bedrock_text", side_effect=[json.dumps(draft), '{"accurate":true,"readerReady":true,"issues":[]}']) as model):
            result = LAMBDA.generate_specific_post("Artificial Intelligence", "how a KV cache avoids recomputing earlier tokens", LAMBDA.resolve_content_angle("mechanism"), [])
        self.assertEqual(model.call_count, 2)
        self.assertEqual(result["postGlossary"]["terms"], draft["wordMeanings"])
        self.assertEqual(result["postGlossary"]["sourceHash"], source_hash(result))
        self.assertIn("Word meanings to check for accuracy", model.call_args_list[1].args[0])
        self.assertIn("A piece of text processed", model.call_args_list[1].args[0])
        instructions = model.call_args_list[0].args[0]
        for guidance in ("2 to 4 short", "its job or how it works", "Do not include\nexamples, analogies", "stand on its own"):
            self.assertIn(guidance, instructions)


class Posts(MemoryTable):
    def get_item(self, **kwargs):
        # DynamoDB returns a snapshot, not a live reference to the stored item.
        return copy.deepcopy(super().get_item(**kwargs))

    def update_item(self, Key, ConditionExpression, ExpressionAttributeValues, **kwargs):
        current = self.items.get(Key[self.key], {})
        if not ConditionExpression.check(current):
            raise ConditionalFailure()
        current["postGlossary"] = ExpressionAttributeValues[":glossary"]


class GlossaryEndpointTests(unittest.TestCase):
    def setUp(self):
        stack = ExitStack()
        self.addCleanup(stack.close)
        self.posts = Posts("id")
        self.posts.put_item(Item=copy.deepcopy(POST))
        stack.enter_context(mock.patch.object(LAMBDA, "table", self.posts))
        stack.enter_context(mock.patch.object(LAMBDA, "explanations_table", MemoryTable("explanationId")))
        self.model = stack.enter_context(mock.patch.object(LAMBDA, "call_bedrock_text", return_value=json.dumps({"terms": [MEANING]})))

    def call(self, user="alice", body=None, method="POST"):
        event = {"rawPath": "/posts/glossary", "requestContext": {"http": {"method": method}, "authorizer": {"jwt": {"claims": {"sub": user}}}}, "body": json.dumps({"postId": "p1"} if body is None else body)}
        result = LAMBDA.lambda_handler(event, None)
        return result["statusCode"], json.loads(result["body"])

    def test_saved_meanings_are_reused_without_another_model_request(self):
        first, second = self.call(), self.call()
        self.assertEqual(first[0], 200)
        self.assertEqual(second[0], 200)
        self.assertFalse(first[1]["cached"])
        self.assertTrue(second[1]["cached"])
        self.assertEqual(self.model.call_count, 1)
        saved = self.posts.items["p1"]
        self.assertEqual(saved["postGlossary"], make_glossary(POST, [MEANING]))
        self.assertEqual({key: value for key, value in saved.items() if key != "postGlossary"}, POST)
        self.assertEqual(self.model.call_args.kwargs["model_id"], LAMBDA.POST_MODEL_ID)

    def test_caller_cannot_spend_for_someone_else_or_spoof_owner_in_body(self):
        for user, expected in (("", 401), ("bob", 403)):
            status, _ = self.call(user, {"postId": "p1", "userId": "alice", "postGlossary": {"terms": [MEANING]}})
            self.assertEqual(status, expected)
        self.model.assert_not_called()

    def test_non_post_and_invalid_requests_do_not_generate(self):
        for body, expected in (([], 400), ({}, 400), ({"postId": "missing"}, 404), ({"postId": {}}, 400)):
            self.assertEqual(self.call(body=body)[0], expected)
        self.assertEqual(self.call(method="GET")[0], 405)
        self.posts.items["p1"]["moderationStatus"] = "removed"
        self.assertEqual(self.call()[0], 404)
        self.model.assert_not_called()

    def test_edit_regenerates_source_bound_meanings_but_simple_posts_reuse_empty_result(self):
        self.call()
        self.posts.items["p1"]["body"] = "A simpler corrected explanation."
        self.model.return_value = '{"terms":[]}'
        second = self.call()
        self.assertEqual(second[0], 200)
        self.assertNotEqual(second[1]["postGlossary"]["sourceHash"], source_hash(POST))
        self.assertEqual(self.call()[1]["postGlossary"]["terms"], [])
        self.assertEqual(self.model.call_count, 2)

    def test_edit_or_deletion_during_generation_cannot_attach_stale_meanings(self):
        def change_post(*args, **kwargs):
            self.posts.items["p1"]["body"] = "Changed during generation."
            return json.dumps({"terms": [MEANING]})
        self.model.side_effect = change_post
        self.assertEqual(self.call()[0], 409)
        self.assertNotIn("postGlossary", self.posts.items["p1"])

    def test_malformed_model_result_leaves_saved_post_unchanged(self):
        self.model.return_value = 'not JSON'
        self.assertEqual(self.call()[0], 503)
        self.assertEqual(self.posts.items["p1"], POST)

    def test_all_invalid_model_terms_leave_post_retryable_instead_of_saving_empty(self):
        self.model.return_value = json.dumps({"terms": [{"term": "absent word", "meaning": MEANING["meaning"]}]})
        self.assertEqual(self.call()[0], 503)
        self.assertNotIn("postGlossary", self.posts.items["p1"])

    def test_hidden_or_deleted_posts_never_spend_model_work(self):
        for flags in ({"deleted": True}, {"isDeleted": True}, {"moderationStatus": "pending_review"},
                      {"moderationStatus": "rejected"}, {"moderationStatus": "hidden"}, {"visibility": "moderation_removed"}):
            self.posts.items["p1"] = {**POST, **flags}
            self.assertEqual(self.call()[0], 404)
        self.model.assert_not_called()

    def test_conflicting_owner_ids_fail_closed(self):
        self.posts.items["p1"]["authorId"] = "bob"
        self.assertEqual(self.call()[0], 403)
        self.assertEqual(self.call("bob")[0], 403)
        self.model.assert_not_called()

    def test_moderation_during_generation_cannot_attach_meanings_to_hidden_post(self):
        def moderate(*args, **kwargs):
            self.posts.items["p1"]["moderationStatus"] = "removed"
            return json.dumps({"terms": [MEANING]})
        self.model.side_effect = moderate
        self.assertEqual(self.call()[0], 409)
        self.assertNotIn("postGlossary", self.posts.items["p1"])

    def test_active_lease_prevents_duplicate_generation(self):
        identity = "post-glossary#v1#p1#" + source_hash(POST)
        with LAMBDA.generation_lease(LAMBDA.explanations_table, "explanationId", identity):
            self.assertEqual(self.call()[0], 503)
        self.model.assert_not_called()


if __name__ == "__main__":
    unittest.main()
