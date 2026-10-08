import test from 'node:test';
import assert from 'node:assert/strict';
import { claimDailyReminder, learningReminder, localReminderDay, nextReminderAt, reminderDue, reminderTime } from './dailyReminder.js';

const prefs = { dailyReminder: { enabled: true, time: '18:30' } };
const at = (day, hour, minute = 0) => new Date(2026, 9, day, hour, minute);

test('daily reminders are opt-in and master/learning switches can stop them', () => {
  assert.equal(reminderTime({}), null);
  assert.equal(reminderTime(prefs), '18:30');
  assert.equal(reminderTime({ ...prefs, enabled: false }), null);
  assert.equal(reminderTime({ ...prefs, categories: { learning: false } }), null);
});
test('a chosen time in quiet hours moves to their end; all-day quiet pauses it', () => {
  const value = { dailyReminder: { enabled: true, time: '23:00' } };
  assert.equal(reminderTime(value), '07:30');
  assert.equal(reminderTime({ ...value, smartDelivery: false }), '23:00');
  assert.equal(reminderTime({ ...value, quietHours: { start: '00:00', end: '00:00' } }), null);
});
test('next schedule follows local dates, never a fixed 24-hour interval', () => {
  assert.equal(nextReminderAt(prefs, at(7, 10)).getDate(), 7);
  assert.equal(nextReminderAt(prefs, at(7, 19)).getDate(), 8);
  assert.equal(nextReminderAt(prefs, at(7, 19)).getHours(), 18);
  assert.equal(reminderDue(prefs, at(7, 18, 29)), false);
  assert.equal(reminderDue(prefs, at(7, 18, 30)), true);
  assert.equal(reminderDue(prefs, at(7, 23)), false);
});
test('one claim per local day/account survives reload and never nags without storage', () => {
  const data = new Map(), store = { getItem: key => data.get(key), setItem: (key, value) => data.set(key, value) };
  assert.equal(claimDailyReminder('a', at(7, 19), store), true);
  assert.equal(claimDailyReminder('a', at(7, 20), store), false);
  assert.equal(claimDailyReminder('b', at(7, 20), store), true);
  assert.equal(claimDailyReminder('a', at(8, 19), store), true);
  assert.equal(localReminderDay(at(7, 0)), '2026-10-07');
  assert.equal(claimDailyReminder('', at(7, 19), store), false);
  assert.equal(claimDailyReminder('a', at(9, 19), { getItem() { throw Error('blocked'); } }), false);
});
test('due learning reviews have useful copy and a real destination', () => {
  const result = learningReminder([{ context: { postId: 'a' }, nextReviewAt: at(6, 19).toISOString() }], at(7, 19));
  assert.match(result.body, /1 lesson is ready/);
  assert.equal(result.url, '/learning');
  assert.match(learningReminder().body, /Read something new/);
});
