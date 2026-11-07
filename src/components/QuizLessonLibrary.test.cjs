const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { buildSync } = require('esbuild');
const path = require('node:path');

const code = buildSync({ entryPoints: [path.join(__dirname, 'QuizLessonLibrary.jsx')], bundle: true,
  write: false, format: 'cjs', platform: 'node', jsx: 'automatic', external: ['react', 'react/jsx-runtime', 'lucide-react'] }).outputFiles[0].text;

function harness(initialView) {
  let slot = 0;
  const state = [], starts = [], views = [], scope = { exports: {} };
  const jsx = (type, props) => ({ type, props: props || {} });
  vm.runInNewContext(code, { module: scope, exports: scope.exports,
    require(name) {
      if (name === 'react') return { useState(value) { const index = slot++; if (!(index in state)) state[index] = value; return [state[index], next => { state[index] = typeof next === 'function' ? next(state[index]) : next; }]; },
        useMemo: fn => fn(), useRef: () => ({ current: null }), useEffect() {} };
      if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
      if (name === 'lucide-react') return new Proxy({}, { get: (_, key) => key });
      throw new Error(name);
    } });
  const subject = { id: 'science-mathematics', title: 'Science & Mathematics' };
  function render() { slot = 0; return scope.exports.default({ subject, progress: {}, initialView, onStart: (item, view) => { starts.push(item); views.push(view); }, onBack() {} }); }
  function find(node, predicate) {
    if (!node || typeof node !== 'object') return [];
    if (Array.isArray(node)) return node.flatMap(item => find(item, predicate));
    return [...(predicate(node) ? [node] : []), ...find(node.props?.children, predicate)];
  }
  const text = node => typeof node === 'string' ? node : typeof node === 'number' ? String(node) : Array.isArray(node) ? node.map(text).join('') : node?.props ? text(node.props.children) : '';
  return { starts, views, render, find, text };
}

test('a lesson has one quiz action that includes all its ideas and no topic picker', () => {
  const app = harness(); let tree = app.render();
  app.find(tree, node => node.type === 'input')[0].props.onChange({ target: { value: 'electric circuit' } });
  tree = app.render();
  const circuit = app.find(tree, node => node.props.className === 'quiz-lesson-card' && app.text(node).includes('Inside an electric circuit'))[0];
  assert.match(app.text(circuit), /Ohm’s law/);
  const actions = app.find(circuit, node => node.type === 'button');
  assert.equal(actions.length, 1);
  assert.match(actions[0].props['aria-label'], /Start quiz: Inside an electric circuit/);
  actions[0].props.onClick();
  assert.equal(app.starts.length, 1);
  assert.equal(app.starts[0].conceptId, '');
  assert.equal(app.starts[0].lessonId, 'circuits');
  assert.deepEqual(Array.from(app.starts[0].subjects), ['Ohm’s law', 'Series circuits', 'Parallel circuits']);
});

test('Science starts with three named lessons; Physics can launch as a whole lesson', () => {
  const app = harness(); let tree = app.render();
  const headings = app.find(tree, node => node.type === 'h2').map(app.text);
  assert.deepEqual(headings, ['Physics', 'Chemistry', 'Mathematics']);
  app.find(tree, node => node.props['aria-label'] === 'Start quiz: Physics')[0].props.onClick();
  assert.equal(app.starts[0].title, 'Physics');
  assert.equal(app.starts[0].id, 'science-mathematics--chapter-physics');
  assert.equal(app.starts[0].subjects.length, 5);
});

test('clearing an empty search restores the named lessons', () => {
  const app = harness(); let tree = app.render();
  app.find(tree, node => node.type === 'input')[0].props.onChange({ target: { value: 'nonexistent' } });
  tree = app.render();
  assert.equal(app.find(tree, node => node.props.className === 'quiz-lesson-card').length, 0);
  app.find(tree, node => node.type === 'button' && app.text(node) === 'Show all lessons')[0].props.onClick();
  tree = app.render();
  assert.equal(app.find(tree, node => node.props.className === 'quiz-lesson-card').length, 3);
});

test('Load more reveals concrete Science lessons without replacing the initial ones', () => {
  const app = harness();
  const tree = app.render();
  app.find(tree, node => node.type === 'button' && app.text(node).startsWith('Load more lessons'))[0].props.onClick();
  assert.deepEqual(app.find(app.render(), node => node.type === 'h2').map(app.text),
    ['Physics', 'Chemistry', 'Mathematics', 'Experimental Methods', 'Thermodynamics', 'Organic Chemistry', 'Linear Algebra']);
});

test('load more appends unique search matches and hides itself at the end', () => {
  const app = harness();
  const cards = tree => app.find(tree, node => node.props.className === 'quiz-lesson-card').map(app.text);
  const more = tree => app.find(tree, node => node.type === 'button' && app.text(node).startsWith('Load more lessons'))[0];
  app.find(app.render(), node => node.type === 'input')[0].props.onChange({ target: { value: 'a' } });
  const first = app.render();
  assert.equal(cards(first).length, 3);
  more(first).props.onClick();
  const second = app.render();
  assert.equal(cards(second).length, 7);
  assert.deepEqual(cards(second).slice(0, 3), cards(first));
  let last = second;
  while (more(last)) { more(last).props.onClick(); last = app.render(); }
  assert.equal(new Set(cards(last)).size, cards(last).length);
  assert.equal(more(last), undefined);
});

test('returning from focused practice restores the parent lesson', () => {
  const app = harness(); let tree = app.render();
  const physics = app.find(tree, node => node.props['data-lesson-id'] === 'chapter-physics')[0];
  app.find(physics, node => node.type === 'button' && app.text(node) === 'Focused practice')[0].props.onClick();
  tree = app.render();
  app.find(tree, node => node.type === 'button' && node.props['aria-label'] === 'Start quiz: Inside an electric circuit')[0].props.onClick();
  assert.equal(app.views[0].expandedLesson, 'chapter-physics');
  assert.equal(app.views[0].lessonId, 'circuits');
  const restored = harness(app.views[0]);
  assert.equal(restored.find(restored.render(), node => node.props['aria-label'] === 'Start quiz: Inside an electric circuit').length, 1);
  const filtered = harness({ query: 'circuit', limit: 6 });
  const lessons = filtered.find(filtered.render(), node => node.props.className === 'quiz-lesson-card');
  assert.equal(lessons.length, 1);
  assert.match(filtered.text(lessons[0]), /Inside an electric circuit/);
});
