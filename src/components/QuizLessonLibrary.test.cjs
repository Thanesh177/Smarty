const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { buildSync } = require('esbuild');
const path = require('node:path');

const code = buildSync({ entryPoints: [path.join(__dirname, 'QuizLessonLibrary.jsx')], bundle: true,
  write: false, format: 'cjs', platform: 'node', jsx: 'automatic', external: ['react', 'react/jsx-runtime', 'lucide-react'] }).outputFiles[0].text;

function harness() {
  let slot = 0;
  const state = [], starts = [], scope = { exports: {} };
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
  function render() { slot = 0; return scope.exports.default({ subject, progress: {}, onStart: item => starts.push(item), onBack() {} }); }
  function find(node, predicate) {
    if (!node || typeof node !== 'object') return [];
    if (Array.isArray(node)) return node.flatMap(item => find(item, predicate));
    return [...(predicate(node) ? [node] : []), ...find(node.props?.children, predicate)];
  }
  const text = node => typeof node === 'string' ? node : typeof node === 'number' ? String(node) : Array.isArray(node) ? node.map(text).join('') : node?.props ? text(node.props.children) : '';
  return { starts, render, find, text };
}

test('opening a lesson reveals its topics without starting a quiz; choosing a topic starts a narrow quiz', () => {
  const app = harness(); let tree = app.render();
  const circuit = app.find(tree, node => node.props.className === 'quiz-lesson-card' && app.text(node).includes('Inside an electric circuit'))[0];
  const open = app.find(circuit, node => node.type === 'button' && app.text(node).startsWith('Open lesson'))[0];
  assert.equal(open.props['aria-expanded'], false); open.props.onClick();
  assert.equal(app.starts.length, 0);
  tree = app.render();
  const ohm = app.find(tree, node => node.type === 'button' && app.text(node).startsWith('Ohm’s law'))[0];
  assert.ok(ohm); ohm.props.onClick();
  assert.equal(app.starts.length, 1);
  assert.equal(app.starts[0].conceptId, 'ohm-s-law');
  assert.equal(app.starts[0].lessonId, 'circuits');
  assert.equal(app.starts[0].subjects.length, 1);
});

test('branch and lesson search filters compose; clearing an empty state restores the book', () => {
  const app = harness(); let tree = app.render();
  app.find(tree, node => node.type === 'button' && app.text(node) === 'Physics')[0].props.onClick();
  tree = app.render();
  assert.equal(app.find(tree, node => node.props.className === 'quiz-lesson-card').length, 4);
  app.find(tree, node => node.type === 'input')[0].props.onChange({ target: { value: 'nonexistent' } });
  tree = app.render();
  assert.equal(app.find(tree, node => node.props.className === 'quiz-lesson-card').length, 0);
  app.find(tree, node => node.type === 'button' && app.text(node) === 'Show all lessons')[0].props.onClick();
  tree = app.render();
  assert.equal(app.find(tree, node => node.props.className === 'quiz-lesson-card').length, 14);
});
