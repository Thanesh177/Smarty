import importlib.util
import json
import os
import random
import sys
import types
import unittest
from unittest import mock
from pathlib import Path


HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(HERE.parent / "shared"))
os.environ["AWS_EC2_METADATA_DISABLED"] = "true"


class _Predicate:
    def __init__(self, check): self.check = check
    def __or__(self, other): return _Predicate(lambda item: self.check(item) or other.check(item))
    def __and__(self, other): return _Predicate(lambda item: self.check(item) and other.check(item))


class _FakeAttr:
    def __init__(self, name):
        self.name = name

    def not_exists(self):
        return _Predicate(lambda item: self.name not in item)

    def exists(self):
        return _Predicate(lambda item: self.name in item)

    def eq(self, value):
        return _Predicate(lambda item: item.get(self.name) == value)

    def lte(self, value):
        return _Predicate(lambda item: item.get(self.name, float('inf')) <= value)

    def __or__(self, other):
        return self


class _FakeTable:
    meta = types.SimpleNamespace(client=types.SimpleNamespace())

    def put_item(self, **kwargs): return {}


class _FakeDynamoResource:
    def Table(self, _name):
        return _FakeTable()


def _load_lambda_module():
    boto3 = types.ModuleType("boto3")
    boto3.resource = lambda *_args, **_kwargs: _FakeDynamoResource()
    boto3.client = lambda *_args, **_kwargs: types.SimpleNamespace()

    boto3_dynamodb = types.ModuleType("boto3.dynamodb")
    boto3_conditions = types.ModuleType("boto3.dynamodb.conditions")
    boto3_conditions.Attr = _FakeAttr

    botocore = types.ModuleType("botocore")
    botocore_config = types.ModuleType("botocore.config")
    botocore_config.Config = lambda **kwargs: kwargs
    botocore_exceptions = types.ModuleType("botocore.exceptions")
    botocore_exceptions.ClientError = type("ClientError", (Exception,), {})
    botocore_exceptions.BotoCoreError = type("BotoCoreError", (Exception,), {})

    modules = {
        "boto3": boto3,
        "boto3.dynamodb": boto3_dynamodb,
        "boto3.dynamodb.conditions": boto3_conditions,
        "botocore": botocore,
        "botocore.config": botocore_config,
        "botocore.exceptions": botocore_exceptions,
    }
    previous = {name: sys.modules.get(name) for name in modules}
    sys.modules.update(modules)
    try:
        spec = importlib.util.spec_from_file_location(
            "smarty_ai_content_lambda",
            HERE / "lambda_function.py",
        )
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        return module
    finally:
        for name, old_module in previous.items():
            if old_module is None:
                sys.modules.pop(name, None)
            else:
                sys.modules[name] = old_module


LAMBDA = _load_lambda_module()


class ContentCatalogTests(unittest.TestCase):
    def test_image_queries_normalize_keyword_arrays_without_python_punctuation(self):
        self.assertEqual(LAMBDA.normalize_image_search_query(["deep sea", "lanternfish", 2]), "deep sea lanternfish")
        self.assertEqual(LAMBDA.normalize_image_search_query({"query": "fish"}), "")

    def test_release_probe_is_bounded_and_does_not_publish(self):
        with (mock.patch.object(LAMBDA, "call_bedrock_text", return_value="READY") as invoke,
              mock.patch.object(LAMBDA, "create_post") as publish):
            result = LAMBDA.lambda_handler({"source": "smarty.ai.release-check"}, None)
        self.assertEqual(result['statusCode'], 200)
        self.assertEqual(invoke.call_args.kwargs['max_tokens'], 32)
        publish.assert_not_called()

    def test_api_events_cannot_enter_release_probe(self):
        with (mock.patch.object(LAMBDA, "call_bedrock_text") as invoke,
              mock.patch.object(LAMBDA, "handle_details", return_value={'statusCode': 404})):
            result = LAMBDA.lambda_handler({'source': 'smarty.ai.release-check', 'httpMethod': 'POST', 'path': '/posts/details'}, None)
        self.assertEqual(result['statusCode'], 404)
        invoke.assert_not_called()

    def test_scheduled_retries_share_an_id_but_each_daily_slot_is_distinct(self):
        event = {"source": "smarty.learning.schedule", "scheduledTime": "2026-09-19T02:30:00Z"}
        first = LAMBDA.scheduled_post_id(event)
        self.assertEqual(first, LAMBDA.scheduled_post_id(dict(event, attempt=2)))
        self.assertEqual(first, LAMBDA.scheduled_post_id(dict(event, scheduledTime="2026-09-19T08:00:00+05:30")))
        self.assertNotEqual(first, LAMBDA.scheduled_post_id(dict(event, scheduledTime="2026-09-19T08:30:00Z")))
        self.assertIsNone(LAMBDA.scheduled_post_id({}))

    def test_published_scheduled_post_is_reused_without_generating_again(self):
        saved = {"id": "scheduled-test", "title": "A saved lesson"}
        with (mock.patch.object(LAMBDA, "table") as table,
              mock.patch.object(LAMBDA, "generate_specific_post") as generate):
            table.get_item.return_value = {"Item": saved}
            result = LAMBDA.create_post(publication_id="scheduled-test")
        self.assertEqual(result["statusCode"], 200)
        generate.assert_not_called()

    def test_scheduled_failure_raises_so_lambda_can_retry(self):
        event = {"source": "smarty.learning.schedule", "scheduledTime": "2026-09-19T02:30:00Z"}
        with mock.patch.object(LAMBDA, "create_post", side_effect=RuntimeError("Try again")):
            with self.assertRaisesRegex(RuntimeError, "Try again"):
                LAMBDA.lambda_handler(event, None)

    @staticmethod
    def complete_explanation():
        from explanation_fixture import LESSON
        return LESSON

    def test_catalog_is_broad_and_every_target_is_narrow(self):
        self.assertGreaterEqual(len(LAMBDA.TOPIC_SUBTOPICS), 80)
        self.assertGreaterEqual(
            sum(len(values) for values in LAMBDA.TOPIC_SUBTOPICS.values()),
            400,
        )
        for topic, subtopics in LAMBDA.TOPIC_SUBTOPICS.items():
            self.assertGreaterEqual(len(subtopics), 5, topic)
            for subtopic in subtopics:
                self.assertNotEqual(topic.lower(), subtopic.lower())
                self.assertFalse(LAMBDA.is_generic_text(subtopic), subtopic)
                self.assertGreaterEqual(len(LAMBDA.normalize_tokens(subtopic)), 3)

    def test_every_topic_belongs_to_exactly_one_domain(self):
        domain_topics = [
            topic
            for topics in LAMBDA.TOPIC_DOMAINS.values()
            for topic in topics
        ]
        self.assertEqual(len(domain_topics), len(set(domain_topics)))
        self.assertEqual(set(domain_topics), set(LAMBDA.BASE_TOPICS))

    def test_new_subjects_have_specific_paths_without_resetting_existing_paths(self):
        for topic in ('Cosmology', 'Zoology', 'Botany', 'Marine Biology', 'Scientific Method',
                      'Scientific Discoveries', 'Scientific Mysteries', 'Education', 'Literature'):
            path = LAMBDA.topic_learning_path(topic)
            self.assertEqual(path[0]['level'], 'foundation')
            self.assertEqual(path[-1]['level'], 'advanced')
            self.assertGreaterEqual(len(path), 7)
            self.assertEqual(len({step['subTopic'] for step in path}), len(path))
        self.assertEqual(LAMBDA.CURRICULUM_VERSION, 1, 'Existing authored paths have not been reordered')
        self.assertEqual(LAMBDA.POST_MODEL_ID, 'us.anthropic.claude-sonnet-4-6')
        self.assertEqual(LAMBDA.DETAILS_MODEL_ID, 'us.anthropic.claude-sonnet-4-6')
        self.assertEqual(LAMBDA.ANSWER_MODEL_ID, 'us.amazon.nova-2-lite-v1:0')

    def test_persistent_rotation_covers_catalog_before_repeating(self):
        random.seed(19)
        state = {}
        selected = []

        for _ in LAMBDA.BASE_TOPICS:
            topic, state = LAMBDA.advance_content_rotation_state(state)
            selected.append(topic)

        self.assertEqual(len(selected), len(set(selected)))
        self.assertEqual(set(selected), set(LAMBDA.BASE_TOPICS))
        first_domains = {
            LAMBDA.TOPIC_TO_DOMAIN[topic]
            for topic in selected[:len(LAMBDA.TOPIC_DOMAINS)]
        }
        self.assertEqual(first_domains, set(LAMBDA.TOPIC_DOMAINS))

        next_topic, next_state = LAMBDA.advance_content_rotation_state(state)
        self.assertIn(next_topic, LAMBDA.BASE_TOPICS)
        self.assertEqual(next_state["cycle"], 2)
        self.assertEqual(next_state["usedTopics"], [next_topic])

    def test_selection_avoids_recent_subtopic(self):
        recent = [
            {
                "topic": "Artificial Intelligence",
                "subTopic": LAMBDA.TOPIC_SUBTOPICS["Artificial Intelligence"][0],
                "contentFingerprint": LAMBDA.content_fingerprint(
                    "Artificial Intelligence",
                    LAMBDA.TOPIC_SUBTOPICS["Artificial Intelligence"][0],
                ),
            }
        ]
        random.seed(7)
        topic, subtopic = LAMBDA.choose_generation_target(recent)
        self.assertIn(topic, LAMBDA.TOPIC_SUBTOPICS)
        self.assertIn(subtopic, LAMBDA.TOPIC_SUBTOPICS[topic])
        self.assertNotEqual(
            LAMBDA.content_fingerprint(topic, subtopic),
            recent[0]["contentFingerprint"],
        )
        self.assertNotEqual(topic, "Artificial Intelligence")

    def test_quality_gate_accepts_specific_copy(self):
        filler = (
            "The cache stores keys and values from each earlier attention step, "
            "then the decoder reuses those tensors when it predicts the next token. "
            "Each layer reads the preserved state, adds one new entry, and passes a "
            "smaller amount of work forward. This avoids recomputing the entire prompt "
            "while keeping the same causal attention result. The memory footprint grows "
            "with sequence length, so serving systems must balance speed, batch size, "
            "precision, and available accelerator memory during every request."
        )
        post = {
            "title": "How KV Cache Reuses Earlier Tokens During Decoding",
            "body": f"{filler}\n\n{filler}",
        }
        valid, reason = LAMBDA.validate_generated_post(
            post,
            "Artificial Intelligence",
            "how a KV cache avoids recomputing earlier tokens",
            [],
        )
        self.assertTrue(valid, reason)

    def test_regular_posts_are_written_for_non_specialists_without_an_extra_model_pass(self):
        paragraph = (
            "A model keeps earlier attention keys and values in a cache. "
            "This is stored information about earlier tokens it can use again. Each new token adds "
            "one entry rather than rebuilding earlier entries. A token is one "
            "piece of text the model handles. Reusing these entries reduces "
            "repeated work, but keeping them takes memory as the text grows."
        )
        draft = {"title": "How a KV Cache Saves Earlier Work",
                 "mechanismParagraph": paragraph, "exampleParagraph": paragraph,
                 "image_search_query": "computer model memory", "sourceIds": []}
        with (mock.patch.object(LAMBDA, "load_editorial_evidence", return_value={"mode": "concept", "sources": []}),
              mock.patch.object(LAMBDA, "call_bedrock_text", return_value=json.dumps(draft)) as model,
              mock.patch.object(LAMBDA, "review_concept_text", return_value=True)):
            result = LAMBDA.generate_specific_post("Artificial Intelligence", "how a KV cache avoids recomputing earlier tokens", LAMBDA.resolve_content_angle("mechanism"), [])
        self.assertIsNotNone(result)
        self.assertEqual(model.call_count, 1)
        prompt = model.call_args.args[0]
        guide = model.call_args.kwargs["system_prompt"]
        self.assertEqual(guide, LAMBDA.POST_WRITING_GUIDE)
        for instruction in ("no specialist background", "define each immediately", "Expand an acronym", "less accurate", "hypothetical"):
            self.assertIn(instruction, guide)
        self.assertIn("80 to 120 words", prompt)
        self.assertIn("varied length", prompt)
        self.assertNotIn("4 to 6 short sentences", prompt)
        self.assertNotIn("8 to 18 words", guide)
        self.assertEqual(model.call_args.kwargs["max_tokens"], 850)
        self.assertIn("sourceIds", prompt)
        for instruction in ("complete mini-lesson", "not a shortened summary",
                            "Retain the complete causal chain", "Earn curiosity",
                            "vary sentence length", "current post must still stand on its own"):
            self.assertIn(instruction, guide)

    def test_richer_posts_keep_room_for_detail_without_changing_the_two_paragraph_contract(self):
        paragraph = "cache earlier tokens " * 40
        valid, reason = LAMBDA.validate_generated_post(
            {"title": "How a KV Cache Reuses Earlier Tokens", "body": f"{paragraph.strip()}\n\n{paragraph.strip()}"},
            "Artificial Intelligence", "how a KV cache avoids recomputing earlier tokens", [],
        )
        self.assertTrue(valid, reason)

    def test_quality_gate_rejects_generic_title(self):
        paragraph = " ".join(["specific"] * 80)
        valid, reason = LAMBDA.validate_generated_post(
            {
                "title": "An Overview of Artificial Intelligence",
                "body": f"{paragraph}\n\n{paragraph}",
            },
            "Artificial Intelligence",
            "how a KV cache avoids recomputing earlier tokens",
            [],
        )
        self.assertFalse(valid)
        self.assertEqual(reason, "title was generic")

    def test_simple_titles_cannot_promise_unlimited_or_guaranteed_results(self):
        paragraph = " ".join(["specific"] * 80)
        for title in ("How a Model Learns Once and Answers Forever", "How Model Training Gives Guaranteed Results"):
            valid, reason = LAMBDA.validate_generated_post(
                {"title": title, "body": f"{paragraph}\n\n{paragraph}"},
                "Artificial Intelligence", "why training changes model weights", [],
            )
            self.assertFalse(valid)
            self.assertEqual(reason, "title promised an unsupported absolute")

    def test_detailed_explanation_requires_the_complete_learning_structure(self):
        generated = self.complete_explanation()
        captured = {}

        def fake_bedrock(prompt, **kwargs):
            if kwargs.get("max_tokens") == 450:
                return '{"accurate":true,"issues":[]}'
            captured["prompt"] = prompt
            captured["options"] = kwargs
            return generated

        with mock.patch.object(LAMBDA, "call_bedrock_text", fake_bedrock):
            result = LAMBDA.generate_detailed_explanation(
                "How a KV cache reuses earlier tokens",
                "A decoder stores attention keys and values for previous tokens.",
                "Artificial Intelligence",
                "KV cache during autoregressive decoding",
            )

        self.assertTrue(LAMBDA.is_complete_detailed_explanation(result))
        self.assertIn("3 to 5 chapters", captured["prompt"])
        self.assertIn("unheaded prose", captured["prompt"])
        self.assertIn("Carry one concrete example", captured["prompt"])
        self.assertIn("explicit conceptual bridge", captured["prompt"])
        self.assertIn("## Following one token through the cache", result)
        self.assertNotIn("Why it matters", result)
        self.assertIn("change ONE input", captured["prompt"])
        self.assertIn("untrusted source material", captured["prompt"])
        self.assertIn("hypothetical", captured["prompt"])
        self.assertTrue(captured["options"]["require_complete"])
        self.assertEqual(captured["options"]["max_tokens"], 2800)
        self.assertIn('EXACTLY FOUR chapters', captured['options']['system_prompt'])
        self.assertIn('NOT an authoritative reference', captured['options']['system_prompt'])

    def test_missing_or_empty_sections_are_not_saved_as_complete_guides(self):
        complete = self.complete_explanation()
        self.assertFalse(LAMBDA.is_complete_detailed_explanation(complete.replace("Following one token through the cache", "Why it matters")))
        self.assertFalse(LAMBDA.is_complete_detailed_explanation(complete.replace("Following one token through the cache", "Why it matters:")))
        self.assertFalse(LAMBDA.is_complete_detailed_explanation(complete.split("## From saved keys")[0] + "## From saved keys to the next prediction\n"))
        self.assertFalse(LAMBDA.is_complete_detailed_explanation(complete[complete.index("##"):]))
        self.assertFalse(LAMBDA.is_complete_detailed_explanation(complete.replace("The memory bill behind a faster answer", "Following one token through the cache")))

    def test_only_completed_model_output_can_be_saved_as_a_lesson(self):
        result = {"output": {"message": {"content": [{"text": self.complete_explanation()}]}}, "stopReason": "max_tokens"}
        with mock.patch.object(LAMBDA.bedrock, "converse", return_value=result, create=True):
            self.assertEqual(LAMBDA.call_bedrock_text("Teach", require_complete=True), "")
            result["stopReason"] = "end_turn"
            self.assertTrue(LAMBDA.is_complete_detailed_explanation(LAMBDA.call_bedrock_text("Teach", require_complete=True)))

    def test_teacher_instructions_are_sent_in_the_system_role(self):
        result = {"output": {"message": {"content": [{"text": "An answer."}]}}, "stopReason": "end_turn"}
        with mock.patch.object(LAMBDA.bedrock, 'converse', return_value=result, create=True) as converse:
            LAMBDA.call_bedrock_text('Source data', system_prompt='Correct false premises.')
            self.assertEqual(converse.call_args.kwargs['system'], [{'text': 'Correct false premises.'}])
            self.assertEqual(converse.call_args.kwargs['messages'][0]['content'][0]['text'], 'Source data')
            LAMBDA.call_bedrock_text('Ordinary answer')
            self.assertNotIn('system', converse.call_args.kwargs)

    def test_rejected_lesson_does_not_get_saved_as_an_outline(self):
        with mock.patch.object(LAMBDA, "call_bedrock_text", return_value="## A short outline\nOne sentence."):
            self.assertEqual(LAMBDA.generate_detailed_explanation("A mechanism", "Source"), "")

    def test_old_version_cache_is_not_reused(self):
        self.assertEqual(LAMBDA.EXPLANATION_SCHEMA_VERSION, 7)
        self.assertTrue(LAMBDA.explanation_cache_id("post-1", "hash").startswith("post#v7#"))

    def test_saved_explanation_is_reused_without_a_second_model_call(self):
        class MemoryTable:
            def __init__(self, key_name):
                self.key_name = key_name
                self.items = {}

            def get_item(self, Key, **_kwargs):
                return {"Item": self.items.get(Key[self.key_name])}

            def put_item(self, Item, **_kwargs):
                self.items[Item[self.key_name]] = dict(Item)
                return {}

            def update_item(self, **_kwargs):
                return {}

        post = {
            "id": "post-1",
            "title": "How a KV cache reuses earlier tokens",
            "body": "A decoder stores attention keys and values for earlier tokens.",
            "topic": "Artificial Intelligence",
            "subTopic": "KV cache during autoregressive decoding",
        }
        explanation = self.complete_explanation()
        explanation_table = MemoryTable("explanationId")
        post_table = MemoryTable("id")

        with (
            mock.patch.object(LAMBDA, "explanations_table", explanation_table),
            mock.patch.object(LAMBDA, "table", post_table),
            mock.patch.object(
                LAMBDA,
                "generate_detailed_explanation",
                return_value=explanation,
            ) as generate,
        ):
            first = LAMBDA.ensure_post_explanation("post-1", post)
            second = LAMBDA.ensure_post_explanation("post-1", post)

        self.assertEqual(first, (explanation, False, True))
        self.assertEqual(second, (explanation, True, True))
        self.assertEqual(generate.call_count, 1)


if __name__ == "__main__":
    unittest.main()
