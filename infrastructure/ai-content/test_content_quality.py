import importlib.util
import os
import random
import sys
import types
import unittest
from pathlib import Path


HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
os.environ["AWS_EC2_METADATA_DISABLED"] = "true"


class _FakeAttr:
    def __init__(self, name):
        self.name = name

    def not_exists(self):
        return ("not_exists", self.name)


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


if __name__ == "__main__":
    unittest.main()
