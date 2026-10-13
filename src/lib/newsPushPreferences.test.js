import test from 'node:test';
import assert from 'node:assert/strict';
import { newsPushPreferences } from './newsPushPreferences.js';

test('server consent requires explicit enabled/news flags and preserves previews and quiet hours', () => {
  const value = newsPushPreferences({ enabled: true, categories: { news: true }, showPreviews: false,
    smartDelivery: true, quietHours: { enabled: true, start: '22:00', end: '08:00' } }, 'America/Toronto');
  assert.equal(value.news, true);
  assert.equal(value.enabled, true);
  assert.equal(value.previews, false);
  assert.equal(value.timezone, 'America/Toronto');
  assert.equal(value.quietHours.end, '08:00');
  assert.equal(newsPushPreferences({ categories: {} }, 'UTC').enabled, false);
  assert.equal(newsPushPreferences({ enabled: true }, 'UTC').news, false);
});
