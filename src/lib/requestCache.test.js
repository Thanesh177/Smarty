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

test('each reader can cancel without cancelling a shared load', async () => {
  const cache = createRequestCache();
  let finish, calls = 0;
  const load = () => { calls++; return new Promise(resolve => { finish = resolve; }); };
  const controller = new AbortController();
  const one = cache.get('shared', load, 60000, { signal: controller.signal });
  const two = cache.get('shared', load);
  await Promise.resolve(); controller.abort();
  await assert.rejects(one, { name: 'AbortError' });
  finish('book'); assert.equal(await two, 'book'); assert.equal(calls, 1);
  assert.equal(await cache.get('shared', load), 'book');
});
test('force refresh coalesces, deletes invalidate late results, and reads promote LRU entries', async () => {
  const cache = createRequestCache({ maxEntries: 2 });
  let calls = 0; const load = () => ++calls;
  await cache.get('a', load); await cache.get('b', load); await cache.get('a', load); await cache.get('c', load);
  assert.equal(await cache.get('a', load), 1);
  assert.equal(await cache.get('b', load), 4);
  const values = await Promise.all([cache.get('b', load, 100, { forceRefresh: true }), cache.get('b', load, 100, { forceRefresh: true })]);
  assert.deepEqual(values, [5, 5]);
  let finish; const late = cache.get('late', () => new Promise(resolve => { finish = resolve; }));
  await Promise.resolve(); cache.delete('late'); finish('old'); await late;
  assert.equal(await cache.get('late', () => 'new'), 'new');
});
test('zero TTL coalesces only concurrent reads and invalid bounds never hang', async () => {
  const cache = createRequestCache({ maxEntries: 0 });
  let calls = 0; const load = () => ++calls;
  assert.deepEqual(await Promise.all([cache.get('a', load, 0), cache.get('a', load, 0)]), [1, 1]);
  assert.equal(await cache.get('a', load, 0), 2);
  const controller = new AbortController(); controller.abort();
  await assert.rejects(cache.get('none', load, 0, { signal: controller.signal }), { name: 'AbortError' });
  assert.equal(calls, 2);
});
