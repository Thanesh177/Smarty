import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizePersonalNews } from './newsPersonalization.js';

test('malformed personalized-news envelopes fail safely rather than breaking cards', () => {
  for (const value of [null, {}, { stories: [], updates: {} }]) assert.throws(() => normalizePersonalNews(value), /temporarily unavailable/);
});
test('followed subjects and updates discard unusable entries and duplicate notifications', () => {
  const result = normalizePersonalNews({ preferences: { chosen: true, country: 'IN', region: 'Tamil Nadu', mode: 'local' },
    stories: [null, { id: 'one', query: {} }, { id: 'two', query: 'SpaceX' }, { id: 'duplicate', query: 'spacex' }],
    updates: [{ id: 'one', query: 'SpaceX', body: 'A new report', readAt: {} }, { id: 'one', query: 'SpaceX', body: 'Duplicate' }, { id: 'bad', query: {}, body: {} }],
  });
  assert.equal(result.stories.length, 1);
  assert.equal(result.updates.length, 1);
  assert.equal(result.updates[0].readAt, '');
  assert.equal(result.preferences.region, 'Tamil Nadu');
});
test('personalized lists and text are bounded', () => {
  const result = normalizePersonalNews({ stories: Array.from({ length: 300 }, (_, i) => ({ id: String(i), query: 'Subject ' + i })),
    updates: Array.from({ length: 600 }, (_, i) => ({ id: String(i), query: 'Subject ' + i, body: 'x'.repeat(2000) })) });
  assert.equal(result.stories.length, 50); assert.equal(result.updates.length, 100);
  assert.equal(result.updates[0].body.length, 1500);
});
