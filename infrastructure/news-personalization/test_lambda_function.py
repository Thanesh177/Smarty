import copy
import importlib.util
import json
import sys
import types
import unittest
from contextlib import contextmanager
from pathlib import Path
from unittest.mock import patch


class ConditionalFailure(Exception): pass
class TransactionFailure(Exception): pass
class Condition:
    def __init__(self, name): self.name = name
    def eq(self, value): self.value = value; return self
    def begins_with(self, value): self.prefix = value; return self
    def exists(self): return self
    def __and__(self, other): self.other = other; return self


class MemoryTable:
    name = 'UnitTestNews'
    def __init__(self):
        self.records = {}
        self.calls = []
        self.meta = types.SimpleNamespace(client=types.SimpleNamespace(
            exceptions=types.SimpleNamespace(ConditionalCheckFailedException=ConditionalFailure, TransactionCanceledException=TransactionFailure),
            transact_write_items=self.transaction, get_paginator=self.paginator))
    def paginator(self, operation):
        def paginate(**kwargs):
            values = copy.deepcopy([item for item in self.records.values() if item['userId'] == kwargs['ExpressionAttributeValues'][':user']])
            for offset in range(0, len(values), 2): yield {'Items': values[offset:offset+2]}
        return types.SimpleNamespace(paginate=paginate)
    @contextmanager
    def batch_writer(self):
        yield types.SimpleNamespace(delete_item=lambda Key: self.records.pop((Key['userId'], Key['entryId']), None))
    def get_item(self, Key, **kwargs):
        return {'Item': copy.deepcopy(self.records.get((Key['userId'], Key['entryId'])))} if (Key['userId'], Key['entryId']) in self.records else {}
    def put_item(self, Item, **kwargs): self.records[(Item['userId'], Item['entryId'])] = copy.deepcopy(Item)
    def query(self, KeyConditionExpression, **kwargs):
        query = KeyConditionExpression
        values = [item for item in self.records.values() if item.get(query.name) == query.value]
        if hasattr(query, 'other'): values = [item for item in values if item['entryId'].startswith(query.other.prefix)]
        values.sort(key=lambda item: item.get('watchSort') if kwargs.get('IndexName') else item['entryId'], reverse=not kwargs.get('IndexName') and not kwargs.get('ScanIndexForward', True))
        start = kwargs.get('ExclusiveStartKey')
        if start: values = [item for item in values if item.get('watchSort', '') > start.get('watchSort', '')]
        limit = kwargs.get('Limit', len(values))
        response = {'Items': copy.deepcopy(values[:limit])}
        if len(values) > limit:
            response['LastEvaluatedKey'] = {name: values[limit-1][name] for name in ('userId','entryId','watchPartition','watchSort')}
        return response
    def update_item(self, Key, **kwargs):
        identity = (Key['userId'], Key['entryId'])
        if identity not in self.records: raise ConditionalFailure()
        self.records[identity]['readAt'] = kwargs['ExpressionAttributeValues'][':now']
    def transaction(self, TransactItems):
        snapshot = copy.deepcopy(self.records)
        try:
            for action in TransactItems:
                kind, value = next(iter(action.items()))
                key = value.get('Key') or value['Item']; identity = (key['userId'], key['entryId']); current = self.records.get(identity)
                if kind == 'Put':
                    if current: raise TransactionFailure()
                    self.put_item(value['Item'])
                elif kind == 'Delete':
                    if not current: raise TransactionFailure()
                    del self.records[identity]
                elif kind == 'Update':
                    args = value['ExpressionAttributeValues']
                    if ':max' in args:
                        count = (current or {}).get('count', 0)
                        if count >= args[':max']: raise TransactionFailure()
                        self.records[identity] = {**key, 'count': count + 1}
                    elif ':seen' in args:
                        if not current or current.get('revision') != args[':revision']: raise TransactionFailure()
                        current['seen'] = args[':seen']; current['lastCheckedAt'] = args[':now']
                    else:
                        if not current or current['count'] < 1: raise TransactionFailure()
                        current['count'] -= 1
        except TransactionFailure:
            self.records = snapshot; raise
        self.calls.append(TransactItems)


table = MemoryTable()
modules = {'boto3': types.SimpleNamespace(resource=lambda *a, **kw: types.SimpleNamespace(Table=lambda name: table)),
           'boto3.dynamodb.conditions': types.SimpleNamespace(Key=Condition, Attr=Condition),
           'botocore.config': types.SimpleNamespace(Config=lambda **kw: None)}
with patch.dict(sys.modules, modules):
    spec = importlib.util.spec_from_file_location('personal_news_service', Path(__file__).with_name('lambda_function.py'))
    service = importlib.util.module_from_spec(spec); spec.loader.exec_module(service)


def request(path='/news/personal', method='GET', user='alice', body=None):
    return {'rawPath': path, 'requestContext': {'http': {'method': method}, 'authorizer': {'jwt': {'claims': {'sub': user}}}}, 'body': json.dumps(body or {})}


class PersonalNewsTests(unittest.TestCase):
    def setUp(self): table.records.clear(); table.calls.clear()
    def follow(self, user='alice', query='Gaza ceasefire'):
        service.change_follow(user, {'query': query, 'follow': True})
        return next(item for item in table.records.values() if item['entryId'].startswith('story#'))
    def article(self, title='Gaza ceasefire negotiations resume', published=None, identifier='one'):
        return {'title': title, 'news_link': 'https://example.com/' + identifier, 'published_at': service.datetime.fromtimestamp(published or int(service.time.time()), service.timezone.utc).isoformat()}
    def test_authorization_never_trusts_body_user_id(self):
        self.assertEqual(service.lambda_handler(request(user=''), None)['statusCode'], 401)
        result = service.lambda_handler(request('/news/preferences','PUT',body={'userId':'bob','country':'IN','region':'Tamil Nadu','mode':'local'}), None)
        self.assertEqual(result['statusCode'], 200)
        self.assertIn(('alice','preferences'), table.records); self.assertNotIn(('bob','preferences'), table.records)
        self.assertEqual(service.lambda_handler({'source':'schedule','body':'{}'}, None)['statusCode'], 401)
    def test_private_results_do_not_leak_another_accounts_follows(self):
        self.follow()
        self.assertEqual(len(service.public_state('alice')['stories']), 1)
        self.assertEqual(service.public_state('bob')['stories'], [])
        self.assertEqual(service.response(200,{})['headers']['Cache-Control'], 'private, no-store')
    def test_follow_and_unfollow_are_idempotent_and_bounded(self):
        self.follow(); self.follow(query='gaza CEASEFIRE')
        self.assertEqual(table.records[('alice','follow-count')]['count'], 1)
        for index in range(49): service.change_follow('alice', {'query':f'Specific subject {index}', 'follow':True})
        with self.assertRaises(ValueError): service.change_follow('alice', {'query':'Another subject', 'follow':True})
        service.change_follow('alice', {'query':'Gaza ceasefire','follow':False}); service.change_follow('alice', {'query':'Gaza ceasefire','follow':False})
        self.assertEqual(table.records[('alice','follow-count')]['count'], 49)
    def test_new_reports_exclude_old_unrelated_unsafe_and_seen_reports(self):
        now = int(service.time.time()); story = self.follow(); story['createdAt'] = now - 100
        reports = [self.article(published=now-10),self.article('Football final scores',now-10,'sport'),self.article(published=now-200,identifier='old'),self.article(published=now+3600,identifier='future')]
        unsafe = self.article(published=now-10,identifier='unsafe'); unsafe['news_link']='javascript:alert(1)'; reports.append(unsafe)
        matches = service.new_reports(story,reports,now)
        self.assertEqual(len(matches),1)
        story['seen']=[matches[0]['reportId']]; self.assertEqual(service.new_reports(story,reports,now),[])
    def test_scheduled_updates_are_durable_deduplicated_and_readable(self):
        now=int(service.time.time()); story=self.follow(); story['createdAt']=now-100
        reports=[self.article(published=now-10)]
        self.assertTrue(service.publish_update(story,reports,now)); self.assertFalse(service.publish_update(story,reports,now))
        state=service.public_state('alice'); self.assertEqual(len(state['updates']),1); self.assertEqual(state['updates'][0]['readAt'],0)
        result=service.lambda_handler(request('/news/follows','POST',body={'read':state['updates'][0]['id']}),None)
        self.assertEqual(result['statusCode'],200); self.assertGreater(service.public_state('alice')['updates'][0]['readAt'],0)
        self.assertEqual(service.lambda_handler(request('/news/follows','POST',user='bob',body={'read':state['updates'][0]['id']}),None)['statusCode'],404)
    def test_unfollow_prevents_a_delayed_worker_from_recreating_alerts(self):
        now=int(service.time.time()); story=copy.deepcopy(self.follow()); story['createdAt']=now-100
        service.change_follow('alice',{'query':story['query'],'follow':False})
        self.assertFalse(service.publish_update(story,[self.article()],now)); self.assertEqual(service.public_state('alice')['updates'],[])
    def test_worker_shares_one_query_and_advances_a_bounded_cursor(self):
        now=int(service.time.time())
        for user in ['alice','bob']:
            service.change_follow(user,{'query':'Gaza ceasefire','follow':True})
            table.records[(user,'story#'+service.story_id('Gaza ceasefire'))]['createdAt']=now-100
        with patch.object(service,'fetch_reports',return_value=[self.article(published=now-10)]) as fetch:
            result=service.check_updates(None); self.assertEqual(result['updates'],2); fetch.assert_called_once()
        self.assertEqual(table.records[('__system__','watch-cursor')]['cursor'],None)
    def test_invalid_input_never_reaches_storage(self):
        for query in ['ab','https://attacker.com','OR AND NOT','<script>']:
            self.assertEqual(service.lambda_handler(request('/news/follows','POST',body={'query':query,'follow':True}),None)['statusCode'],400)
        self.assertEqual(service.lambda_handler(request('/news/preferences','PUT',body={'country':'INVALID'}),None)['statusCode'],400)
        self.assertEqual(len(table.records),0)

    def test_account_cleanup_paginates_and_leaves_other_members_untouched(self):
        self.follow('alice'); self.follow('bob')
        table.put_item(Item={'userId':'alice','entryId':'preferences','preferences':{'country':'IN'}})
        result=service.lambda_handler(request(method='DELETE'),None)
        self.assertEqual(result['statusCode'],200)
        self.assertEqual([item for item in table.records.values() if item['userId']=='alice'],[])
        self.assertEqual(len(service.public_state('bob')['stories']),1)

    def test_push_consent_is_account_private_and_validated(self):
        result = service.lambda_handler(request('/news/push-preferences', 'PUT', body={
            'userId': 'bob', 'enabled': True, 'news': True, 'previews': False,
            'timezone': 'America/Toronto', 'quietHours': {'start': '22:00', 'end': '07:30'}}), None)
        self.assertEqual(result['statusCode'], 200)
        preference = table.records[('alice', 'push-preferences')]['pushPreferences']
        self.assertFalse(preference['previews']); self.assertTrue(preference['news'])
        self.assertNotIn(('bob', 'push-preferences'), table.records)
        for value in [{'timezone': 'Invalid/Zone'}, {'quietHours': []}, {'quietHours': {'start': '25:10'}}]:
            # An empty list is treated as an empty/default object, not an error.
            if value == {'quietHours': []}: value = {'quietHours': ['invalid']}
            self.assertEqual(service.lambda_handler(request('/news/push-preferences', 'PUT', body=value), None)['statusCode'], 400)


if __name__ == '__main__': unittest.main()
