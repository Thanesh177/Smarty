const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { transformSync } = require('esbuild');

function harness({ reduced = false } = {}) {
  const refs = [], animations = [], scrolls = [];
  let location, slot = 0, effect;
  const target = { animate(frames, options) {
    const record = { frames, options, canceled: false };
    animations.push(record);
    return { cancel() { record.canceled = true; } };
  } };
  const content = { ...target, querySelector: () => target, scrollTo: options => scrolls.push(options) };
  const scope = { exports: {} };
  vm.runInNewContext(transformSync(fs.readFileSync(__dirname + '/PageTransition.jsx', 'utf8'), { loader: 'jsx', format: 'cjs' }).code, {
    module: scope, exports: scope.exports, URLSearchParams,
    document: { querySelector: () => content },
    window: { matchMedia: () => ({ matches: reduced }) },
    require(name) {
      if (name === 'react') return {
        useRef(value) { const index = slot++; return refs[index] ||= { current: value }; },
        useLayoutEffect(callback) { effect = callback; },
      };
      if (name === 'react-router-dom') return { useLocation: () => location };
      return require(name);
    },
  });
  return { animations, scrolls, render(path) {
    location = new URL(path, 'https://smarty.example'); slot = 0;
    scope.exports.default(); return effect();
  } };
}

test('view switches move in segment order without a blinking opacity drop', () => {
  const app = harness();
  app.render('/feed?topic=All');
  assert.equal(app.animations.length, 0);
  const cancel = app.render('/feed?topic=Video');
  assert.equal(app.animations[0].frames[0].transform, 'translateX(8px)');
  assert.equal(app.animations[0].frames[0].opacity, .96);
  assert.equal(app.animations[0].options.duration, 280);
  cancel();
  assert(app.animations[0].canceled);
  app.render('/learn');
  assert.equal(app.animations[1].frames[0].transform, 'translateX(-8px)');
  assert.equal(app.scrolls.length, 2);
});

test('filters inside a view do not restart its transition', () => {
  const app = harness();
  app.render('/learn');
  app.render('/learn?topic=Physics');
  assert.equal(app.animations.length, 0);
  assert.equal(app.scrolls.length, 0);
});

test('reduced motion still resets the new view scroll but never animates', () => {
  const app = harness({ reduced: true });
  app.render('/feed?topic=News');
  app.render('/saved');
  assert.equal(app.animations.length, 0);
  assert.equal(app.scrolls.length, 1);
  assert.equal(app.scrolls[0].top, 0);
});
