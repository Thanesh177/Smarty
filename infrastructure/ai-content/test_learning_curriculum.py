"""Local logic tests only: no model invocation, credentials, or cloud writes."""
import hashlib
import json
import unittest
from contextlib import ExitStack
from unittest import mock

import test_content_quality as quality
from test_content_quality import LAMBDA
from test_shared_cache import MemoryTable, ConditionalFailure

GENERATE_POST = LAMBDA.generate_specific_post
GENERATE_DETAILS = LAMBDA.generate_detailed_explanation


class LearningCurriculumTests(unittest.TestCase):
    def setUp(self):
        self.stack = ExitStack()
        self.addCleanup(self.stack.close)
        self.posts = MemoryTable("id")
        self.progress = MemoryTable("explanationId")
        self.stack.enter_context(mock.patch.object(LAMBDA, "table", self.posts))
        self.stack.enter_context(mock.patch.object(LAMBDA, "explanations_table", self.progress))
        self.stack.enter_context(mock.patch.object(LAMBDA, "reserve_generation_topic", return_value="Artificial Intelligence"))
        self.stack.enter_context(mock.patch.object(LAMBDA, "paginated_scan_recent_posts", return_value=[]))
        self.stack.enter_context(mock.patch.object(LAMBDA, "fetch_pexels_image", return_value=None))
        self.stack.enter_context(mock.patch.object(LAMBDA, "get_cached_image", return_value="default/tech.jpg"))
        self.stack.enter_context(mock.patch.object(LAMBDA, "generate_detailed_explanation", return_value=""))
        self.generate = self.stack.enter_context(mock.patch.object(LAMBDA, "generate_specific_post", return_value={
            "title": "How model training changes the weights used for inference",
            "body": "A specific model mechanism.\n\nA concrete example with a constraint.",
            "image_search_query": "model weights training computer",
        }))

    def publish(self, slot):
        return json.loads(LAMBDA.create_post(publication_id=slot)["body"])

    def test_every_topic_has_a_unique_ordered_basic_to_advanced_path(self):
        levels = {"foundation": 0, "intermediate": 1, "advanced": 2}
        for topic in LAMBDA.BASE_TOPICS:
            path = LAMBDA.topic_learning_path(topic)
            self.assertEqual(path[0]["level"], "foundation", topic)
            self.assertEqual(path[-1]["level"], "advanced", topic)
            self.assertGreaterEqual(len(path), 7, topic)
            self.assertEqual(len(path), len({item["subTopic"] for item in path}), topic)
            self.assertEqual([levels[item["level"]] for item in path], sorted(levels[item["level"]] for item in path))
            for index, item in enumerate(path):
                self.assertNotEqual(item["subTopic"].lower(), topic.lower())
                self.assertFalse(LAMBDA.is_generic_text(item["subTopic"]))
                target = LAMBDA.learning_target_for_topic(topic, index)
                self.assertEqual(target["learningOrder"], index + 1)
                self.assertEqual(target["prerequisiteSubject"], path[index - 1]["subTopic"] if index else "")
                if index + 1 < len(path):
                    following = LAMBDA.learning_target_for_topic(topic, index + 1)
                    self.assertEqual(target["nextLearningPostId"], LAMBDA.learning_post_id(following["learningPathId"], following["learningOrder"]))
            self.assertIsNone(LAMBDA.learning_target_for_topic(topic, len(path)))

    def test_ai_path_teaches_tokens_before_attention_and_adaptation(self):
        path = LAMBDA.topic_learning_path("Artificial Intelligence")
        self.assertIn("training", path[0]["subTopic"])
        self.assertIn("byte-pair", path[1]["subTopic"])
        self.assertIn("embeddings", path[2]["subTopic"])
        self.assertIn("self-attention", path[3]["subTopic"])
        self.assertEqual(path[6]["level"], "advanced")

    def test_published_steps_advance_and_store_links_and_stage_in_database(self):
        first, second = self.publish("slot-one")["post"], self.publish("slot-two")["post"]
        self.assertEqual(first["learningOrder"], 1)
        self.assertEqual(second["learningOrder"], 2)
        self.assertEqual(first["nextLearningPostId"], second["id"])
        self.assertEqual(second["previousLearningPostId"], first["id"])
        self.assertEqual(first["learningLevel"], "foundation")
        self.assertTrue(first["learningObjective"].startswith("Explain why training"))
        self.assertEqual(LAMBDA.read_learning_path_state("Artificial Intelligence")["nextIndex"], 2)
        self.assertEqual(self.generate.call_count, 2)

    def test_slot_retry_returns_same_lesson_without_generating_or_advancing(self):
        first = self.publish("same-slot")["post"]
        second = self.publish("same-slot")["post"]
        self.assertEqual(first["id"], second["id"])
        self.assertEqual(self.generate.call_count, 1)
        self.assertEqual(LAMBDA.read_learning_path_state("Artificial Intelligence")["nextIndex"], 1)

    def test_failed_draft_does_not_skip_the_missing_lesson(self):
        self.generate.return_value = None
        with self.assertRaises(RuntimeError): self.publish("draft-failure")
        self.assertEqual(self.posts.items, {})
        self.assertEqual(LAMBDA.read_learning_path_state("Artificial Intelligence")["nextIndex"], 0)
        self.generate.return_value = {"title": "Training changes weights", "body": "Mechanism.\n\nExample."}
        recovered = self.publish("draft-failure")["post"]
        self.assertEqual(recovered["learningOrder"], 1)

    def test_crash_after_publication_is_reconciled_without_another_model_call(self):
        with mock.patch.object(LAMBDA, "complete_learning_step", side_effect=RuntimeError("progress write failed")):
            with self.assertRaises(RuntimeError): self.publish("interrupted-slot")
        self.assertEqual(len(self.posts.items), 1)
        self.assertEqual(LAMBDA.read_learning_path_state("Artificial Intelligence")["nextIndex"], 0)
        recovered = self.publish("interrupted-slot")["post"]
        self.assertEqual(recovered["learningOrder"], 1)
        self.assertEqual(self.generate.call_count, 1)
        self.assertEqual(LAMBDA.read_learning_path_state("Artificial Intelligence")["nextIndex"], 1)

    def test_failed_post_write_never_advances_progress(self):
        with mock.patch.object(self.posts, "put_item", side_effect=RuntimeError("database unavailable")):
            with self.assertRaises(RuntimeError): self.publish("failed-write")
        self.assertEqual(LAMBDA.read_learning_path_state("Artificial Intelligence")["nextIndex"], 0)

    def test_busy_path_does_not_generate_a_concurrent_step(self):
        with LAMBDA.generation_lease(self.progress, "explanationId", LAMBDA.learning_path_id("Artificial Intelligence")):
            with self.assertRaises(LAMBDA.GenerationBusy): self.publish("busy-slot")
        self.generate.assert_not_called()

    def test_database_failure_stops_ai_instead_of_using_random_fallback(self):
        with mock.patch.object(LAMBDA, "read_learning_path_state", side_effect=RuntimeError("cache unavailable")):
            with self.assertRaises(RuntimeError): self.publish("no-cache-slot")
        self.generate.assert_not_called()

    def test_deleted_lesson_is_not_republished_by_a_schedule_retry(self):
        first = self.publish("deleted-slot")["post"]
        self.posts.items.pop(first["id"])
        result = self.publish("deleted-slot")
        self.assertNotIn("post", result)
        self.assertEqual(self.generate.call_count, 1)
        self.assertEqual(LAMBDA.read_learning_path_state("Artificial Intelligence")["nextIndex"], 1)

    def test_completed_paths_do_not_restart_with_duplicate_basics(self):
        state = LAMBDA.read_learning_path_state("Artificial Intelligence")
        self.progress.items[state["explanationId"]] = {**state, "nextIndex": len(LAMBDA.topic_learning_path("Artificial Intelligence")), "progressionVersion": 20}
        self.assertIn("complete", self.publish("completed-slot")["message"])
        self.generate.assert_not_called()

    def test_catalog_changes_fail_closed_instead_of_resetting_progress(self):
        self.publish("first-slot")
        state = self.progress.items[LAMBDA.learning_path_id("Artificial Intelligence")]
        state["catalogSignature"] = "unexpected-order"
        with self.assertRaisesRegex(RuntimeError, "version the curriculum"): self.publish("changed-slot")
        self.assertEqual(self.generate.call_count, 1)

    def test_progress_updates_are_conditional_and_cannot_skip_steps(self):
        topic = "Artificial Intelligence"
        state = LAMBDA.read_learning_path_state(topic)
        first = LAMBDA.learning_target_for_topic(topic, 0)
        LAMBDA.complete_learning_step(state, first)
        with self.assertRaises(ConditionalFailure): LAMBDA.complete_learning_step(state, first)
        with self.assertRaisesRegex(RuntimeError, "skip"):
            LAMBDA.complete_learning_step(LAMBDA.read_learning_path_state(topic), LAMBDA.learning_target_for_topic(topic, 2))

    def test_old_source_hash_unchanged_but_stage_changes_invalidate_curriculum_cache(self):
        post = {"title": "A lesson", "body": "A source", "topic": "Physics"}
        baseline = hashlib.sha256("\n".join(LAMBDA.normalize_text(post.get(field) or "", 12000) for field in LAMBDA.EXPLANATION_SOURCE_FIELDS).encode()).hexdigest()
        self.assertEqual(LAMBDA.explanation_source_hash(post), baseline)
        self.assertNotEqual(LAMBDA.explanation_source_hash({**post, "learningLevel": "foundation"}), LAMBDA.explanation_source_hash({**post, "learningLevel": "advanced"}))

    def test_teaching_context_has_level_contract_and_specific_next_subject(self):
        for index in (0, 3, 6):
            target = LAMBDA.learning_target_for_topic("Artificial Intelligence", index)
            context = json.loads(LAMBDA.learning_teaching_context(target))
            self.assertEqual(context["stage"], target["learningLevel"])
            self.assertEqual(context["instruction"], LAMBDA.LEVEL_INSTRUCTIONS[target["learningLevel"]])
            self.assertEqual(context["nextSubject"], target["nextLearningSubject"])

    def test_post_and_detailed_lesson_prompts_use_the_assigned_depth(self):
        target = LAMBDA.learning_target_for_topic("Artificial Intelligence", 6)
        # Exercise the real post builder, not the publishing fixture.
        with mock.patch.object(LAMBDA, "call_bedrock_text", return_value='{"error":"uncertain"}') as model:
            GENERATE_POST("Artificial Intelligence", target["subTopic"], LAMBDA.CONTENT_ANGLES[0], [], target)
        prompt = model.call_args.args[0]
        self.assertIn('"stage": "advanced"', prompt)
        self.assertIn(target["prerequisiteSubject"], prompt)
        self.assertIn("test assumptions and edge cases", prompt)
        with mock.patch.object(LAMBDA, "call_bedrock_text", return_value=quality.ContentCatalogTests.complete_explanation()) as details:
            GENERATE_DETAILS("LoRA adapters", "Source", "Artificial Intelligence", target["subTopic"], learning_target=target)
        self.assertIn('"stage": "advanced"', details.call_args.args[0])
        self.assertIn(target["nextLearningSubject"], details.call_args.args[0])

    def test_generated_explanation_is_source_matched_in_post_before_cache_backfill(self):
        with mock.patch.object(LAMBDA, "generate_detailed_explanation", return_value=quality.ContentCatalogTests.complete_explanation()), mock.patch.object(LAMBDA, "persist_post_explanation"):
            post = self.publish("saved-inline")["post"]
        self.assertEqual(post["aiDetailedExplanationSourceHash"], LAMBDA.explanation_source_hash(post))
        self.assertEqual(post["aiDetailedExplanationModelId"], LAMBDA.DETAILS_MODEL_ID)
        with mock.patch.object(LAMBDA, "generate_detailed_explanation") as details:
            result = LAMBDA.ensure_post_explanation(post["id"], post)
        self.assertTrue(result[1])
        details.assert_not_called()


if __name__ == "__main__":
    unittest.main()
