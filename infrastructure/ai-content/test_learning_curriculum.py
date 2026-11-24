"""Local logic tests only: no model invocation, credentials, or cloud writes."""
import hashlib
import json
import unittest
from contextlib import ExitStack
from unittest import mock

import test_content_quality as quality
from content_catalog import FOCUSED_STUDY
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
        self.details = self.stack.enter_context(mock.patch.object(LAMBDA, "generate_detailed_explanation", return_value=quality.ContentCatalogTests.complete_explanation()))
        self.generate = self.stack.enter_context(mock.patch.object(LAMBDA, "generate_specific_post", return_value={
            "title": "How model training changes the weights used for inference",
            "body": "A specific model mechanism.\n\nA concrete example with a constraint.",
            "image_search_query": "model weights training computer",
        }))

    def publish(self, slot, context=None):
        return json.loads(LAMBDA.create_post(publication_id=slot, context=context)["body"])

    def test_quiz_examples_extend_paths_without_changing_any_published_position(self):
        for row in FOCUSED_STUDY:
            topic = row["feedTopic"]
            old = LAMBDA.topic_learning_path(topic, include_focused=False)
            path = LAMBDA.topic_learning_path(topic)
            self.assertEqual(path[:len(old)], old)
            self.assertIn(row["feedAngle"], {entry["subTopic"] for entry in path[len(old):]})

    def test_accepts_the_original_signature_but_preserves_saved_progress_and_rejects_unknown_paths(self):
        topic = "Physics"
        path_id = LAMBDA.learning_path_id(topic)
        old_path = LAMBDA.topic_learning_path(topic, include_focused=False)
        old_count = len(old_path)
        old_signature = hashlib.sha256(json.dumps(old_path, sort_keys=True).encode()).hexdigest()
        saved = {"explanationId": path_id, "nextIndex": old_count, "progressionVersion": old_count,
                 "catalogSignature": old_signature, "lastPostId": LAMBDA.learning_post_id(path_id, old_count)}
        self.progress.put_item(Item=saved)
        state = LAMBDA.read_learning_path_state(topic)
        self.assertEqual(state["nextIndex"], old_count)
        self.assertEqual(state["lastPostId"], saved["lastPostId"])
        self.assertEqual(self.progress.get_item(Key={"explanationId": path_id})["Item"]["catalogSignature"], old_signature)
        target = LAMBDA.learning_target_for_topic(topic, old_count)
        self.assertEqual(target["previousLearningPostId"], saved["lastPostId"])
        LAMBDA.complete_learning_step(state, target)
        self.assertEqual(LAMBDA.read_learning_path_state(topic)["nextIndex"], old_count + 1)
        self.progress.put_item(Item={**saved, "catalogSignature": "unrecognized"})
        with self.assertRaisesRegex(RuntimeError, "Learning path changed"):
            LAMBDA.read_learning_path_state(topic)

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

    def test_word_meanings_are_saved_with_the_post_before_it_is_published(self):
        from post_glossary import make_glossary, source_hash
        draft = self.generate.return_value
        entries = [{"term": "model", "meaning": "A computer system that learns patterns to make estimates from new inputs."}]
        draft["postGlossary"] = make_glossary(draft, entries)
        first = self.publish("glossary-slot")["post"]
        replay = self.publish("glossary-slot")["post"]
        self.assertEqual(first["postGlossary"]["terms"], entries)
        self.assertEqual(first["postGlossary"]["sourceHash"], source_hash(first))
        self.assertEqual(self.posts.items[first["id"]]["postGlossary"], first["postGlossary"])
        self.assertEqual(replay["postGlossary"], first["postGlossary"])
        self.assertEqual(self.generate.call_count, 1)

    def test_pending_legacy_draft_gets_word_meanings_before_publication(self):
        self.details.side_effect = RuntimeError("Lesson preparation interrupted")
        with self.assertRaises(RuntimeError):
            self.publish("pending-legacy")
        draft = next(item for item in self.progress.items.values() if item.get("entryType") == "learningDraft")
        draft["aiPost"].pop("postGlossary")
        self.details.side_effect = None
        post = self.publish("pending-legacy")["post"]
        self.assertEqual(post["postGlossary"]["version"], 1)
        self.assertEqual(self.generate.call_count, 2)

    def test_scheduled_publication_leases_cover_the_invocation_without_a_long_lockout(self):
        event = {"source": "smarty.learning.schedule", "scheduledTime": "2026-11-12T02:30:00Z"}
        context = mock.Mock()
        context.get_remaining_time_in_millis.side_effect = [182701, 182000, 175000, 170000]
        slot = LAMBDA.scheduled_post_id(event)
        path = LAMBDA.learning_path_id("Artificial Intelligence")
        with mock.patch.object(LAMBDA, "generation_lease", wraps=LAMBDA.generation_lease) as lease:
            self.assertEqual(LAMBDA.lambda_handler(event, context)["statusCode"], 200)
        self.assertEqual(lease.call_args_list, [
            mock.call(self.progress, "explanationId", "learning-publication#" + slot, 198),
            mock.call(self.progress, "explanationId", path, 197),
        ])

    def test_busy_scheduled_slot_cannot_start_a_second_generation(self):
        event = {"source": "smarty.learning.schedule", "scheduledTime": "2026-11-12T02:30:00Z"}
        identity = "learning-publication#" + LAMBDA.scheduled_post_id(event)
        with LAMBDA.generation_lease(self.progress, "explanationId", identity):
            with mock.patch.object(self.posts, "put_item", wraps=self.posts.put_item) as write_post:
                with self.assertRaises(LAMBDA.GenerationBusy):
                    LAMBDA.lambda_handler(event, None)
                write_post.assert_not_called()
        self.generate.assert_not_called()
        self.details.assert_not_called()

    def test_history_source_failure_publishes_one_reviewed_alternate_for_the_slot(self):
        primary, alternate = "World History", "Artificial Intelligence"
        event = {"source": "smarty.learning.schedule", "scheduledTime": "2026-11-12T02:30:00Z"}
        draft = json.dumps(self.training_draft())
        approval = '{"accurate":true,"readerReady":true,"issues":[]}'
        evidence = [
            {"mode": "history", "sources": []},
            {"mode": "concept", "sources": []},
        ]
        with (mock.patch.object(LAMBDA, "generate_specific_post", GENERATE_POST),
              mock.patch.object(LAMBDA, "reserve_generation_topic", side_effect=[primary, alternate]) as reserve,
              mock.patch.object(LAMBDA, "load_editorial_evidence", side_effect=evidence) as sources,
              mock.patch.object(LAMBDA, "choose_content_angle", return_value=LAMBDA.resolve_content_angle("mechanism")),
              mock.patch.object(LAMBDA, "call_bedrock_text", side_effect=[draft, approval]) as model):
            first = json.loads(LAMBDA.lambda_handler(event, None)["body"])["post"]
            replay = json.loads(LAMBDA.lambda_handler(event, None)["body"])["post"]
        self.assertEqual(first["id"], replay["id"])
        self.assertEqual(first["topic"], alternate)
        self.assertEqual(first["learningOrder"], 1)
        self.assertTrue(first["aiDetailedExplanation"])
        self.assertEqual(list(self.posts.items), [first["id"]])
        self.assertEqual(LAMBDA.read_learning_path_state(primary)["nextIndex"], 0)
        self.assertEqual(LAMBDA.read_learning_path_state(alternate)["nextIndex"], 1)
        self.assertEqual(reserve.call_args_list, [mock.call(), mock.call(exclude_topics={primary})])
        self.assertEqual([call.args[0] for call in sources.call_args_list], [primary, alternate])
        self.assertEqual(model.call_count, 2)  # one writer and one reviewer; no history draft

    def test_exhausted_draft_retries_remain_bound_to_one_alternate(self):
        primary, alternate = "Artificial Intelligence", "Physics"
        complete_draft = self.generate.return_value
        self.generate.side_effect = [None, None, complete_draft]
        with (mock.patch.object(LAMBDA, "reserve_generation_topic", side_effect=[primary, alternate]) as reserve,
              mock.patch.object(LAMBDA, "MAX_GENERATION_ATTEMPTS", 1)):
            with self.assertRaises(LAMBDA.PostDraftsRejected):
                self.publish("double-rejection")
            self.assertEqual(self.posts.items, {})
            post = self.publish("double-rejection")["post"]
        self.assertEqual(post["topic"], alternate)
        self.assertEqual(post["learningOrder"], 1)
        self.assertEqual([call.args[0] for call in self.generate.call_args_list], [primary, alternate, alternate])
        self.assertEqual(reserve.call_args_list, [mock.call(), mock.call(exclude_topics={primary})])
        self.assertEqual(LAMBDA.read_learning_path_state(primary)["nextIndex"], 0)
        self.assertEqual(LAMBDA.read_learning_path_state(alternate)["nextIndex"], 1)

    def test_alternate_is_deferred_to_fresh_invocation_when_time_is_low(self):
        primary, alternate = "World History", "Artificial Intelligence"
        context = mock.Mock()
        context.get_remaining_time_in_millis.return_value = 130000
        complete_draft = self.generate.return_value
        self.generate.side_effect = [LAMBDA.HistoricalEvidenceUnavailable("no source"), complete_draft]
        with mock.patch.object(LAMBDA, "reserve_generation_topic", side_effect=[primary, alternate]) as reserve:
            with self.assertRaises(RuntimeError):
                self.publish("deferred-alternate", context)
            self.assertEqual([call.args[0] for call in self.generate.call_args_list], [primary])
            self.assertEqual(self.posts.items, {})
            self.details.assert_not_called()
            context.get_remaining_time_in_millis.return_value = 183000
            post = self.publish("deferred-alternate", context)["post"]
        self.assertEqual([call.args[0] for call in self.generate.call_args_list], [primary, alternate])
        self.assertEqual(reserve.call_args_list, [mock.call(), mock.call(exclude_topics={primary})])
        self.assertEqual(post["topic"], alternate)
        self.assertEqual(LAMBDA.read_learning_path_state(primary)["nextIndex"], 0)

    def test_model_outage_keeps_the_original_scheduled_topic_on_retry(self):
        primary = "Artificial Intelligence"
        complete_draft = self.generate.return_value
        self.generate.side_effect = [LAMBDA.PostModelUnavailable("model offline"), complete_draft]
        with mock.patch.object(LAMBDA, "reserve_generation_topic", return_value=primary) as reserve:
            with self.assertRaises(LAMBDA.PostModelUnavailable):
                self.publish("model-unavailable")
            self.assertEqual(self.posts.items, {})
            post = self.publish("model-unavailable")["post"]
        reserve.assert_called_once_with()
        self.assertEqual([call.args[0] for call in self.generate.call_args_list], [primary, primary])
        self.assertEqual(post["topic"], primary)
        self.assertEqual(post["learningOrder"], 1)

    def test_recovery_after_alternate_post_write_never_rebinds_to_primary(self):
        primary, alternate = "World History", "Artificial Intelligence"
        complete_draft = self.generate.return_value
        self.generate.side_effect = [
            LAMBDA.HistoricalEvidenceUnavailable("no source"),
            complete_draft,
            {**complete_draft, "title": "How Trade Routes Connect Goods and Ideas"},
        ]
        with mock.patch.object(LAMBDA, "reserve_generation_topic",
                               side_effect=[primary, alternate, primary]) as reserve:
            with mock.patch.object(LAMBDA, "complete_learning_step",
                                   side_effect=RuntimeError("progress write failed")):
                with self.assertRaisesRegex(RuntimeError, "progress write failed"):
                    self.publish("alternate-crash")
            self.assertEqual(len(self.posts.items), 1)
            alternate_post_id = next(iter(self.posts.items))
            self.assertEqual(LAMBDA.read_learning_path_state(alternate)["nextIndex"], 0)

            # The former primary can independently publish in another slot.
            self.assertEqual(self.publish("separate-slot")["post"]["topic"], primary)
            replay = self.publish("alternate-crash")["post"]

        self.assertEqual(replay["id"], alternate_post_id)
        self.assertEqual(replay["topic"], alternate)
        self.assertEqual(len(self.posts.items), 2)
        self.assertEqual(reserve.call_count, 3)
        self.assertEqual(self.generate.call_count, 3)
        self.assertEqual(LAMBDA.read_learning_path_state(primary)["nextIndex"], 1)
        self.assertEqual(LAMBDA.read_learning_path_state(alternate)["nextIndex"], 1)

    def test_completed_alternate_is_not_replaced_on_replay(self):
        primary, alternate = "World History", "Physics"
        state = LAMBDA.read_learning_path_state(alternate)
        completed_index = len(LAMBDA.topic_learning_path(alternate))
        self.progress.put_item(Item={**state, "nextIndex": completed_index, "progressionVersion": completed_index})
        self.generate.side_effect = LAMBDA.HistoricalEvidenceUnavailable("no source")
        with mock.patch.object(LAMBDA, "reserve_generation_topic", side_effect=[primary, alternate]) as reserve:
            first = self.publish("complete-fallback")
            replay = self.publish("complete-fallback")
        self.assertEqual(first, replay)
        self.assertEqual(first["topic"], alternate)
        self.assertIn("complete", first["message"])
        self.assertEqual(reserve.call_count, 2)
        self.assertEqual(self.generate.call_count, 1)
        self.assertEqual(self.posts.items, {})
        self.assertEqual(LAMBDA.read_learning_path_state(primary)["nextIndex"], 0)

    @staticmethod
    def training_draft():
        mechanism = (
            "Imagine a model gives a bad estimate. During training it compares the estimate "
            "with a target, then changes internal numbers called weights to reduce its error. "
            "At inference, when it makes a new estimate, it uses those saved weights rather "
            "than learning them again. The new estimate can still be wrong if the example "
            "differs greatly from the examples the model trained on."
        )
        example = (
            "Consider a toy model that predicts how long a bus ride takes. During training, "
            "it compares its guesses with recorded trips and adjusts the weights that shape "
            "those guesses. Later a rider asks about a trip, and inference uses those saved "
            "weights to produce an estimate without changing them. If the road is closed "
            "and the training data never included a detour, the estimate may still be wrong. "
            "A prediction is not a new training example."
        )
        return {"title": "Why AI Training Changes How a Model Answers",
                "mechanismParagraph": mechanism, "exampleParagraph": example, "sourceIds": [], "wordMeanings": []}

    def test_scheduled_post_uses_readability_feedback_without_an_extra_review_pass(self):
        draft = self.training_draft()
        unclear = {**draft, "mechanismParagraph": draft["mechanismParagraph"].replace(
            "At inference, when it makes a new estimate, it", "At inference it",
        )}
        barrier = '{"accurate":true,"readerReady":false,"issues":["Explain inference when it first appears"]}'
        approval = '{"accurate":true,"readerReady":true,"issues":[]}'
        with (mock.patch.object(LAMBDA, "generate_specific_post", GENERATE_POST),
              mock.patch.object(LAMBDA, "load_editorial_evidence", return_value={"mode": "concept", "sources": []}) as evidence,
              mock.patch.object(LAMBDA, "choose_content_angle", return_value=LAMBDA.resolve_content_angle("mechanism")),
              mock.patch.object(LAMBDA, "call_bedrock_text",
                                side_effect=[json.dumps(unclear), barrier, json.dumps(draft), approval]) as model):
            post = self.publish("readable-draft")["post"]
        self.assertEqual(post["learningOrder"], 1)
        self.assertEqual(model.call_count, 4)
        evidence.assert_called_once_with("Artificial Intelligence", post["subTopic"], "mechanism")
        self.assertNotIn("Explain inference when it first appears", model.call_args_list[0].args[0])
        self.assertIn("Explain inference when it first appears", model.call_args_list[2].args[0])

    def test_history_retries_reuse_evidence_across_a_lens_change(self):
        topic = "World History"
        target = LAMBDA.learning_target_for_topic(topic, 0)
        post_id = LAMBDA.learning_post_id(target["learningPathId"], target["learningOrder"])
        pack = {"mode": "history", "sources": [{
            "id": "primary-1",
            "excerpt": "Distinct evidence for the upcoming history lesson.",
        }]}
        with (mock.patch.object(LAMBDA, "generate_specific_post", GENERATE_POST),
              mock.patch.object(LAMBDA, "load_editorial_evidence", return_value=pack) as evidence,
              mock.patch.object(LAMBDA, "MAX_GENERATION_ATTEMPTS", 2),
              mock.patch.object(LAMBDA, "choose_content_angle", return_value=LAMBDA.resolve_content_angle("tradeoff")),
              mock.patch.object(LAMBDA, "call_bedrock_text", return_value='{"error":"uncertain"}') as model):
            with self.assertRaises(LAMBDA.PostDraftsRejected):
                LAMBDA.prepare_learning_source(topic, target, post_id)
        evidence.assert_called_once()
        self.assertEqual(evidence.call_args.args[:2], (topic, target["subTopic"]))
        self.assertEqual(model.call_count, 2)
        self.assertIn("Hidden tradeoff", model.call_args_list[0].args[0])
        self.assertIn("Inside the mechanism", model.call_args_list[1].args[0])
        for call in model.call_args_list:
            self.assertIn(pack["sources"][0]["excerpt"], call.args[0])
        self.assertEqual(self.progress.items, {})

    def test_scheduled_post_retries_repeated_paragraphs_without_spending_a_review_call(self):
        draft = self.training_draft()
        repeated = {**draft, "exampleParagraph": draft["mechanismParagraph"]}
        approval = '{"accurate":true,"readerReady":true,"issues":[]}'
        with (mock.patch.object(LAMBDA, "generate_specific_post", GENERATE_POST),
              mock.patch.object(LAMBDA, "load_editorial_evidence", return_value={"mode": "concept", "sources": []}),
              mock.patch.object(LAMBDA, "choose_content_angle", return_value=LAMBDA.resolve_content_angle("mechanism")),
              mock.patch.object(LAMBDA, "call_bedrock_text",
                                side_effect=[json.dumps(repeated), json.dumps(draft), approval]) as model):
            post = self.publish("repeated-draft")["post"]
        self.assertEqual(post["learningOrder"], 1)
        self.assertEqual(model.call_count, 3)
        self.assertIn("Make paragraph two add a worked example", model.call_args_list[1].args[0])
        review = model.call_args_list[2].args[0]
        self.assertIn(LAMBDA.learning_target_for_topic("Artificial Intelligence", 0)["subTopic"], review)
        self.assertIn('"stage": "foundation"', review)
        self.assertIn(LAMBDA.POST_PUBLICATION_SAFETY, review)

    def test_scheduled_post_retries_bad_length_with_exact_counts_and_same_lesson(self):
        draft = self.training_draft()
        wrong_lengths = {**draft, "mechanismParagraph": "This is too short.",
                         "exampleParagraph": draft["exampleParagraph"] + (" extra" * 135)}
        approval = '{"accurate":true,"readerReady":true,"issues":[]}'
        with (mock.patch.object(LAMBDA, "generate_specific_post", GENERATE_POST),
              mock.patch.object(LAMBDA, "load_editorial_evidence", return_value={"mode": "concept", "sources": []}),
              mock.patch.object(LAMBDA, "choose_content_angle", return_value=LAMBDA.resolve_content_angle("mechanism")),
              mock.patch.object(LAMBDA, "call_bedrock_text",
                                side_effect=[json.dumps(wrong_lengths), json.dumps(draft), approval]) as model):
            post = self.publish("length-retry")["post"]
        self.assertEqual(post["learningOrder"], 1)
        self.assertEqual(model.call_count, 3)
        retry = model.call_args_list[1].args[0]
        self.assertIn("paragraph 1: 4 words", retry)
        self.assertIn(f'paragraph 2: {len(wrong_lengths["exampleParagraph"].split())} words', retry)
        self.assertIn("accepted: 55-135 words each", retry)
        self.assertIn(LAMBDA.learning_target_for_topic("Artificial Intelligence", 0)["subTopic"], retry)

    def test_scheduled_os_post_gets_title_specific_feedback_before_review(self):
        topic = "Operating Systems"
        assigned = LAMBDA.learning_target_for_topic(topic, 0)["subTopic"]
        draft = {
            "title": "Why Launching an App Is Different From Opening a File",
            "mechanismParagraph": (
                "Opening a notes app gives the operating system two different objects to deal with. "
                "The program stored on disk is a set of instructions and data, rather like a recipe "
                "that nobody is following yet. A process is the running instance: it has its own state, "
                "access to memory, and a record of what it was doing when the operating system last paused it. "
                "The disk file can stay unchanged while that running state changes."
            ),
            "exampleParagraph": (
                "Imagine launching the same simple editor twice in an operating system that starts a separate "
                "process for each launch. You can type different words in the two windows because each process "
                "has its own state. If one exits, its state is released without removing the program from the disk "
                "or stopping the other process. This is not a promise that every pair of windows belongs to "
                "separate processes; an editor can manage two windows inside one process."
            ),
            "sourceIds": [],
            "wordMeanings": [],
        }
        corrected = {**draft, "title": "Why Running a Program Creates a Process"}
        approval = '{"accurate":true,"readerReady":true,"issues":[]}'
        with (mock.patch.object(LAMBDA, "generate_specific_post", GENERATE_POST),
              mock.patch.object(LAMBDA, "reserve_generation_topic", return_value=topic),
              mock.patch.object(LAMBDA, "load_editorial_evidence", return_value={"mode": "concept", "sources": []}),
              mock.patch.object(LAMBDA, "choose_content_angle", return_value=LAMBDA.resolve_content_angle("mechanism")),
              mock.patch.object(LAMBDA, "review_concept_text", wraps=LAMBDA.review_concept_text) as editor,
              mock.patch.object(LAMBDA, "call_bedrock_text",
                                side_effect=[json.dumps(draft), json.dumps(corrected), approval]) as model):
            post = self.publish("os-title-retry")["post"]
        self.assertEqual(model.call_count, 3)
        editor.assert_called_once()
        initial, retry, review = model.call_args_list
        for prompt in (initial.args[0], retry.args[0]):
            self.assertIn(assigned, prompt)
            self.assertIn("at least 3 distinct", prompt)
            self.assertIn("process", prompt)
            self.assertIn("program", prompt)
        self.assertIn("Title matched 0 assignment terms; use at least 1", retry.args[0])
        self.assertIn(corrected["title"], review.args[0])
        self.assertNotIn(draft["title"], review.args[0])
        self.assertEqual(post["learningOrder"], 1)
        self.assertEqual(post["subTopic"], assigned)
        self.assertEqual(post["title"], corrected["title"])

    def test_invalid_model_json_logs_a_reason_without_logging_the_draft(self):
        raw = "Unparseable private draft text that must not reach logs."
        with (mock.patch.object(LAMBDA, "generate_specific_post", GENERATE_POST),
              mock.patch.object(LAMBDA, "load_editorial_evidence", return_value={"mode": "concept", "sources": []}),
              mock.patch.object(LAMBDA, "choose_content_angle", return_value=LAMBDA.resolve_content_angle("mechanism")),
              mock.patch.object(LAMBDA, "call_bedrock_text", return_value=raw),
              mock.patch.object(LAMBDA, "MAX_GENERATION_ATTEMPTS", 1),
              self.assertLogs(LAMBDA.logger, level="INFO") as captured):
            with self.assertRaises(LAMBDA.PostDraftsRejected):
                LAMBDA.create_post()
        logs = "\n".join(captured.output)
        self.assertIn("POST DRAFT REJECTED", logs)
        self.assertIn("reason=invalid_json", logs)
        self.assertNotIn(raw, logs)
        self.assertEqual(self.posts.items, {})

    def test_missing_history_sources_are_not_retried_in_same_invocation(self):
        topic = "World History"
        event = {"source": "smarty.learning.schedule", "scheduledTime": "2026-11-12T14:30:00Z"}
        context = mock.Mock()
        context.get_remaining_time_in_millis.return_value = 130000
        with (mock.patch.object(LAMBDA, "generate_specific_post", GENERATE_POST),
              mock.patch.object(LAMBDA, "reserve_generation_topic", return_value=topic),
              mock.patch.object(LAMBDA, "load_editorial_evidence", return_value={"mode": "history", "sources": []}) as source,
              mock.patch.object(LAMBDA, "call_bedrock_text") as model):
            with self.assertRaises(RuntimeError):
                LAMBDA.lambda_handler(event, context)
            source.assert_called_once()
            result = LAMBDA.lambda_handler({}, None)
        self.assertEqual(source.call_count, 2)
        model.assert_not_called()
        self.assertEqual(result["statusCode"], 503)
        self.assertEqual(result["headers"]["Retry-After"], "60")
        self.assertEqual(json.loads(result["body"])["code"], "historical_evidence_unavailable")
        self.assertEqual(self.posts.items, {})
        self.assertEqual(LAMBDA.read_learning_path_state(topic)["nextIndex"], 0)

    def test_model_service_failure_does_not_consume_draft_retries(self):
        error = LAMBDA.BotoCoreError()
        with (mock.patch.object(LAMBDA, "generate_specific_post", GENERATE_POST),
              mock.patch.object(LAMBDA, "load_editorial_evidence", return_value={"mode": "concept", "sources": []}),
              mock.patch.object(LAMBDA, "call_bedrock_text", side_effect=error) as model):
            result = LAMBDA.lambda_handler({}, None)
        model.assert_called_once()
        self.assertEqual(result["statusCode"], 503)
        self.assertEqual(json.loads(result["body"])["code"], "post_model_unavailable")
        self.assertEqual(self.posts.items, {})
        self.assertEqual(LAMBDA.read_learning_path_state("Artificial Intelligence")["nextIndex"], 0)

    def test_failed_draft_does_not_skip_the_missing_lesson(self):
        self.generate.return_value = None
        with self.assertRaises(LAMBDA.PostDraftsRejected):
            LAMBDA.create_post()
        self.assertEqual(self.posts.items, {})
        self.assertEqual(LAMBDA.read_learning_path_state("Artificial Intelligence")["nextIndex"], 0)
        self.generate.return_value = {"title": "Training changes weights", "body": "Mechanism.\n\nExample."}
        recovered = json.loads(LAMBDA.create_post()["body"])["post"]
        self.assertEqual(recovered["learningOrder"], 1)

    def test_unfit_project_retries_the_same_lesson_without_the_build(self):
        self.generate.side_effect = [None, self.generate.return_value]
        with (
            mock.patch.object(LAMBDA, "MAX_GENERATION_ATTEMPTS", 2),
            mock.patch.object(LAMBDA, "reserve_generation_topic", return_value="Physics"),
            mock.patch.object(LAMBDA, "choose_content_angle", return_value=LAMBDA.resolve_content_angle("make_something")),
        ):
            post = self.publish("project-did-not-fit")["post"]
        first, second = self.generate.call_args_list
        self.assertEqual(first.args[2]["id"], "make_something")
        self.assertEqual(second.args[2]["id"], "mechanism")
        self.assertEqual(first.args[:2], second.args[:2])
        self.assertEqual(first.args[4], second.args[4])
        self.assertEqual(post["contentAngle"], "mechanism")
        self.assertEqual(post["learningOrder"], 1)
        self.assertEqual(LAMBDA.read_learning_path_state("Physics")["nextIndex"], 1)

    def test_final_plain_lesson_attempt_retains_editorial_feedback(self):
        complete_draft = self.generate.return_value

        def draft_with_feedback(_topic, _subtopic, lens, _recent, _target, *, revision_notes, feedback, **_kwargs):
            if lens["id"] == "tradeoff":
                feedback.append("Distinguish training updates from predictions.")
                return None
            self.assertEqual(revision_notes, ["Distinguish training updates from predictions."])
            return complete_draft

        self.generate.side_effect = draft_with_feedback
        with (mock.patch.object(LAMBDA, "MAX_GENERATION_ATTEMPTS", 2),
              mock.patch.object(LAMBDA, "choose_content_angle", return_value=LAMBDA.resolve_content_angle("tradeoff"))):
            post = self.publish("same-topic-plain-lesson")["post"]
        first, second = self.generate.call_args_list
        self.assertEqual([first.args[2]["id"], second.args[2]["id"]], ["tradeoff", "mechanism"])
        self.assertEqual(first.args[:2], second.args[:2])
        self.assertEqual(first.args[4], second.args[4])
        self.assertEqual(post["learningOrder"], 1)
        self.assertEqual(post["contentAngle"], "mechanism")

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

    def test_empty_or_incomplete_lesson_is_not_published_or_advanced(self):
        for lesson in ('', 'A short incomplete outline.'):
            self.details.return_value = lesson
            with self.assertRaisesRegex(RuntimeError, 'remains unpublished'):
                self.publish('not-ready')
        self.assertEqual(self.posts.items, {})
        self.assertEqual(LAMBDA.read_learning_path_state('Artificial Intelligence')['nextIndex'], 0)
        self.assertEqual(self.generate.call_count, 1)

    def test_failed_lesson_retries_saved_source_instead_of_generating_another_post(self):
        self.details.return_value = ''
        with self.assertRaises(RuntimeError):
            self.publish('retry-lesson')
        self.generate.reset_mock()
        self.details.return_value = quality.ContentCatalogTests.complete_explanation()
        post = self.publish('retry-lesson')['post']
        self.assertEqual(post['learningOrder'], 1)
        self.assertTrue(post['aiDetailedExplanation'])
        self.generate.assert_not_called()

    def test_shared_lesson_saved_before_post_becomes_visible(self):
        write = self.posts.put_item
        def verify_ready(Item, **kwargs):
            source_hash = LAMBDA.explanation_source_hash(Item)
            self.assertEqual(LAMBDA.read_explanation_cache(Item['id'], source_hash, Item['body']), Item['aiDetailedExplanation'])
            self.assertEqual(Item['aiDetailedExplanationReviewVersion'], LAMBDA.EXPLANATION_REVIEW_VERSION)
            return write(Item=Item, **kwargs)
        with mock.patch.object(self.posts, 'put_item', side_effect=verify_ready):
            self.publish('ready-before-visible')

    def test_failed_feed_write_reuses_source_and_completed_lesson_on_retry(self):
        with mock.patch.object(self.posts, 'put_item', side_effect=RuntimeError('feed unavailable')):
            with self.assertRaises(RuntimeError):
                self.publish('retry-feed-write')
        post = self.publish('retry-feed-write')['post']
        self.assertEqual(self.generate.call_count, 1)
        self.assertEqual(self.details.call_count, 1)
        self.assertEqual(post['aiDetailedExplanation'], quality.ContentCatalogTests.complete_explanation())

    def test_shared_cache_failure_prevents_publication(self):
        with mock.patch.object(LAMBDA, 'cache_post_explanation', side_effect=RuntimeError('cache unavailable')):
            with self.assertRaises(RuntimeError):
                self.publish('failed-cache-write')
        self.assertEqual(self.posts.items, {})
        self.assertEqual(LAMBDA.read_learning_path_state('Artificial Intelligence')['nextIndex'], 0)

    def test_near_timeout_saves_source_and_defers_lesson_until_next_invocation(self):
        context = mock.Mock()
        context.get_remaining_time_in_millis.return_value = 60000
        with self.assertRaisesRegex(RuntimeError, 'draft saved'):
            LAMBDA.create_post(publication_id='deferred', context=context)
        self.details.assert_not_called()
        self.assertEqual(self.posts.items, {})
        context.get_remaining_time_in_millis.return_value = 180000
        LAMBDA.create_post(publication_id='deferred', context=context)
        self.assertEqual(self.generate.call_count, 1)
        self.assertEqual(self.details.call_count, 1)

    def test_ready_lesson_uses_default_image_when_illustration_would_risk_timeout(self):
        context = mock.Mock()
        context.get_remaining_time_in_millis.return_value = 180000
        lesson = self.details.return_value

        def finish_lesson(*_args, **_kwargs):
            context.get_remaining_time_in_millis.return_value = 74000
            return lesson

        self.details.side_effect = finish_lesson
        with (mock.patch.object(LAMBDA, "fetch_pexels_image", return_value=None) as lookup,
              mock.patch.object(LAMBDA, "upload_image_to_s3", return_value=None) as upload,
              mock.patch.object(LAMBDA, "get_cached_image", return_value=None) as scan,
              mock.patch.object(LAMBDA, "get_fallback_image", return_value="default/stock.jpg") as default):
            post = self.publish("optional-image-timeout", context)["post"]
        lookup.assert_not_called()
        upload.assert_not_called()
        scan.assert_not_called()
        default.assert_called_once()
        self.assertEqual(post["imageKey"], "default/stock.jpg")
        self.assertEqual(post["thumbKey"], "default/stock.jpg")
        self.assertEqual(post["aiDetailedExplanation"], lesson)
        self.assertEqual(list(self.posts.items), [post["id"]])
        self.assertEqual(LAMBDA.read_learning_path_state(post["topic"])["nextIndex"], 1)

    def test_draft_database_failure_does_not_call_the_lesson_model(self):
        write = self.progress.put_item
        def fail_draft(Item, **kwargs):
            if Item.get('entryType') == 'learningDraft':
                raise RuntimeError('draft write unavailable')
            return write(Item=Item, **kwargs)
        with mock.patch.object(self.progress, 'put_item', side_effect=fail_draft):
            with self.assertRaises(RuntimeError):
                self.publish('failed-draft-storage')
        self.details.assert_not_called()
        self.assertEqual(self.posts.items, {})

    def test_expired_draft_is_not_reused(self):
        self.details.return_value = ''
        with self.assertRaises(RuntimeError):
            self.publish('expired-draft')
        draft = next(item for item in self.progress.items.values() if item.get('entryType') == 'learningDraft')
        draft['expiresAt'] = 1
        self.details.return_value = quality.ContentCatalogTests.complete_explanation()
        self.publish('expired-draft')
        self.assertEqual(self.generate.call_count, 2)

    def test_old_editorial_draft_is_regenerated_without_changing_published_lesson_version(self):
        self.details.return_value = ''
        with self.assertRaises(RuntimeError):
            self.publish('old-writing-review')
        draft = next(item for item in self.progress.items.values() if item.get('entryType') == 'learningDraft')
        self.assertEqual(draft['postReviewVersion'], LAMBDA.POST_REVIEW_VERSION)
        draft['postReviewVersion'] = LAMBDA.POST_REVIEW_VERSION - 1
        self.details.return_value = quality.ContentCatalogTests.complete_explanation()
        post = self.publish('old-writing-review')['post']
        self.assertEqual(self.generate.call_count, 2)
        self.assertEqual(post['aiDetailedExplanationReviewVersion'], LAMBDA.EXPLANATION_REVIEW_VERSION)

    def test_readers_reuse_the_prepared_lesson_without_a_model_call(self):
        post = self.publish('prepared-for-readers')['post']
        self.details.reset_mock()
        with mock.patch.object(LAMBDA, 'call_bedrock_text') as model:
            first = LAMBDA.ensure_post_explanation(post['id'], post)
            second = LAMBDA.ensure_post_explanation(post['id'], post)
        self.assertEqual(first, (post['aiDetailedExplanation'], True, True))
        self.assertEqual(second, first)
        self.details.assert_not_called()
        model.assert_not_called()

    def test_pending_lesson_model_upgrade_reuses_source_but_not_old_model_cache(self):
        with mock.patch.object(self.posts, 'put_item', side_effect=RuntimeError('feed unavailable')):
            with self.assertRaises(RuntimeError):
                self.publish('upgrade-pending')
        with mock.patch.object(LAMBDA, 'DETAILS_MODEL_ID', 'test-upgraded-lesson-model'):
            post = self.publish('upgrade-pending')['post']
        self.assertEqual(self.generate.call_count, 1)
        self.assertEqual(self.details.call_count, 2)
        self.assertEqual(post['aiDetailedExplanationModelId'], 'test-upgraded-lesson-model')

    def test_outdated_current_report_draft_is_refreshed_before_publication(self):
        self.generate.return_value.update(editorialMode='current', sourceEvidence={
            'mode': 'current', 'sources': [{'publishedAt': 1}],
        })
        self.details.return_value = ''
        with self.assertRaises(RuntimeError):
            self.publish('stale-report')
        self.details.return_value = quality.ContentCatalogTests.complete_explanation()
        self.generate.return_value.update(editorialMode='concept', sourceEvidence={})
        self.publish('stale-report')
        self.assertEqual(self.generate.call_count, 2)

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
            GENERATE_POST("Artificial Intelligence", target["subTopic"], LAMBDA.resolve_content_angle("mechanism"), [], target)
        prompt = model.call_args.args[0]
        self.assertIn('"stage": "advanced"', prompt)
        self.assertIn(target["prerequisiteSubject"], prompt)
        self.assertIn("test assumptions and edge cases", prompt)
        with mock.patch.object(LAMBDA, "call_bedrock_text", side_effect=[quality.ContentCatalogTests.complete_explanation(), '{"accurate":true,"readerReady":true,"issues":[]}']) as details:
            GENERATE_DETAILS("LoRA adapters", "Source", "Artificial Intelligence", target["subTopic"], learning_target=target)
        self.assertIn('"stage": "advanced"', details.call_args_list[0].args[0])
        self.assertIn(target["nextLearningSubject"], details.call_args_list[0].args[0])

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
