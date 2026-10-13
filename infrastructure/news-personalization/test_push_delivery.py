import copy
import importlib.util
import io
import json
import sys
import types
import unittest
from pathlib import Path
from unittest.mock import Mock, patch


class Condition:
    def __init__(self, name): self.name = name
    def eq(self, value): return self
    def lte(self, value): return self
    def not_exists(self): return self
    def __and__(self, other): return self
    def __or__(self, other): return self


class ConditionalFailure(Exception): pass
table = Mock(name='fixture-table')
table.name = 'UnitTestNews'
table.meta.client.exceptions.ConditionalCheckFailedException = ConditionalFailure
sender, queue = Mock(), Mock()
modules = {'boto3': types.SimpleNamespace(client=lambda name, **kw: sender if name == 'lambda' else queue),
           'boto3.dynamodb.conditions': types.SimpleNamespace(Key=Condition, Attr=Condition),
           'botocore.config': types.SimpleNamespace(Config=lambda **kw: None),
           'lambda_function': types.SimpleNamespace(TABLE=table, with_worker_lease=lambda name, task: task())}
with patch.dict(sys.modules, modules):
    spec = importlib.util.spec_from_file_location('news_push_delivery_fixture', Path(__file__).with_name('push_delivery.py'))
    service = importlib.util.module_from_spec(spec); spec.loader.exec_module(service)


class PushDeliveryTests(unittest.TestCase):
    def setUp(self):
        table.reset_mock(); sender.reset_mock(); queue.reset_mock()
        self.now = 1791892800
        self.item = {'userId': 'fixture-user', 'entryId': 'alert#one', 'createdAt': self.now - 10,
                     'storyId': 'story', 'followRevision': 'rev', 'query': 'Climate research', 'body': 'New reporting', 'pushAttempts': 0}
        table.update_item.side_effect = None
        table.update_item.return_value = {'Attributes': self.item}
        self.preferences = {'enabled': True, 'news': True, 'smartDelivery': False}
        table.get_item.side_effect = lambda Key, **kw: {'Item': {'revision': 'rev'} if Key['entryId'].startswith('story#') else {'pushPreferences': self.preferences}}
        service.SENDER = 'fixture-sender'; service.FAILURES_QUEUE = 'fixture-queue'
        self.ack({'sent': 1, 'failed': 0, 'totalTokens': 1})

    def ack(self, counts):
        sender.invoke.return_value = {'Payload': io.BytesIO(json.dumps({'statusCode': 200, 'body': json.dumps(counts)}).encode())}

    def test_delivery_requires_provider_acknowledgement(self):
        self.assertEqual(service.deliver(self.item, self.now), 'sent')
        args = sender.invoke.call_args.kwargs
        self.assertEqual(args['InvocationType'], 'RequestResponse')
        payload = json.loads(args['Payload'])
        self.assertEqual(payload['data']['userId'], 'fixture-user')
        self.assertEqual(payload['data']['notificationId'], 'alert#one')

    def test_unfollowed_or_opened_updates_never_send(self):
        for mode in ['opened', 'unfollowed', 'expired']:
            with self.subTest(mode=mode):
                self.setUp()
                if mode == 'opened': self.item['readAt'] = self.now
                elif mode == 'expired': self.item['createdAt'] = self.now - 90000
                else: table.get_item.side_effect = lambda **kw: {'Item': {'revision': 'different'}}
                self.assertEqual(service.deliver(self.item, self.now), 'skipped'); sender.invoke.assert_not_called()

    def test_missing_or_disabled_consent_never_sends(self):
        for pref in [{}, {'enabled': False, 'news': True}, {'enabled': True, 'news': False}]:
            self.preferences = pref
            self.assertEqual(service.deliver(self.item, self.now), 'skipped')
        sender.invoke.assert_not_called()

    def test_partial_failure_retries_instead_of_claiming_delivery(self):
        self.ack({'sent': 1, 'failed': 1, 'totalTokens': 2})
        self.assertEqual(service.deliver(self.item, self.now), 'retry')
        self.assertEqual(table.update_item.call_args.kwargs['ExpressionAttributeValues'][':attempts'], 1)

    def test_receipts_acknowledge_previously_delivered_devices(self):
        self.ack({'sent': 0, 'deduplicated': 1, 'failed': 0, 'totalTokens': 1})
        self.assertEqual(service.deliver(self.item, self.now), 'sent')

    def test_unregistered_or_missing_devices_leave_the_durable_inbox(self):
        for body in [{'sent': 0, 'failed': 0, 'totalTokens': 0}, {'sent': 0, 'failed': 0, 'removed': 1, 'totalTokens': 1}]:
            self.ack(body); self.assertEqual(service.deliver(self.item, self.now), 'skipped')

    def test_terminal_failure_queues_only_record_keys(self):
        self.item['pushAttempts'] = 4; sender.invoke.side_effect = RuntimeError('fixture failure')
        try:
            self.assertEqual(service.deliver(self.item, self.now), 'failed')
            self.assertEqual(json.loads(queue.send_message.call_args.kwargs['MessageBody']), {'userId': 'fixture-user', 'entryId': 'alert#one'})
        finally: sender.invoke.side_effect = None

    def test_claimed_records_are_not_sent_twice(self):
        table.update_item.side_effect = ConditionalFailure()
        self.assertEqual(service.deliver(self.item, self.now), 'claimed'); sender.invoke.assert_not_called()

    def test_quiet_time_obeys_timezone_and_overnight_window(self):
        now = int(service.datetime(2026, 10, 13, 3, 0, tzinfo=service.ZoneInfo('UTC')).timestamp())
        preference = {'timezone': 'America/Toronto', 'quietHours': {'enabled': True, 'start': '22:00', 'end': '07:30'}}
        due = service.quiet_until(preference, now)
        local = service.datetime.fromtimestamp(due, service.ZoneInfo('America/Toronto'))
        self.assertEqual((local.hour, local.minute), (7, 30)); self.assertGreater(due, now)
        self.assertEqual(service.quiet_until({**preference, 'smartDelivery': False}, now), now)


if __name__ == '__main__': unittest.main()
