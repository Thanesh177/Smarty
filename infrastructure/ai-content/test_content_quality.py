import importlib.util
import os
import random
import sys
import types
import unittest
from unittest import mock
from pathlib import Path


HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
os.environ["AWS_EC2_METADATA_DISABLED"] = "true"


class _FakeAttr:
    def __init__(self, name):
        self.name = name

    def not_exists(self):
        return ("not_exists", self.name)

    def eq(self, value):
        return ("eq", self.name, value)


class _FakeTable:
    meta = types.SimpleNamespace(client=types.SimpleNamespace())


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
        sentence = (
            "This section names the important parts, follows the cause and effect, "
            "and explains why each change produces the next observable result. "
        )
        return "\n\n".join(
            f"{heading}\n\n{sentence * 6}"
            for heading in LAMBDA.EXPLANATION_SECTION_HEADINGS
        ).strip()

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

    def test_detailed_explanation_requires_the_complete_learning_structure(self):
        generated = self.complete_explanation()
        captured = {}

        def fake_bedrock(prompt, **_kwargs):
            captured["prompt"] = prompt
            return generated

        with mock.patch.object(LAMBDA, "call_bedrock_text", fake_bedrock):
            result = LAMBDA.generate_detailed_explanation(
                "How a KV cache reuses earlier tokens",
                "A decoder stores attention keys and values for previous tokens.",
                "Artificial Intelligence",
                "KV cache during autoregressive decoding",
            )

        self.assertTrue(LAMBDA.is_complete_detailed_explanation(result))
        self.assertIn("Use the exact 9 section headings", captured["prompt"])
        self.assertIn("What to learn next", result)
        self.assertIn("Limits and edge cases", result)

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
