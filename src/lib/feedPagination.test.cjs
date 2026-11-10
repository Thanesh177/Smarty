const test = require('node:test');
const assert = require('node:assert/strict');
const { buildSync } = require('esbuild');
const vm = require('node:vm');
const path = require('node:path');
const code = buildSync({ entryPoints: [path.join(__dirname, '../hooks/useFeed.js')], bundle: true,
  write: false, platform: 'node', format: 'cjs', external: ['react', '../api/client', '../contexts/AuthContext'] }).outputFiles[0].text;
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const tick = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };
function harness({ videoOnly = false } = {}) {
  const slots = [], effects = [], requests = [], storage = new Map();
  const events = new EventTarget();
  let index = 0, user = { userId: 'one' };
  const api = { getFeed(params) { const task = deferred(); requests.push({ ...params, ...task }); return task.promise; },
    getVideoFeed(params) { return this.getFeed(params); },
    getSingleReel: async id => ({ id, videoUrl: '/fresh.mp4' }) };
  const react = {
    useState(initial) { const i = index++; if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial;
      return [slots[i], next => { slots[i] = typeof next === 'function' ? next(slots[i]) : next; }]; },
    useRef(initial) { const i = index++; return slots[i] ||= { current: initial }; },
    useMemo: fn => fn(), useCallback: fn => fn,
    useEffect(fn, deps) { const i = index++; const previous = slots[i];
      if (!previous || deps.some((dep, j) => dep !== previous.deps[j])) {
        slots[i] = { deps, cleanup: previous?.cleanup }; effects.push(() => { slots[i].cleanup?.(); slots[i].cleanup = fn(); });
      } },
  };
  const module = { exports: {} };
  vm.runInNewContext(code, { module, exports: module.exports, console, window: events, CustomEvent,
    localStorage: { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) },
    require(name) { if (name === 'react') return react;
      if (name === '../api/client') return { postApi: api };
      if (name === '../contexts/AuthContext') return { useAuth: () => ({ user }) };
      throw new Error(name);
    } });
  return { requests, api, storage, events, setUser: value => { user = value; }, render() {
    index = 0; const result = module.exports.default({ pageSize: 30, videoOnly });
    effects.splice(0).forEach(fn => fn()); return result;
  } };
}

test('scrolling awaits the exact in-flight prefetched page and coalesces repeated taps', async () => {
  const app = harness(); app.render();
  assert.equal(app.requests[0].limit, 30);
  app.requests[0].resolve({ items: [{ id: 'first' }], nextCursor: 'a' }); await tick();
  const feed = app.render(); const pending = feed.loadMore(); feed.loadMore();
  assert.equal(app.requests.length, 2);
  app.requests[1].resolve({ items: [{ id: 'next' }], nextCursor: null }); await pending;
  assert.equal(app.render().posts.map(post => post.id).join(','), 'first,next');
});

test('a cached feed waits for refresh before consuming an old saved cursor', async () => {
  const app = harness();
  app.storage.set('smarty_cached_feed_v2:one', JSON.stringify([{ id: 'cached' }]));
  app.storage.set('smarty_cached_feed_cursor_v2:one', 'old-cursor');
  const opening = app.render();
  assert.equal(opening.posts[0].id, 'cached');
  assert.equal(opening.refreshing, true);
  await opening.loadMore();
  assert.equal(app.requests.length, 1);
  app.requests[0].resolve({ items: [{ id: 'fresh' }], nextCursor: 'new-cursor' }); await tick();
  const current = app.render(); assert.equal(current.refreshing, false);
  const more = current.loadMore();
  assert.equal(app.requests[1].cursor, 'new-cursor');
  app.requests[1].resolve({ items: [{ id: 'video' }], nextCursor: null }); await more;
  assert.equal(app.render().posts.map(post => post.id).join(','), 'fresh,video');
});

test('a late prefetch cannot replace a newer refresh cursor or mix its posts', async () => {
  const app = harness(); app.render();
  app.requests[0].resolve({ items: [{ id: 'old' }], nextCursor: 'a' }); await tick();
  const refreshing = app.render().refreshFeed();
  app.requests[2].resolve({ items: [{ id: 'fresh' }], nextCursor: 'b' }); await refreshing;
  app.requests[1].resolve({ items: [{ id: 'stale' }], nextCursor: 'bad' }); await tick();
  const more = app.render().loadMore();
  app.requests[3].resolve({ items: [{ id: 'fresh-next' }], nextCursor: null }); await more;
  assert.equal(app.render().posts.map(post => post.id).join(','), 'fresh,fresh-next');
});

test('late initial responses cannot overwrite a newer refresh', async () => {
  const app = harness(); const first = app.render(); const refresh = first.refreshFeed();
  app.requests[1].resolve({ items: [{ id: 'current' }], nextCursor: null }); await refresh;
  app.requests[0].resolve({ items: [{ id: 'late' }], nextCursor: null }); await tick();
  assert.equal(app.render().posts[0].id, 'current');
});

test('hidden videos do not reappear from an already-running next page', async () => {
  const app = harness(); app.render();
  app.requests[0].resolve({ items: [{ id: 'hidden' }], nextCursor: 'a' }); await tick();
  const feed = app.render(); const more = feed.loadMore(); feed.hidePost('hidden');
  app.requests[1].resolve({ items: [{ id: 'hidden' }, { id: 'new' }], nextCursor: null }); await more;
  assert.equal(app.render().posts.map(post => post.id).join(','), 'new');
});

test('a mounted feed removes moderated content from the same account only', async () => {
  const app = harness(); app.render();
  app.requests[0].resolve({ items: [{ id: 'reported' }, { id: 'blocked', creatorId: 'creator' }, { id: 'safe' }], nextCursor: null });
  await tick();
  const moderate = detail => app.events.dispatchEvent(new CustomEvent('smarty:feed-moderated', { detail }));
  moderate({ account: 'two', postId: 'reported' });
  assert.equal(app.render().posts.length, 3);
  moderate({ account: 'one', postId: 'reported' });
  moderate({ account: 'one', creatorId: 'creator' });
  assert.equal(app.render().posts.map(post => post.id).join(','), 'safe');
});

test('failed prefetched pages can be retried with the same cursor', async () => {
  const app = harness(); app.render();
  app.requests[0].resolve({ items: [], nextCursor: 'a' }); await tick();
  app.requests[1].reject(new Error('Offline')); await tick();
  const more = app.render().loadMore();
  assert.equal(app.requests[2].cursor, 'a');
  app.requests[2].resolve({ items: [{ id: 'recovered' }], nextCursor: null }); await more;
  assert.equal(app.render().posts[0].id, 'recovered');
});

test('switching accounts discards in-flight content from the previous account', async () => {
  const app = harness(); app.render(); app.setUser({ userId: 'two' }); app.render();
  app.requests[1].resolve({ items: [{ id: 'account-two' }], nextCursor: null }); await tick();
  app.requests[0].resolve({ items: [{ id: 'account-one' }], nextCursor: null }); await tick();
  assert.equal(app.render().posts.map(post => post.id).join(','), 'account-two');
});

test('media renewal only updates the requested post and rejects another identity', async () => {
  const app = harness(); app.render();
  app.requests[0].resolve({ items: [{ id: 'video', videoUrl: '/expired.mp4' }], nextCursor: null }); await tick();
  await app.render().refreshPost('video');
  assert.equal(app.render().posts[0].videoUrl, '/fresh.mp4');
  app.api.getSingleReel = async () => ({ id: 'another', videoUrl: '/other.mp4' });
  await assert.rejects(app.render().refreshPost('video'));
  assert.equal(app.render().posts[0].id, 'video');
});

test('video pagination appends in cursor order, passes empty pages, and closes a cursor cycle', async () => {
  const app = harness({ videoOnly: true }); app.render();
  app.requests[0].resolve({ items: [{ id: 'first', createdAt: 10, videoUrl: '/one.mp4' }], nextCursor: 'a' }); await tick();
  const firstBatch = app.render().loadMore();
  app.requests[1].resolve({ items: [], nextCursor: 'b' }); await firstBatch;
  const nextBatch = app.render().loadMore();
  app.requests[2].resolve({ items: [{ id: 'first', videoUrl: '/one.mp4' }, { id: 'second', createdAt: 99, videoKey: 'older.mp4' }], nextCursor: 'a' });
  await nextBatch;
  assert.equal(app.render().posts.map(post => post.id).join(','), 'first,second');
  assert.equal(app.render().nextCursor, null);
});
