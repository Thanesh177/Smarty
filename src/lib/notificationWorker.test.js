import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function worker() {
  const listeners = {}, shown = [], navigated = [];
  let background;
  const context = vm.createContext({ URL, Date, Set, Promise, encodeURIComponent, setTimeout, clearTimeout,
    firebase: { initializeApp() {}, messaging: () => ({ onBackgroundMessage: fn => { background = fn; } }) },
    indexedDB: { open() { throw Error('blocked'); } },
    clients: { matchAll: async () => [{ url: 'https://smarty.wiki/feed', navigate: async url => navigated.push(url), focus() {} }], openWindow: async url => navigated.push(url) },
    importScripts(path) {
      if (path === '/notification-policy.js') vm.runInContext(fs.readFileSync(new URL('../../public/notification-policy.js', import.meta.url), 'utf8'), context);
    },
  });
  context.self = { location: { origin: 'https://smarty.wiki' },
    registration: { showNotification: async (title, options) => shown.push({ title, options }) },
    addEventListener: (name, fn) => { listeners[name] = fn; },
  };
  vm.runInContext(fs.readFileSync(new URL('../../public/firebase-messaging-sw.js', import.meta.url), 'utf8'), context);
  return { shown, navigated, background: payload => background(payload),
    async preferences(value) { let task; listeners.message({ data: { type: 'SMARTY_NOTIFICATION_PREFERENCES', preferences: value }, waitUntil: promise => { task = promise; } }); await task; },
    async click(data) { let task, stopped = false; listeners.notificationclick({ notification: { data, close() {} }, stopImmediatePropagation() { stopped = true; }, waitUntil: promise => { task = promise; } }); await task; assert.equal(stopped, true); },
  };
}
test('worker remains quiet before account activation and after logout', async () => {
  const value = worker();
  await value.background({ data: { type: 'chat', body: 'private' } });
  assert.equal(value.shown.length, 0);
  await value.preferences({ enabled: false, userScope: 'anonymous' });
  await value.background({ data: { type: 'chat', body: 'private' } });
  assert.equal(value.shown.length, 0);
});
test('data-only alerts use the shared privacy policy even when persistence is unavailable', async () => {
  const value = worker();
  await value.preferences({ userScope: 'reader', showPreviews: false });
  await value.background({ data: { type: 'messages', body: 'private', userId: 'other' } });
  assert.equal(value.shown.length, 0);
  await value.background({ data: { type: 'messages', body: 'private', userId: 'reader', url: 'https://evil.example' } });
  assert.equal(value.shown.length, 1);
  assert.equal(value.shown[0].options.body, 'You have a new message.');
  assert.equal(value.shown[0].options.data.url, '/feed?topic=All');
  await value.preferences({ enabled: false, userScope: 'reader' });
  await value.background({ data: { type: 'messages', userId: 'reader' } });
  assert.equal(value.shown.length, 1);
});
test('FCM auto-display payloads cannot create a second banner', async () => {
  const value = worker(); await value.preferences({ userScope: 'reader' });
  await value.background({ notification: { title: 'Already displayed' }, data: { type: 'messages' } });
  assert.equal(value.shown.length, 0);
});
test('worker clicks focus the app and reject external/script navigation, including FCM auto payloads', async () => {
  const value = worker();
  await value.click({ FCM_MSG: { data: { url: '/learning' } } });
  await value.click({ url: 'javascript:alert(1)' });
  assert.deepEqual(value.navigated, ['https://smarty.wiki/learning', 'https://smarty.wiki/feed?topic=All']);
});
