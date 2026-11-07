const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { transformSync } = require('esbuild');

function renderPlayer(overrides = {}) {
  const effects = [], writes = [], refs = [], listeners = new Map(), timers = new Map();
  let index = 0;
  const fakeVideo = {
    isConnected: true, paused: true, muted: true, playCalls: 0, released: 0, loaded: 0,
    play() { this.playCalls += 1; this.paused = false; return Promise.resolve(); },
    pause() { this.paused = true; },
    removeAttribute(name) { if (name === 'src') this.released += 1; },
    load() { this.loaded += 1; },
  };
  const hookReact = {
    memo: component => component,
    useCallback: callback => callback,
    useRef: initial => { const ref = { current: initial === null ? fakeVideo : initial }; refs.push(ref); return ref; },
    useState: initial => { const slot = index++; return [initial, value => writes.push({ slot, value })]; },
    useEffect: callback => effects.push(callback),
  };
  const compiled = transformSync(fs.readFileSync(__dirname + '/ReelVideo.jsx', 'utf8'), {
    loader: 'jsx', jsx: 'automatic', format: 'cjs',
  }).code;
  const scope = { exports: {} };
  vm.runInNewContext(compiled, {
    module: scope, exports: scope.exports, queueMicrotask, URL,
    document: { visibilityState: 'visible', addEventListener: (name, handler) => listeners.set(name, handler), removeEventListener: name => listeners.delete(name) },
    window: { addEventListener: (name, handler) => listeners.set(name, handler), removeEventListener: name => listeners.delete(name),
      setTimeout: callback => { const id = timers.size + 1; timers.set(id, callback); return id; }, clearTimeout: id => timers.delete(id) },
    require: name => name === 'react' ? hookReact : ['./PostAuthor', './NativeDownloadButton'].includes(name) ? () => null : name.startsWith('../lib/') ? require(name + '.js') : require(name),
  });
  const tree = scope.exports.default({
    post: { id: 'video-one', videoUrl: 'https://media.example/one.mp4', title: 'One specific idea' },
    active: true, nearby: true, muted: false, reducedMotion: false,
    onMute() {}, onSave() {}, onSafety() {}, ...overrides,
  });
  return { tree, fakeVideo, effects, writes, refs, listeners, timers };
}

test('the visible clip autoplays with sound when permitted and offscreen clips never start', async () => {
  const active = renderPlayer();
  active.effects.forEach(effect => effect());
  await Promise.resolve();
  assert.equal(active.fakeVideo.playCalls, 1);
  assert.equal(active.fakeVideo.muted, false);
  const offscreen = renderPlayer({ active: false });
  offscreen.effects.forEach(effect => effect());
  assert.equal(offscreen.fakeVideo.playCalls, 0);
  assert.equal(offscreen.fakeVideo.paused, true);
});

test('effect rehearsal keeps the connected player source available for autoplay', async () => {
  const player = renderPlayer();
  const cleanup = player.effects.map(effect => effect());
  cleanup.forEach(dispose => dispose?.());
  player.effects.forEach(effect => effect());
  await Promise.resolve();
  assert.equal(player.fakeVideo.released, 0);
  assert.equal(player.fakeVideo.loaded, 0);
  assert.equal(player.fakeVideo.paused, false);
  assert.equal(player.fakeVideo.playCalls, 2);
});

test('a genuinely detached player pauses and releases its download', async () => {
  const player = renderPlayer();
  const cleanup = player.effects.map(effect => effect());
  player.fakeVideo.isConnected = false;
  cleanup.forEach(dispose => dispose?.());
  await Promise.resolve();
  assert.equal(player.fakeVideo.paused, true);
  assert.equal(player.fakeVideo.released, 1);
  assert.equal(player.fakeVideo.loaded, 1);
});

test('reduced motion suppresses autoplay while preserving manual playback', async () => {
  const player = renderPlayer({ reducedMotion: true });
  player.effects.forEach(effect => effect());
  assert.equal(player.fakeVideo.playCalls, 0);
  const stage = player.tree.props.children;
  const tap = stage.props.children.find(element => element?.props?.className === 'reel-video-tap');
  tap.props.onClick();
  await Promise.resolve();
  assert.equal(player.fakeVideo.playCalls, 1);
});

test('playback refusal remains a play-button state, not a broken-video error', async () => {
  const player = renderPlayer();
  player.fakeVideo.play = () => Promise.reject(Object.assign(new Error('Blocked'), { name: 'NotAllowedError' }));
  player.effects.forEach(effect => effect());
  for (let i = 0; i < 8; i++) await Promise.resolve();
  assert(player.writes.some(write => write.slot === 0 && write.value === false));
  assert(player.writes.some(write => write.slot === 1 && write.value === false));
  assert(!player.writes.some(write => write.slot === 2 && write.value === true));
});
test('a late play promise cannot continue when the clip has left view', async () => {
  const player = renderPlayer();
  player.effects.forEach(effect => effect());
  player.refs[1].current = false;
  for (let i = 0; i < 4; i++) await Promise.resolve();
  assert.equal(player.fakeVideo.paused, true);
});
test('page hiding immediately pauses playback', () => {
  const player = renderPlayer(); player.effects.forEach(effect => effect());
  player.fakeVideo.paused = false;
  player.listeners.get('pagehide')();
  assert.equal(player.fakeVideo.paused, true);
});

test('a reduced-motion clip without a poster seeks a preview frame without playing', () => {
  const player = renderPlayer({ reducedMotion: true });
  Object.assign(player.fakeVideo, { readyState: 1, duration: 4, currentTime: 0 });
  const video = player.tree.props.children.props.children.find(element => element?.type === 'video');
  video.props.onLoadedMetadata({ currentTarget: player.fakeVideo });
  assert.equal(player.fakeVideo.currentTime, .01);
  assert.equal(player.fakeVideo.playCalls, 0);
  assert.equal(player.fakeVideo.paused, true);
});

test('a failed media request renews its link once, without retrying on a loop', async () => {
  let requests = 0;
  const player = renderPlayer({ onReload: async () => { requests++; return { videoUrl: 'https://media.example/refreshed.mp4' }; } });
  player.effects.forEach(effect => effect());
  const video = player.tree.props.children.props.children.find(element => element?.type === 'video');
  video.props.onError();
  for (let i = 0; i < 8; i++) await Promise.resolve();
  video.props.onError();
  assert.equal(requests, 1);
  assert(player.writes.some(write => write.slot === 5 && typeof write.value === 'function'));
});

test('a failed renewal stays retryable without a second play attempt', async () => {
  const player = renderPlayer({ onReload: async () => { throw new Error('Offline'); } });
  player.effects.forEach(effect => effect());
  player.tree.props.children.props.children.find(element => element?.type === 'video').props.onError();
  for (let i = 0; i < 8; i++) await Promise.resolve();
  assert.equal(player.fakeVideo.playCalls, 1);
  assert(player.writes.some(write => write.value === 'The video could not be refreshed. Check your connection and try again.'));
});

test('autoplay retries silently if the browser blocks sound', async () => {
  const player = renderPlayer();
  const attempted = [];
  player.fakeVideo.play = function () {
    attempted.push(this.muted);
    if (!this.muted) return Promise.reject(Object.assign(new Error('Blocked'), { name: 'NotAllowedError' }));
    this.paused = false;
    return Promise.resolve();
  };
  player.effects.forEach(effect => effect());
  for (let i = 0; i < 6; i++) await Promise.resolve();
  assert.deepEqual(attempted, [false, true]);
  assert.equal(player.fakeVideo.paused, false);
});

test('only the active clip and explicitly warmed next clip preload video data', () => {
  const media = player => player.tree.props.children.props.children.find(element => element?.type === 'video');
  assert.equal(media(renderPlayer()).props.preload, 'auto');
  const next = renderPlayer({ active: false, preloadNext: 'auto' });
  assert.equal(media(next).props.preload, 'auto');
  next.effects.forEach(effect => effect());
  assert.equal(next.fakeVideo.playCalls, 0);
  assert.equal(media(renderPlayer({ active: false, preloadNext: 'metadata' })).props.preload, 'metadata');
  assert.equal(media(renderPlayer({ active: false })).props.preload, 'none');
  assert.equal(media(renderPlayer({ active: false, nearby: false })), undefined);
});

test('the first tap after controls hide brings them back without pausing', () => {
  let reveals = 0;
  const player = renderPlayer({ chromeHidden: true, onReveal() { reveals++; } });
  player.effects.forEach(effect => effect());
  const tap = player.tree.props.children.props.children.find(element => element?.props?.className === 'reel-video-tap');
  assert.equal(tap.props['aria-label'], 'Show video controls');
  tap.props.onClick();
  assert.equal(reveals, 1);
  assert.equal(player.fakeVideo.paused, false);
});

test('a stalled active preview has a bounded wait instead of an endless blank player', () => {
  const player = renderPlayer();
  player.effects.forEach(effect => effect());
  assert.equal(player.timers.size, 1);
  [...player.timers.values()][0]();
  assert(player.writes.some(write => write.slot === 2 && write.value === true));
  assert(player.writes.some(write => typeof write.value === 'string' && write.value.includes('taking too long')));
  const offscreen = renderPlayer({ active: false });
  offscreen.effects.forEach(effect => effect());
  assert.equal(offscreen.timers.size, 0);
});
