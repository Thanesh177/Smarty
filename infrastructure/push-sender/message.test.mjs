import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMessage, notificationPath, receiptId, unregistered } from './message.mjs';
const payload = { userId: 'test-user', title: 'A new report', body: 'Details',
  data: { type: 'news', url: '/news/story?q=climate', notificationId: 'alert#1', receiptTable: 'private-table' } };

test('iOS gets an APNs alert and an account-scoped relative deep link', () => {
  const { message } = buildMessage({ token: 'fixture-device', platform: 'ios' }, payload);
  assert.equal(message.apns.payload.aps.alert.body, 'Details');
  assert.equal(message.apns.headers['apns-push-type'], 'alert');
  assert.equal(message.apns.headers['apns-collapse-id'].length, 64);
  assert.equal(message.data.userId, 'test-user');
  assert.equal(message.data.url, '/news/story?q=climate');
  assert.equal(message.data.receiptTable, undefined);
});
test('web and Android retain data-only delivery to avoid duplicate notifications', () => {
  for (const platform of ['web', 'android']) {
    const { message } = buildMessage({ token: 'fixture-device', platform }, payload);
    assert.equal(message.notification, undefined);
    assert.equal(message.apns, undefined);
    assert.equal(message.webpush.fcmOptions.link, 'https://smarty.wiki/news/story?q=climate');
  }
});
test('only structured UNREGISTERED errors remove a device', () => {
  assert.equal(unregistered({ error: { message: 'INVALID_ARGUMENT' } }), false);
  assert.equal(unregistered({ error: { details: [{ '@type': 'type.googleapis.com/google.firebase.fcm.v1.FcmError', errorCode: 'UNREGISTERED' }] } }), true);
});
test('deep links reject external and backslash paths; old chat payloads remain compatible', () => {
  for (const url of ['https://evil.test', '//evil.test', '/\\evil.test', '/x\n']) assert.equal(notificationPath({ url }), '/notifications');
  assert.equal(notificationPath({ chatId: 'a/b', senderId: 'person' }), '/chat?chatId=a%2Fb&senderId=person');
});
test('Unicode bodies fit the FCM payload limit', () => {
  const result = buildMessage({ token: 'fixture-device', platform: 'ios' }, { ...payload, title: '好'.repeat(200), body: '好'.repeat(2000) });
  assert.ok(Buffer.byteLength(JSON.stringify(result.message)) < 4096);
});
test('delivery receipts are opaque and stable per alert/device', () => {
  assert.equal(receiptId('a', 'b'), receiptId('a', 'b'));
  assert.notEqual(receiptId('a', 'b'), receiptId('a', 'c'));
  assert.ok(!receiptId('a', 'private-device').includes('private-device'));
});
