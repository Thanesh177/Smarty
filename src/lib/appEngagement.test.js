import test from 'node:test';
import assert from 'node:assert/strict';
import { canOfferRating, initializeEngagement, readEngagement, recordMeaningfulEngagement, recordRatingAction } from './appEngagement.js';
const DAY = 86400000;
const store = () => { const values = new Map(); return { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) }; };
function mature(storage, user = 'viewer') {
  initializeEngagement(user, storage, 0);
  recordMeaningfulEngagement(user, { kind: 'quiz', id: 'one' }, storage, DAY);
  recordMeaningfulEngagement(user, { kind: 'quiz', id: 'two' }, storage, 2 * DAY);
  recordMeaningfulEngagement(user, { kind: 'lesson', id: 'three' }, storage, 7 * DAY);
  return readEngagement(user, storage, 7 * DAY);
}
test('rating eligibility requires real use, three distinct tasks, two days and a week', () => {
  const storage = store(); const state = mature(storage);
  assert.equal(canOfferRating(state, 7 * DAY), true);
  assert.equal(canOfferRating({ ...state, tasks: ['one'] }, 7 * DAY), false);
  assert.equal(canOfferRating({ ...state, days: ['2026-11-03'] }, 7 * DAY), false);
  assert.equal(canOfferRating(state, 6 * DAY), false);
});
test('repeated task callbacks cannot manufacture engagement and accounts stay isolated', () => {
  const storage = store(); mature(storage, 'alice');
  assert.equal(recordMeaningfulEngagement('alice', { kind: 'quiz', id: 'one' }, storage, 7 * DAY), false);
  assert.equal(readEngagement('alice', storage, 7 * DAY).tasks.length, 3);
  assert.equal(canOfferRating(readEngagement('bob', storage, 7 * DAY), 7 * DAY), false);
  assert.equal(recordMeaningfulEngagement('alice', { kind: 'click', id: 'fake' }, storage), false);
});
test('dismissal, never-again and store opening suppress unsolicited prompts', () => {
  for (const action of ['later', 'never', 'store']) {
    const storage = store(); mature(storage);
    recordRatingAction('viewer', action, storage, 7 * DAY);
    assert.equal(canOfferRating(readEngagement('viewer', storage, 7 * DAY), 8 * DAY), false);
    if (action !== 'later') assert.equal(canOfferRating(readEngagement('viewer', storage, 500 * DAY), 500 * DAY), false);
  }
});
test('shown prompts have a 90-day cooldown and at most three offers per rolling year', () => {
  const storage = store(); mature(storage);
  for (const day of [7, 98, 189]) assert.equal(recordRatingAction('viewer', 'shown', storage, day * DAY), true);
  assert.equal(recordRatingAction('viewer', 'shown', storage, 8 * DAY), false);
  assert.equal(canOfferRating(readEngagement('viewer', storage, 281 * DAY), 281 * DAY), false);
  assert.equal(canOfferRating(readEngagement('viewer', storage, 373 * DAY), 373 * DAY), true);
});
test('blocked storage does not enable automatic prompts; malformed records recover safely', () => {
  const blocked = { getItem() { throw Error('blocked'); }, setItem() { throw Error('blocked'); } };
  assert.equal(recordMeaningfulEngagement('viewer', { kind: 'quiz', id: 'one' }, blocked), false);
  assert.equal(canOfferRating(readEngagement('viewer', blocked)), false);
  const corrupt = { getItem: () => '{bad', setItem() {} };
  assert.deepEqual(readEngagement('viewer', corrupt).tasks, []);
});
