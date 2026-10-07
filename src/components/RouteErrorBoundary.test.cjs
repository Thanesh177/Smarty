const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { transformSync } = require('esbuild');

const compiled = transformSync(fs.readFileSync(__dirname + '/RouteErrorBoundary.jsx', 'utf8'), {
  loader: 'jsx', jsx: 'automatic', format: 'cjs',
}).code;
const moduleScope = { exports: {} };
vm.runInNewContext(compiled, {
  module: moduleScope, exports: moduleScope.exports, console,
  require: name => name.endsWith('.css') ? {} : require(name),
});
const Boundary = moduleScope.exports.default;
function boundary(props) {
  const instance = new Boundary(props);
  instance.setState = update => { instance.state = { ...instance.state, ...(typeof update === 'function' ? update(instance.state) : update) }; };
  return instance;
}

test('ordinary app updates cannot repeatedly restart a broken page', () => {
  const instance = boundary({ resetKey: '/feed?topic=AI', children: 'page' });
  instance.state.hasError = true;
  instance.props = { resetKey: '/feed?topic=AI', children: 'new render of same page' };
  instance.componentDidUpdate({ resetKey: '/feed?topic=AI', children: 'page' });
  assert.equal(instance.state.hasError, true);
  assert.equal(instance.state.attempt, 0);
});

test('navigating to a different topic releases the error screen once', () => {
  const instance = boundary({ resetKey: '/feed?topic=Physics' });
  instance.state.hasError = true;
  instance.componentDidUpdate({ resetKey: '/feed?topic=AI' });
  assert.equal(instance.state.hasError, false);
  assert.equal(instance.state.attempt, 1);
});

test('retry remounts only the failed page without reloading the app', () => {
  const instance = boundary({ resetKey: '/booksinfo', children: 'page' });
  instance.state.hasError = true;
  const error = instance.render();
  assert.equal(error.props.role, 'alert');
  const actions = error.props.children.at(-1);
  actions.props.children[0].props.onClick();
  assert.equal(instance.state.hasError, false);
  assert.equal(instance.state.attempt, 1);
  const recovered = instance.render();
  assert.equal(recovered.props.children, 'page');
  assert.equal(recovered.key, '1');
});
