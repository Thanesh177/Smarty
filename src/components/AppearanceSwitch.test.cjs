const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { transformSync } = require('esbuild');

function render(theme, props) {
  let saved;
  const compiled = transformSync(fs.readFileSync(__dirname + '/AppearanceSwitch.jsx', 'utf8'), { loader: 'jsx', jsx: 'automatic', format: 'cjs' }).code;
  const module = { exports: {} };
  vm.runInNewContext(compiled, { module, exports: module.exports, require: name => {
    if (name === '../contexts/AppearanceContext') return { useAppearance: () => ({ theme, setTheme: next => { saved = next; } }) };
    return require(name);
  } });
  return { tree: module.exports.default(props), get saved() { return saved; } };
}

test('one-tap controls switch to the opposite theme with an accessible action label', () => {
  for (const [theme, next, name] of [['dark', 'day', 'day'], ['day', 'dark', 'night']]) {
    const result = render(theme, { compact: true, rail: true });
    assert.equal(result.tree.props.type, 'button');
    assert.equal(result.tree.props['aria-label'], `Switch to ${name} mode`);
    assert.match(result.tree.props.className, /quick-icon-link/);
    result.tree.props.onClick();
    assert.equal(result.saved, next);
    assert.equal(result.tree.props.children[1].props['aria-hidden'], 'true');
  }
});

test('compact auth controls do not inherit navigation rail geometry or tooltips', () => {
  const result = render('day', { compact: true });
  assert.equal(result.tree.props.className, 'appearance-quick-toggle');
  assert.equal(result.tree.props.children[1], false);
});

test('the menu retains explicit day/night choices and their selected state', () => {
  const result = render('day', {});
  const group = result.tree.props.children[1];
  assert.equal(group.props['aria-label'], 'Appearance');
  assert.equal(group.props.children[0].props['aria-pressed'], true);
  assert.equal(group.props.children[1].props['aria-pressed'], false);
  group.props.children[1].props.onClick();
  assert.equal(result.saved, 'dark');
});
