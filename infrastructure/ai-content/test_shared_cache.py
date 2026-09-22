import json
import time
import types
import unittest
from unittest import mock
import test_content_quality as quality
LAMBDA = quality.LAMBDA


class ConditionalFailure(Exception): pass


class MemoryTable:
    def __init__(self, key):
        self.key, self.items = key, {}
        self.meta = types.SimpleNamespace(client=types.SimpleNamespace(exceptions=types.SimpleNamespace(ConditionalCheckFailedException=ConditionalFailure)))

    def get_item(self, Key, **kwargs): return {"Item": self.items.get(Key[self.key])}
    def put_item(self, Item, ConditionExpression=None, **kwargs):
        current = self.items.get(Item[self.key], {})
        if ConditionExpression and not ConditionExpression.check(current): raise ConditionalFailure()
        self.items[Item[self.key]] = dict(Item)
    def update_item(self, **kwargs): pass


class SharedCacheTests(unittest.TestCase):
    def setUp(self):
        self.post = {"id": "p1", "title": "Attention keys", "body": "Keys match queries.", "topic": "AI", "visibility": "public"}
        self.explanations = MemoryTable("explanationId")
        self.doubts = MemoryTable("doubtId")
        self.stack = __import__('contextlib').ExitStack()
        self.addCleanup(self.stack.close)
        for name, value in [("explanations_table", self.explanations), ("doubts_table", self.doubts), ("table", MemoryTable("id"))]:
            self.stack.enter_context(mock.patch.object(LAMBDA, name, value))

    def ask(self, user, question):
        event = {"requestContext": {"authorizer": {"jwt": {"claims": {"sub": user}}}}, "body": json.dumps({"postId": "p1", "question": question})}
        with mock.patch.object(LAMBDA, "get_post", return_value=self.post), mock.patch.object(LAMBDA, "ensure_post_explanation", return_value=("Saved explanation", True, True)):
            return json.loads(LAMBDA.handle_ask_doubt(event)["body"])

    def test_public_question_reused_across_users_without_user_identity(self):
        with mock.patch.object(LAMBDA, "call_bedrock_text", return_value="Keys match queries.") as model:
            self.ask("alice", "How do attention keys work?")
            self.ask("bob", "How do attention keys work?")
        self.assertEqual(model.call_count, 1)
        answer = next(v for v in self.doubts.items.values() if v.get("answer"))
        self.assertNotIn("userId", answer)

    def test_personal_question_stays_per_user(self):
        with mock.patch.object(LAMBDA, "call_bedrock_text", return_value="An explanation.") as model:
            self.ask("alice", "Why is my model failing?")
            self.ask("bob", "Why is my model failing?")
            self.ask("alice", "Why is my model failing?")
        self.assertEqual(model.call_count, 2)

    def test_changed_source_invalidates_answer(self):
        with mock.patch.object(LAMBDA, "call_bedrock_text", return_value="An explanation.") as model:
            self.ask("alice", "How do attention keys work?")
            self.post["body"] = "Corrected lesson text."
            self.ask("bob", "How do attention keys work?")
        self.assertEqual(model.call_count, 2)

    def test_non_public_post_answers_are_not_shared(self):
        self.post["visibility"] = "private"
        with mock.patch.object(LAMBDA, "call_bedrock_text", return_value="An explanation.") as model:
            self.ask("alice", "How do attention keys work?")
            self.ask("bob", "How do attention keys work?")
        self.assertEqual(model.call_count, 2)

    def test_expired_explanation_is_not_a_cache_hit(self):
        source_hash = LAMBDA.explanation_source_hash(self.post)
        LAMBDA.persist_post_explanation("p1", self.post, quality.ContentCatalogTests.complete_explanation(), source_hash)
        for value in self.explanations.items.values(): value["expiresAt"] = 1
        self.assertEqual(LAMBDA.read_explanation_cache("p1", source_hash), "")

    def test_post_backfill_requires_unchanged_existing_source(self):
        with mock.patch.object(LAMBDA.table, "update_item") as update:
            LAMBDA.persist_post_explanation("p1", self.post, "answer", LAMBDA.explanation_source_hash(self.post))
        condition = update.call_args.kwargs["ConditionExpression"]
        self.assertTrue(condition.check(self.post))
        self.assertFalse(condition.check({}))
        self.assertFalse(condition.check({**self.post, "body": "edited"}))

    def test_active_lease_blocks_duplicate_generation_and_releases_on_failure(self):
        with LAMBDA.generation_lease(self.explanations, "explanationId", "same"):
            with self.assertRaises(LAMBDA.GenerationBusy):
                with LAMBDA.generation_lease(self.explanations, "explanationId", "same"): pass
        with self.assertRaises(ValueError):
            with LAMBDA.generation_lease(self.explanations, "explanationId", "same"): raise ValueError()
        with LAMBDA.generation_lease(self.explanations, "explanationId", "same"): pass

    def test_expired_lease_recovers_and_expired_answer_is_replaced(self):
        with mock.patch.object(LAMBDA, "call_bedrock_text", return_value="An explanation.") as model:
            self.ask("alice", "How do attention keys work?")
            for value in self.doubts.items.values(): value["expiresAt"] = 1
            self.ask("bob", "How do attention keys work?")
        self.assertEqual(model.call_count, 2)

    def test_inline_explanation_from_old_source_is_not_reused(self):
        explanation = quality.ContentCatalogTests.complete_explanation()
        self.post.update(aiDetailedExplanation=explanation, aiDetailedExplanationVersion=LAMBDA.EXPLANATION_SCHEMA_VERSION, aiDetailedExplanationSourceHash="old")
        with mock.patch.object(LAMBDA, "generate_detailed_explanation", return_value=explanation) as model:
            LAMBDA.ensure_post_explanation("p1", self.post)
            LAMBDA.ensure_post_explanation("p1", self.post)
        self.assertEqual(model.call_count, 1)

    def test_cache_read_failure_does_not_trigger_ai(self):
        with mock.patch.object(self.explanations, "get_item", side_effect=RuntimeError("db unavailable")), mock.patch.object(LAMBDA, "generate_detailed_explanation") as model:
            with self.assertRaises(RuntimeError): LAMBDA.ensure_post_explanation("p1", self.post)
            model.assert_not_called()

    def test_moderated_posts_cannot_be_read_through_ai_cache(self):
        with mock.patch.object(LAMBDA.table, "get_item", return_value={"Item": {**self.post, "moderationStatus": "pending"}}):
            self.assertIsNone(LAMBDA.get_post("p1", consistent_read=True))
