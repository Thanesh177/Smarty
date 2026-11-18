import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeNewsPreference, readNewsPreference, writeNewsPreference, briefingPlace, newsPreferenceKey } from './newsPreferences.js';

const storage = () => { const values = new Map(); return { getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value) }; };
test('explicit choice is required, local editions are validated and world remains available', () => {
  assert.equal(normalizeNewsPreference({ country: 'IN' }), null);
  const choice = normalizeNewsPreference({ chosen: true, country: 'IN', region: 'Tamil Nadu', mode: 'local' });
  assert.deepEqual(briefingPlace(choice), { country: 'IN', region: 'Tamil Nadu' });
  assert.deepEqual(briefingPlace({ ...choice, mode: 'world' }), { country: 'GLOBAL', region: '' });
  assert.equal(normalizeNewsPreference({ chosen: true, country: 'invalid', region: 'Tamil Nadu', mode: 'local' }).mode, 'world');
  assert.equal(normalizeNewsPreference({ chosen: true, country: 'US', region: 'Tamil Nadu', mode: 'local' }).region, '');
});
test('places persist per account without exposing another member’s choices', () => {
  const store = storage(); writeNewsPreference('one', { chosen: true, country: 'CA', region: 'Ontario', mode: 'local' }, store);
  assert.equal(readNewsPreference('one', store).region, 'Ontario'); assert.equal(readNewsPreference('two', store), null);
  store.setItem(newsPreferenceKey('broken'), 'not json'); assert.equal(readNewsPreference('broken', store), null);
  assert.equal(readNewsPreference('one', { getItem() { throw new Error('blocked'); } }), null);
});

test('blocking access to browser storage still preserves the latest choice for its account', () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw new Error('blocked'); } });
  try {
    const first = { chosen: true, country: 'CA', region: 'Ontario', mode: 'local' };
    const latest = { chosen: true, country: 'IN', region: 'Tamil Nadu', mode: 'local' };
    writeNewsPreference('blocked-reader', first);
    writeNewsPreference('blocked-reader', latest);
    assert.deepEqual(readNewsPreference('blocked-reader'), latest);
    assert.equal(readNewsPreference('other-reader'), null);
  } finally {
    if (original) Object.defineProperty(globalThis, 'localStorage', original);
    else delete globalThis.localStorage;
  }
});
