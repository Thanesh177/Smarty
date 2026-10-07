import test from 'node:test';
import assert from 'node:assert/strict';
import { createNewsRequestCache } from './newsRequestCache.js';

const briefing = { dailySummary: { summaryMode: 'editorial', overview: 'Today’s verified developments.' } };

test('deduplicates pending public requests and retains results across page openings', async () => {
  const cache = createNewsRequestCache();
  let calls = 0;
  const load = async () => { calls++; return briefing; };
  const results = await Promise.all([cache.get('GLOBAL', load), cache.get('GLOBAL', load)]);
  assert.deepEqual(results, [briefing, briefing]);
  assert.equal(await cache.get('GLOBAL', load), briefing);
  assert.equal(calls, 1);
});

test('cancelling one reader does not cancel the shared request or other readers', async () => {
  const cache = createNewsRequestCache();
  const controller = new AbortController();
  let finish;
  const load = () => new Promise(resolve => { finish = resolve; });
  const first = cache.get('GLOBAL', load, { signal: controller.signal });
  const second = cache.get('GLOBAL', load);
  controller.abort();
  await assert.rejects(first, { name: 'AbortError' });
  finish(briefing);
  assert.equal(await second, briefing);
  assert.equal(await cache.get('GLOBAL', load), briefing);
});

test('isolates locations, refreshes completed entries, and coalesces pending refreshes', async () => {
  const cache = createNewsRequestCache();
  let calls = 0;
  const load = async () => { calls++; return briefing; };
  await cache.get('GLOBAL', load);
  await cache.get('IN:Tamil Nadu', load);
  await Promise.all([cache.get('GLOBAL', load, { forceRefresh: true }), cache.get('GLOBAL', load, { forceRefresh: true })]);
  assert.equal(calls, 3);
});

test('retries failures and expires fallback reports sooner than editorial briefings', async () => {
  let clock = 100000;
  const cache = createNewsRequestCache({ now: () => clock });
  await assert.rejects(cache.get('GLOBAL', async () => { throw new Error('offline'); }));
  let calls = 0;
  const load = async () => { calls++; return { articles: [] }; };
  await cache.get('GLOBAL', load);
  clock += 61000;
  await cache.get('GLOBAL', load);
  assert.equal(calls, 2);
  await cache.get('editorial', async () => briefing);
  clock += 61000;
  assert.equal(await cache.get('editorial', async () => { throw new Error('Should remain cached'); }), briefing);
});

test('bounds the cache and refuses already-cancelled requests', async () => {
  const cache = createNewsRequestCache({ maxEntries: 2 });
  let calls = 0;
  const load = async () => { calls++; return briefing; };
  await cache.get('one', load); await cache.get('two', load); await cache.get('three', load);
  await cache.get('one', load);
  assert.equal(calls, 4);
  const controller = new AbortController(); controller.abort();
  await assert.rejects(cache.get('cancelled', load, { signal: controller.signal }), { name: 'AbortError' });
  assert.equal(calls, 4);
});
