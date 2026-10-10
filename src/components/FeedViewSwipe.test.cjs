const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { transformSync } = require('esbuild');

function harness({ reduced = false } = {}) {
  const listeners = () => ({
    events: new Map(),
    addEventListener(name, fn) { this.events.set(name, fn); },
    removeEventListener(name, fn) { if (this.events.get(name) === fn) this.events.delete(name); },
  });
  const route = { style: { removeProperty(name) { delete this[name === 'will-change' ? 'willChange' : name]; } },
    animations: [], animate(frames) { this.animations.push(frames); } };
  const content = { ...listeners(), querySelector: () => route }, toggle = listeners(), document = listeners();
  document.querySelector = selector => selector.includes('app-shell') ? content : toggle;
  let effect, location = { pathname: '/feed', search: '?topic=All' }, time = 0, frame = 0, slot = 0;
  const refs = [], frames = new Map(), navigations = [], scope = { exports: {} };
  const swipeScope = { exports: {} };
  vm.runInNewContext(transformSync(fs.readFileSync(__dirname + '/../lib/feedSwipe.js', 'utf8'), { format: 'cjs' }).code,
    { module: swipeScope, exports: swipeScope.exports, require: () => ({ FEED_VIEWS: [
      { id: 'all', to: '/feed?topic=All' }, { id: 'news', to: '/feed?topic=News' },
      { id: 'video', to: '/feed?topic=Video' }, { id: 'saved', to: '/saved' },
    ] }) });
  vm.runInNewContext(transformSync(fs.readFileSync(__dirname + '/FeedViewSwipe.jsx', 'utf8'), { format: 'cjs', loader: 'jsx' }).code, {
    module: scope, exports: scope.exports, document,
    window: { innerWidth: 390, matchMedia: () => ({ matches: reduced }) },
    performance: { now: () => time },
    requestAnimationFrame(fn) { frames.set(++frame, fn); return frame; },
    cancelAnimationFrame(id) { frames.delete(id); },
    require(name) {
      if (name === 'react') return { useEffect(fn) { effect = fn; }, useRef(value) { return refs[slot++] ||= { current: value }; } };
      if (name === 'react-router-dom') return { useLocation: () => location, useNavigate: () => path => navigations.push(path) };
      if (name.includes('feedViews')) return { getFeedView: value => value.pathname === '/saved' ? 'saved' : ({ All: 'all', News: 'news', Video: 'video' }[new URLSearchParams(value.search).get('topic')] || null) };
      if (name.includes('feedSwipe')) return { swipeDestination: swipeScope.exports.swipeDestination, swipeTargetAllowed: target => target.allowed !== false };
      throw new Error(name);
    }, URLSearchParams,
  });
  function emit(type, { x = 180, y = 300, touches = 1, allowed = true, surface = content } = {}) {
    const event = { target: { allowed }, cancelable: true, touches: Array.from({ length: touches }, () => ({ clientX: x, clientY: y })),
      changedTouches: [{ clientX: x, clientY: y }], prevented: false, stopped: false,
      preventDefault() { this.prevented = true; }, stopPropagation() { this.stopped = true; } };
    surface.events.get(type)?.(event); return event;
  }
  return { route, content, toggle, document, navigations, emit,
    render(path = '/feed?topic=All') { const url = new URL(path, 'https://smarty.example'); location = { pathname: url.pathname, search: url.search }; slot = 0; scope.exports.default(); return effect(); },
    flush() { const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach(fn => fn()); },
    advance(ms) { time += ms; },
  };
}

test('swipe follows the finger, changes one route, suppresses ghost clicks and cleans up', () => {
  const app = harness(), cleanup = app.render();
  app.emit('touchstart');
  assert(app.emit('touchmove', { x: 90, y: 304 }).prevented);
  app.flush(); assert.equal(app.route.style.transform, 'translateX(-58.5px)');
  app.emit('touchend', { x: 90, y: 304, touches: 0 });
  assert.deepEqual(app.navigations, ['/feed?topic=News']);
  assert.equal(app.route.style.transform, undefined);
  cleanup(); app.render('/feed?topic=News');
  assert(app.emit('click', { surface: app.document }).prevented);
  app.advance(501); assert.equal(app.emit('click', { surface: app.document }).prevented, false);
});

test('vertical scrolling, controls, back edges and multiple fingers do not navigate', () => {
  const app = harness(), cleanup = app.render();
  for (const start of [{ allowed: false }, { x: 30 }, { x: 380 }, { touches: 2 }]) {
    app.emit('touchstart', start); app.emit('touchmove', { x: 80 }); app.emit('touchend', { x: 80, touches: 0 });
  }
  app.emit('touchstart'); app.emit('touchmove', { x: 170, y: 360 }); app.emit('touchend', { x: 80, y: 420, touches: 0 });
  app.emit('touchstart'); app.emit('touchmove', { x: 120 }); app.emit('touchmove', { x: 80, touches: 2 }); app.emit('touchend', { x: 80, touches: 0 });
  assert.equal(app.navigations.length, 0); cleanup();
  assert.equal(app.content.events.size, 0); assert.equal(app.toggle.events.size, 0); assert.equal(app.document.events.size, 0);
});

test('short and canceled swipes settle back; reduced motion never drags the screen', () => {
  const app = harness(); app.render(); app.emit('touchstart'); app.emit('touchmove', { x: 150 }); app.flush();
  app.emit('touchcancel'); assert.equal(app.route.style.transform, undefined); assert.equal(app.route.animations.length, 1);
  const quiet = harness({ reduced: true }); quiet.render(); quiet.emit('touchstart'); quiet.emit('touchmove', { x: 90 }); quiet.flush();
  assert.equal(quiet.route.style.transform, undefined); quiet.emit('touchend', { x: 90, touches: 0 });
  assert.deepEqual(quiet.navigations, ['/feed?topic=News']);
});
