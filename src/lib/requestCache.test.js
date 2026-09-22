import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequestCache } from './requestCache.js';

test('simultaneous reads share a request, then use the cached result', async () => {
  const cache = createRequestCache();
  let calls = 0;
  const load = async () => ++calls;
  assert.deepEqual(await Promise.all([cache.get('a', load), cache.get('a', load)]), [1, 1]);
  assert.equal(await cache.get('a', load), 1);
  assert.equal(calls, 1);
});
test('expires, retries failures, and evicts old entries', async () => {
  let clock = 0, calls = 0;
  const cache = createRequestCache({ now: () => clock, maxEntries: 1 });
  const load = async () => ++calls;
  await cache.get('a', load, 10);
  clock = 11;
  assert.equal(await cache.get('a', load, 10), 2);
  await cache.get('b', load);
  assert.equal(await cache.get('a', load), 4);
  await assert.rejects(cache.get('bad', () => { throw Error('offline'); }));
  assert.equal(await cache.get('bad', load), 5);
});
test('account switch prevents pending old reads from refilling the cache', async () => {
  const cache = createRequestCache();
  let finish;
  const old = cache.get('a', () => new Promise(resolve => { finish = resolve; }));
  await Promise.resolve();
  cache.clear();
  await cache.get('a', () => 'new account');
  finish('old account');
  await old;
  assert.equal(await cache.get('a', () => 'unexpected'), 'new account');
});
