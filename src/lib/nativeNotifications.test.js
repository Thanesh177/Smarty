import test from 'node:test';
import assert from 'node:assert/strict';
import { nativeNotificationRequest, supportsNativeReminders } from './nativeNotifications.js';

test('older wrappers are not incorrectly treated as supporting closed-app reminders', async () => {
  globalThis.window = { webkit: { messageHandlers: { smartyNative: { postMessage() { throw Error('must not prompt'); } } } } };
  assert.equal(supportsNativeReminders(), false);
  assert.deepEqual(await nativeNotificationRequest('enable'), { permission: 'unavailable', scheduled: false });
});
test('identical bridge requests coalesce, clean up and can retry after failure', async () => {
  const listeners = new Set(), sent = [];
  globalThis.window = { __SMARTY_LOCAL_REMINDERS__: true, setTimeout, clearTimeout,
    addEventListener: (_, fn) => listeners.add(fn), removeEventListener: (_, fn) => listeners.delete(fn),
    webkit: { messageHandlers: { smartyNative: { postMessage: request => sent.push(request) } } },
  };
  const one = nativeNotificationRequest('configure', { userScope: 'a', time: '18:30' });
  const two = nativeNotificationRequest('configure', { userScope: 'a', time: '18:30' });
  assert.equal(one, two); assert.equal(sent.length, 1);
  listeners.forEach(fn => fn({ detail: { requestId: sent[0].requestId, permission: 'granted', scheduled: true } }));
  assert.equal((await one).scheduled, true); assert.equal(listeners.size, 0);
  const failure = nativeNotificationRequest('configure', { userScope: 'a', time: '18:30' });
  listeners.forEach(fn => fn({ detail: { requestId: sent[1].requestId, error: 'Device failed' } }));
  await assert.rejects(failure, /Device failed/); assert.equal(listeners.size, 0);
});
