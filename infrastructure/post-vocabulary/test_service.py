"""Offline fixtures only: no AWS credentials, network, model calls or writes."""
import copy
import importlib.util
import json
import sys
import types
import unittest
from contextlib import ExitStack
from pathlib import Path
from unittest import mock

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / "ai-content"))
from post_glossary import make_glossary, source_hash


class ConditionalFailure(Exception):
    pass


class Predicate:
    def __init__(self, check): self.check = check
    def __and__(self, other): return Predicate(lambda row: self.check(row) and other.check(row))


class Attr:
    def __init__(self, name): self.name = name
    def exists(self): return Predicate(lambda row: self.name in row)
    def not_exists(self): return Predicate(lambda row: self.name not in row)
    def eq(self, value): return Predicate(lambda row: row.get(self.name) == value)


class Table:
    def __init__(self, key):
        self.key, self.items, self.reads, self.writes = key, {}, [], []
        self.meta = types.SimpleNamespace(client=types.SimpleNamespace(exceptions=types.SimpleNamespace(ConditionalCheckFailedException=ConditionalFailure)))

    def get_item(self, Key, **kwargs):
        self.reads.append({"Key": Key, **kwargs})
        value = self.items.get(Key[self.key])
        return {"Item": copy.deepcopy(value)} if value else {}

    def put_item(self, Item, ConditionExpression=None, **kwargs):
        old = self.items.get(Item[self.key], {})
        if ConditionExpression and not ConditionExpression.check(old): raise ConditionalFailure()
        self.items[Item[self.key]] = copy.deepcopy(Item)
        self.writes.append(copy.deepcopy(Item))

    def update_item(self, Key, ConditionExpression, ExpressionAttributeValues, **kwargs):
        item = self.items.get(Key[self.key], {})
        if not ConditionExpression.check(item): raise ConditionalFailure()
        item["postGlossary"] = copy.deepcopy(ExpressionAttributeValues[":glossary"])
        self.writes.append(copy.deepcopy(item))


def load_modules():
    sdk = types.SimpleNamespace(resource=lambda *args, **kwargs: types.SimpleNamespace(Table=lambda name: Table("id")), client=lambda *args, **kwargs: mock.Mock())
    modules = {"boto3": sdk, "boto3.dynamodb": types.ModuleType("boto3.dynamodb"),
               "boto3.dynamodb.conditions": types.SimpleNamespace(Attr=Attr),
               "botocore": types.ModuleType("botocore"), "botocore.config": types.SimpleNamespace(Config=lambda **kwargs: kwargs)}
    loaded = {}
    with mock.patch.dict(sys.modules, modules):
        for name in ("common", "api", "worker"):
            spec = importlib.util.spec_from_file_location("vocabulary_" + name, HERE / (name + ".py"))
            module = importlib.util.module_from_spec(spec)
            with mock.patch.dict(sys.modules, {"common": loaded.get("common")} if "common" in loaded else {}):
                spec.loader.exec_module(module)
            loaded[name] = module
    return loaded["common"], loaded["api"], loaded["worker"]


COMMON, API, WORKER = load_modules()
POST = {"id": "post-one", "title": "A leaf at work", "body": "Photosynthesis begins when chlorophyll absorbs light.", "userId": "alice", "authorId": "alice", "visibility": "public"}
TERMS = [{"term": "chlorophyll", "meaning": "The green substance in a leaf that absorbs light used to make sugars."}]


def model_result(terms=TERMS, stop="end_turn"):
    return {"stopReason": stop, "output": {"message": {"content": [{"text": json.dumps({"terms": terms})}]}}}


class ServiceTests(unittest.TestCase):
    def setUp(self):
        self.stack = ExitStack()
        self.addCleanup(self.stack.close)
        self.posts, self.state = Table("id"), Table("explanationId")
        self.posts.put_item(Item=POST)
        self.posts.writes.clear()
        self.queue, self.model = mock.Mock(), mock.Mock()
        self.model.converse.return_value = model_result()
        self.clock = 10000
        for module, key, value in [(COMMON, "POSTS", self.posts), (COMMON, "STATE", self.state),
                                   (API, "SQS", self.queue), (API, "QUEUE_URL", "https://queue.example/work.fifo"),
                                   (WORKER, "MODEL", self.model), (WORKER, "QUEUE_ARN", "arn:aws:sqs:us-east-1:123456789012:work.fifo")]:
            self.stack.enter_context(mock.patch.object(module, key, value))
        self.stack.enter_context(mock.patch.object(COMMON, "now", side_effect=lambda: self.clock))

    def event(self, method="POST", user="alice", post_id="post-one", body=None):
        return {"requestContext": {"http": {"method": method}, "authorizer": {"jwt": {"claims": {"sub": user}}}},
                "body": json.dumps({"postId": post_id} if body is None else body), "queryStringParameters": {"postId": post_id}}

    def call(self, **kwargs):
        result = API.lambda_handler(self.event(**kwargs), None)
        return result["statusCode"], json.loads(result["body"])

    def record(self, body=None, message_id="message-one"):
        if body is None:
            body = self.queue.send_message.call_args.kwargs["MessageBody"]
        return {"messageId": message_id, "eventSource": "aws:sqs", "eventSourceARN": WORKER.QUEUE_ARN, "body": body}

    def work(self, records=None):
        return WORKER.lambda_handler({"Records": records or [self.record()]}, None)

    def job(self):
        return self.state.items[COMMON.key_for("post-one", source_hash(POST))]

    def test_enqueue_is_durable_fast_and_uses_only_saved_source_identity(self):
        status, result = self.call(body={"postId": "post-one", "authorId": "mallory", "sourceHash": "bad", "terms": TERMS})
        self.assertEqual(status, 202)
        self.assertEqual(result["status"], "queued")
        message = self.queue.send_message.call_args.kwargs
        self.assertEqual(json.loads(message["MessageBody"]), {"postId": "post-one", "sourceHash": source_hash(POST), "authorId": "alice"})
        self.assertEqual(message["MessageGroupId"], COMMON.digest("post-one"))
        self.assertEqual(len(message["MessageDeduplicationId"]), 64)
        self.assertEqual(self.job()["status"], "queued")
        self.model.converse.assert_not_called()
        self.assertFalse(self.posts.writes)
        self.assertTrue(all(read["ConsistentRead"] for read in self.posts.reads + self.state.reads))
        self.assertNotIn(POST["body"], json.dumps(self.state.items))
        self.assertNotIn("alice", json.dumps(self.state.items))

    def test_completed_worker_saves_meanings_and_status_reads_do_no_work(self):
        self.call()
        self.assertEqual(self.work(), {"batchItemFailures": []})
        saved = self.posts.items["post-one"]
        self.assertEqual(saved["postGlossary"], make_glossary(POST, TERMS))
        self.assertEqual({key: value for key, value in saved.items() if key != "postGlossary"}, POST)
        before = len(self.state.writes)
        for method in ("GET", "POST", "GET"):
            status, value = self.call(method=method)
            self.assertEqual(status, 200)
            self.assertEqual(value["status"], "ready")
            self.assertEqual(value["postGlossary"]["terms"], TERMS)
        self.assertEqual(len(self.state.writes), before)
        self.queue.send_message.assert_called_once()
        self.model.converse.assert_called_once()
        self.assertEqual(self.model.converse.call_args.kwargs["inferenceConfig"]["maxTokens"], 2800)
        self.assertEqual(self.model.converse.call_args.kwargs["modelId"], "us.anthropic.claude-sonnet-4-6")

    def test_pending_and_missing_status_never_enqueue_or_generate(self):
        self.assertEqual(self.call(method="GET"), (200, {"status": "unavailable", "postId": "post-one"}))
        self.call()
        writes = len(self.state.writes)
        self.assertEqual(self.call(method="GET")[1]["status"], "preparing")
        self.assertEqual(len(self.state.writes), writes)
        self.call()
        self.queue.send_message.assert_called_once()
        self.model.converse.assert_not_called()

    def test_authentication_and_conflicting_or_wrong_ownership_fail_closed(self):
        self.assertEqual(self.call(user="")[0], 401)
        self.assertEqual(self.call(user="bob", body={"postId": "post-one", "userId": "alice"})[0], 403)
        self.posts.items["post-one"]["creatorId"] = "bob"
        self.assertEqual(self.call()[0], 403)
        self.assertEqual(self.call(user="bob")[0], 403)
        self.queue.send_message.assert_not_called()
        self.model.converse.assert_not_called()

    def test_deleted_hidden_and_generated_posts_cannot_be_enqueued(self):
        for change in ({"deleted": True}, {"isDeleted": True}, {"moderationStatus": "pending"},
                       {"moderationStatus": "pending_review"}, {"moderationStatus": "removed"},
                       {"moderationStatus": "rejected"}, {"moderationStatus": "hidden"}, {"visibility": "moderation_removed"}):
            self.posts.items["post-one"] = {**POST, **change}
            self.assertEqual(self.call()[0], 404, change)
        self.posts.items["post-one"] = {**POST, "isAutoGenerated": True}
        self.assertEqual(self.call()[0], 403)
        self.queue.send_message.assert_not_called()

    def test_invalid_requests_and_sources_are_bounded(self):
        for body in ([], {}, {"postId": {}}, {"postId": " "}, {"postId": "x" * 201}):
            self.assertEqual(self.call(body=body)[0], 400)
        self.assertEqual(self.call(method="PUT")[0], 405)
        event = self.event(); event["body"] = "{"; self.assertEqual(API.lambda_handler(event, None)["statusCode"], 400)
        self.posts.items["post-one"]["body"] = "x" * 12001
        self.assertEqual(self.call()[0], 400)
        self.posts.items["post-one"]["body"] = {"not": "text"}
        self.assertEqual(self.call()[0], 400)
        self.queue.send_message.assert_not_called()

    def test_rate_limit_counts_new_enqueues_not_reads_or_deduplicated_retries(self):
        for number in range(11):
            post_id = "post-" + str(number)
            self.posts.put_item(Item={**POST, "id": post_id})
            self.assertEqual(self.call(post_id=post_id)[0], 202 if number < 10 else 429)
        self.assertEqual(self.queue.send_message.call_count, 10)
        for _ in range(5):
            self.assertEqual(self.call(post_id="post-0")[0], 202)
            self.call(method="GET", post_id="post-0")
        self.assertEqual(self.queue.send_message.call_count, 10)
        self.clock += 3600
        self.assertEqual(self.call(post_id="post-10")[0], 202)

    def test_queue_failure_never_claims_durable_acceptance_and_next_post_can_retry(self):
        self.queue.send_message.side_effect = RuntimeError("fixture transport error")
        self.assertEqual(self.call()[0], 503)
        self.assertEqual(self.job()["status"], "enqueue_failed")
        self.assertEqual(self.call(method="GET")[1]["status"], "unavailable")
        self.queue.send_message.side_effect = None
        self.assertEqual(self.call()[0], 202)
        self.assertEqual(self.queue.send_message.call_args_list[0].kwargs["MessageDeduplicationId"], self.queue.send_message.call_args_list[1].kwargs["MessageDeduplicationId"])

    def test_crashed_producer_cannot_claim_durable_acceptance_before_send(self):
        fingerprint = source_hash(POST)
        COMMON.replace_job(None, {"status": "enqueuing", "sourceHash": fingerprint,
                                 "actorHash": COMMON.digest("alice"), "attempts": 0,
                                 "leaseUntil": self.clock + 45}, COMMON.key_for("post-one", fingerprint))
        self.assertEqual(self.call()[0], 503)
        self.queue.send_message.assert_not_called()
        self.clock += 46
        self.assertEqual(self.call()[0], 202)
        self.queue.send_message.assert_called_once()

    def test_busy_enqueue_is_retryable_not_an_unproven_success(self):
        with mock.patch.object(COMMON, "replace_job", side_effect=COMMON.Busy()):
            self.assertEqual(self.call()[0], 503)
        self.queue.send_message.assert_not_called()

    def test_empty_meanings_are_reused_but_invalid_nonempty_model_output_is_not(self):
        self.call()
        self.model.converse.return_value = model_result([])
        self.assertFalse(self.work()["batchItemFailures"])
        self.assertEqual(self.call()[1]["postGlossary"]["terms"], [])
        self.model.converse.assert_called_once()

    def test_model_failures_are_limited_to_three_calls_then_wait_for_dlq_without_more_ai(self):
        self.call()
        self.model.converse.return_value = model_result([{"term": "nonexistent", "meaning": TERMS[0]["meaning"]}])
        for _ in range(5):
            self.assertEqual(self.work()["batchItemFailures"], [{"itemIdentifier": "message-one"}])
        self.assertEqual(self.model.converse.call_count, 3)
        self.assertEqual(self.job()["attempts"], 3)
        self.assertEqual(self.job()["status"], "unavailable")
        self.assertEqual(self.call(method="GET")[1]["status"], "unavailable")
        self.assertEqual(self.call()[1]["status"], "unavailable")
        self.assertNotIn("postGlossary", self.posts.items["post-one"])

    def test_malformed_or_truncated_model_results_cannot_be_persisted(self):
        self.call()
        for result in (model_result(stop="max_tokens"), {"stopReason": "end_turn", "output": {"message": {"content": [{"text": "not JSON"}]}}}, model_result(None)):
            self.model.converse.return_value = result
            self.assertTrue(self.work()["batchItemFailures"])
            self.assertNotIn("postGlossary", self.posts.items["post-one"])

    def test_duplicate_delivery_and_active_worker_lease_do_not_duplicate_model_calls(self):
        self.call()
        job = self.job()
        COMMON.replace_job(job, {"status": "processing", "attempts": 1, "leaseUntil": self.clock + 150})
        self.assertTrue(self.work()["batchItemFailures"])
        self.model.converse.assert_not_called()
        self.clock += 151
        self.assertFalse(self.work()["batchItemFailures"])
        self.assertFalse(self.work()["batchItemFailures"])
        self.assertEqual(self.model.converse.call_count, 1)
        self.assertEqual(self.job()["attempts"], 2)

    def test_source_owner_or_moderation_change_before_work_stops_without_generation(self):
        self.call()
        for change in ({"body": "Edited text"}, {"userId": "bob"}, {"moderationStatus": "hidden"}, {"deleted": True}):
            self.posts.items["post-one"] = {**POST, **change}
            self.assertFalse(self.work()["batchItemFailures"])
        self.model.converse.assert_not_called()

    def test_conditional_write_cannot_undo_an_edit_deletion_or_moderation_change(self):
        self.call()
        def change_source(**kwargs):
            self.posts.items["post-one"]["moderationStatus"] = "removed"
            return model_result()
        self.model.converse.side_effect = change_source
        self.assertFalse(self.work()["batchItemFailures"])
        self.assertNotIn("postGlossary", self.posts.items["post-one"])
        self.assertEqual(self.job()["status"], "unavailable")

    def test_worker_can_win_race_before_producer_marks_queue_without_losing_ready_state(self):
        def consume(**kwargs):
            WORKER.lambda_handler({"Records": [self.record(kwargs["MessageBody"])]}, None)
            return {"MessageId": "one"}
        self.queue.send_message.side_effect = consume
        self.assertEqual(self.call()[0], 202)
        self.assertEqual(self.job()["status"], "ready")
        self.assertEqual(self.call(method="GET")[1]["status"], "ready")

    def test_untrusted_queue_sources_or_identity_cannot_generate(self):
        self.call()
        record = self.record(); record["eventSourceARN"] = "another-queue"
        self.assertTrue(self.work([record])["batchItemFailures"])
        record = self.record(); message = json.loads(record["body"]); message["authorId"] = "bob"; record["body"] = json.dumps(message)
        self.assertTrue(self.work([record])["batchItemFailures"])
        self.model.converse.assert_not_called()

    def test_fifo_partial_failure_returns_unprocessed_records(self):
        self.call()
        self.model.converse.side_effect = RuntimeError("fixture provider failure")
        result = self.work([self.record(message_id="first"), self.record(message_id="second")])
        self.assertEqual(result["batchItemFailures"], [{"itemIdentifier": "first"}, {"itemIdentifier": "second"}])
        self.model.converse.assert_called_once()

    def test_insufficient_worker_time_does_not_spend_an_attempt(self):
        self.call()
        context = types.SimpleNamespace(get_remaining_time_in_millis=lambda: 10000)
        self.assertTrue(WORKER.lambda_handler({"Records": [self.record()]}, context)["batchItemFailures"])
        self.assertEqual(self.job()["attempts"], 0)
        self.model.converse.assert_not_called()


if __name__ == "__main__":
    unittest.main()
