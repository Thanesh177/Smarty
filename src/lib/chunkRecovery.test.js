import test from 'node:test';
import assert from 'node:assert/strict';
import { claimChunkRecovery, isChunkLoadFailure } from './chunkRecovery.js';
const storage = () => {
  const values = new Map();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
};

test('only missing application chunks trigger automatic recovery', () => {
  assert.equal(isChunkLoadFailure(new Error('Failed to fetch dynamically imported module: /old-chunk.js')), true);
  assert.equal(isChunkLoadFailure('Loading chunk 42 failed'), true);
  assert.equal(isChunkLoadFailure(new Error('Feed failed to load')), false);
  assert.equal(isChunkLoadFailure('Network Error'), false);
});

test('the reload guard survives page recreation and cannot repeat after fifteen seconds', () => {
  const saved = storage();
  assert.equal(claimChunkRecovery({ storage: saved, now: 1000000 }), true);
  assert.equal(claimChunkRecovery({ storage: saved, now: 1016000 }), false);
  assert.equal(claimChunkRecovery({ storage: saved, now: 1299999 }), false);
  assert.equal(claimChunkRecovery({ storage: saved, now: 1300001 }), true);
});

test('offline and unavailable storage never cause reload loops or discard the current page', () => {
  assert.equal(claimChunkRecovery({ storage: storage(), online: false }), false);
  assert.equal(claimChunkRecovery({ storage: { getItem() { throw Error('blocked'); } } }), false);
  assert.equal(claimChunkRecovery({ storage: { getItem() { return null; }, setItem() {} } }), false);
  assert.equal(claimChunkRecovery(), false);
});
