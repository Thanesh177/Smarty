const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { transformSync } = require('esbuild');

function renderPlayer(overrides = {}) {
  const effects = [], writes = [];
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
    useRef: () => ({ current: fakeVideo }),
    useState: initial => { const slot = index++; return [initial, value => writes.push({ slot, value })]; },
    useEffect: callback => effects.push(callback),
  };
  const compiled = transformSync(fs.readFileSync(__dirname + '/ReelVideo.jsx', 'utf8'), {
    loader: 'jsx', jsx: 'automatic', format: 'cjs',
  }).code;
  const scope = { exports: {} };
  vm.runInNewContext(compiled, {
    module: scope, exports: scope.exports, queueMicrotask, URL,
    require: name => name === 'react' ? hookReact : name === '../lib/videoFeed' ? require('../lib/videoFeed.js') : require(name),
  });
  const tree = scope.exports.default({
    post: { id: 'video-one', videoUrl: 'https://media.example/one.mp4', title: 'One specific idea' },
    active: true, nearby: true, muted: true, reducedMotion: false,
    onMute() {}, onSave() {}, onSafety() {}, ...overrides,
  });
  return { tree, fakeVideo, effects, writes };
}

test('only the active player attempts muted playback', async () => {
  const active = renderPlayer();
  active.effects.forEach(effect => effect());
  await Promise.resolve();
  assert.equal(active.fakeVideo.playCalls, 1);
  assert.equal(active.fakeVideo.muted, true);
  const offscreen = renderPlayer({ active: false });
  offscreen.effects.forEach(effect => effect());
  assert.equal(offscreen.fakeVideo.playCalls, 0);
  assert.equal(offscreen.fakeVideo.paused, true);
});

test('effect rehearsal does not strip the connected player source or stop its next play attempt', async () => {
  const player = renderPlayer();
  const cleanup = player.effects.map(effect => effect());
  cleanup.forEach(dispose => dispose?.());
  player.effects.forEach(effect => effect());
  await Promise.resolve();
  assert.equal(player.fakeVideo.released, 0);
  assert.equal(player.fakeVideo.loaded, 0);
  assert.equal(player.fakeVideo.paused, false);
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

test('autoplay refusal becomes a manual-play state, not a video failure', async () => {
  const player = renderPlayer();
  player.fakeVideo.play = () => Promise.reject(new Error('NotAllowedError'));
  player.effects.forEach(effect => effect());
  await Promise.resolve();
  assert(player.writes.some(write => write.slot === 0 && write.value === false));
  assert(player.writes.some(write => write.slot === 2 && write.value === false));
  assert(!player.writes.some(write => write.slot === 3 && write.value === true));
});
