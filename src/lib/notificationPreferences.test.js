import test from 'node:test';
import assert from 'node:assert/strict';
import { activateNotificationPreferences, classifyNotification, createNotificationDeduper, getNotificationBody, getNotificationDecision,
  getNotificationFingerprint, getNotificationPath, isNotificationQuietTime, loadActiveNotificationPreferences,
  loadNotificationPreferences, normalizeNotificationPreferences, normalizeUnreadCount, saveNotificationPreferences,
  syncNotificationPreferencesToWorker } from './notificationPreferences.js';

function storage() { const data = new Map(); return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) }; }
const at = (hour, minute = 0) => new Date(2026, 9, 7, hour, minute);

test('normalization tolerates malformed data and keeps daily reminders opt-in', () => {
  for (const value of [null, '', [], 3, { quietHours: { start: '99:00' }, dailyReminder: { enabled: 'yes', time: 'bad' } }]) {
    const result = normalizeNotificationPreferences(value);
    assert.equal(result.dailyReminder.enabled, false);
    assert.equal(result.dailyReminder.time, '18:30');
    assert.equal(result.quietHours.start, '22:00');
  }
});
test('explicit categories win over accidental title keyword matches', () => {
  assert.equal(classifyNotification({ category: 'news', title: 'Government account of a debate' }), 'news');
  assert.equal(classifyNotification({ type: 'daily_reminder' }), 'learning');
  assert.equal(classifyNotification({ type: 'dm' }), 'messages');
});
test('overnight quiet hours and exact boundaries are respected', () => {
  assert.equal(isNotificationQuietTime({}, at(23)), true);
  assert.equal(isNotificationQuietTime({}, at(7, 29)), true);
  assert.equal(isNotificationQuietTime({}, at(7, 30)), false);
  assert.equal(isNotificationQuietTime({}, at(22)), true);
  assert.equal(isNotificationQuietTime({ quietHours: { start: '12:00', end: '12:00' } }, at(9)), true);
});
test('master/category controls, safety, immediate messages and preview privacy work', () => {
  assert.equal(getNotificationDecision({ type: 'chat' }, {}, at(23)).deliver, true);
  assert.equal(getNotificationDecision({ type: 'learning' }, {}, at(23)).reason, 'quiet-hours');
  assert.equal(getNotificationDecision({ type: 'chat' }, { categories: { messages: false } }).deliver, false);
  assert.equal(getNotificationDecision({ type: 'safety' }, {}, at(23)).deliver, true);
  assert.equal(getNotificationDecision({ type: 'safety' }, { enabled: false }).deliver, false);
  assert.equal(getNotificationDecision({ category: 'news' }, { smartDelivery: false }, at(23)).deliver, true);
  assert.equal(getNotificationBody({ type: 'chat', body: 'Private words' }, { showPreviews: false }), 'You have a new message.');
});
test('notification links stay inside the app and IDs deduplicate different transports', () => {
  for (const value of ['https://example.com/feed', 'javascript:alert(1)', '//example.com', 'https://smarty.wiki.evil.example']) {
    assert.equal(getNotificationPath(value), '/feed?topic=All');
  }
  assert.equal(getNotificationPath('https://smarty.wiki/learning?topic=AI#review'), '/learning?topic=AI#review');
  assert.equal(getNotificationFingerprint({ messageId: 'same' }), getNotificationFingerprint({ rawPayload: { data: { messageId: 'same' } } }));
});
test('badge counts cannot become NaN, infinite, negative or fractional', () => {
  assert.deepEqual(['bad', Infinity, -2, undefined, 2.9, '4'].map(normalizeUnreadCount), [0, 0, 0, 0, 2, 4]);
});
test('notification deduplication expires, stays bounded and clears across accounts', () => {
  let time = 0;
  const cache = createNotificationDeduper({ now: () => time, ttlMs: 100, limit: 2 });
  assert.equal(cache.claim('a'), true); assert.equal(cache.claim('a'), false);
  time = 101; assert.equal(cache.claim('a'), true);
  cache.claim('b'); cache.claim('c'); assert.equal(cache.claim('a'), true);
  cache.clear(); assert.equal(cache.claim('a'), true);
});
test('account switches activate the right settings and logout disables delivery', async () => {
  globalThis.localStorage = storage();
  globalThis.window = { dispatchEvent() {} };
  globalThis.CustomEvent = class {};
  saveNotificationPreferences('reader-a', { showPreviews: false });
  saveNotificationPreferences('reader-b', { enabled: false });
  activateNotificationPreferences('reader-a');
  assert.equal(loadActiveNotificationPreferences().showPreviews, false);
  assert.equal(loadActiveNotificationPreferences().enabled, true);
  activateNotificationPreferences('reader-b');
  assert.equal(loadActiveNotificationPreferences().enabled, false);
  activateNotificationPreferences('');
  assert.equal(loadActiveNotificationPreferences().enabled, false);
  assert.equal(loadActiveNotificationPreferences().userScope, 'anonymous');
  const one = loadNotificationPreferences('reader-a');
  assert.equal(loadNotificationPreferences('reader-a'), one);
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { serviceWorker: {
    ready: new Promise(() => {}), getRegistration: async () => null,
  } } });
  await syncNotificationPreferencesToWorker(loadActiveNotificationPreferences());
});
test('blocked storage writes retain preferences in memory without crashing', () => {
  globalThis.localStorage = { getItem: () => null, setItem: () => { throw Error('blocked'); } };
  saveNotificationPreferences('reader-private', { showPreviews: false });
  assert.equal(loadNotificationPreferences('reader-private').showPreviews, false);
});
