const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const postcss = require('postcss');
const read = name => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');
const palette = postcss.parse(read('styles/premium-theme.css')).nodes.find(node => node.selector === ':root');
const token = name => palette.nodes.find(node => node.prop === name)?.value;
function luminance(hex) {
  const linear = hex.slice(1).match(/../g).map(value => parseInt(value, 16) / 255)
    .map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
  return linear[0] * .2126 + linear[1] * .7152 + linear[2] * .0722;
}
function contrast(a, b) { const values = [luminance(a), luminance(b)].sort((a,b) => b-a); return (values[0]+.05)/(values[1]+.05); }

test('near black and sky blue have distinct action, surface and text tokens', () => {
  assert.equal(token('--ui-bg'), '#06070a');
  assert.equal(token('--ui-primary'), '#79c9f3');
  assert.equal(token('--ui-primary-ink'), '#081b28');
  assert.notEqual(token('--ui-primary'), token('--ui-accent'), 'Links and primary buttons have distinct roles');
  assert.match(token('--ui-brand-finish'), /linear-gradient/);
  assert.notEqual(token('--ui-surface'), token('--ui-bg'));
});

test('reading, muted labels, links and primary buttons meet normal-text contrast', () => {
  for (const background of ['--ui-bg', '--ui-surface', '--ui-surface-raised']) {
    for (const foreground of ['--ui-text', '--ui-secondary', '--ui-muted', '--ui-faint', '--ui-accent']) {
      assert.ok(contrast(token(foreground), token(background)) >= 4.5, foreground + ' on ' + background);
    }
  }
  for (const background of ['--ui-primary', '--ui-primary-hover', '--ui-primary-pressed']) {
    assert.ok(contrast(token('--ui-primary-ink'), token(background)) >= 4.5, 'Action text on ' + background);
  }
  assert.ok(contrast(token('--ui-accent'), token('--ui-accent-soft')) >= 4.5);
  assert.ok(contrast(token('--ui-accent-strong'), token('--ui-surface-raised')) >= 7);
});

test('Day mode uses black ink on light surfaces and preserves its pine actions', () => {
  const dayPalette = postcss.parse(read('styles/day-theme.css')).nodes.find(node => node.selector === ":root[data-app-theme='day']");
  const day = name => dayPalette.nodes.find(node => node.prop === name)?.value;
  assert.equal(day('--ui-text'), '#000000');
  assert.equal(day('--ui-bg'), '#f4efe6');
  assert.equal(day('--ui-primary'), '#214d40');
  assert.equal(day('--ui-accent-soft'), '#e8e0f0');
  for (const surface of ['--ui-bg', '--ui-surface', '--ui-surface-raised', '--ui-accent-soft']) {
    for (const ink of ['--ui-text', '--ui-secondary', '--ui-label', '--ui-muted']) {
      assert.ok(contrast(day(ink), day(surface)) >= 7, ink + ' on ' + surface);
    }
  }
  const boot = fs.readFileSync(path.join(__dirname, '../../index.html'), 'utf8');
  assert.match(boot, /\.boot-loader \{ background: #f4efe6 !important; color: #000000; \}/);
});

test('finishing styles load after the shared and navigation styles without changing their geometry', () => {
  const main = read('main.jsx');
  assert.ok(main.indexOf("'./styles/cobalt-theme.css'") > main.indexOf("'./styles/navigation-toolbar.css'"));
  const css = read('styles/cobalt-theme.css');
  assert.doesNotMatch(css, /position:\s*fixed|z-index:|scroll-snap-type|touch-action:|scroll-behavior:/);
  assert.doesNotThrow(() => postcss.parse(css));
  assert.match(css, /not\(\.correct\):not\(\.wrong\)/, 'Game feedback must not become a generic blue selection');
  assert.doesNotMatch(css, /\.reader-theme-(?:light|sepia)\s*\{/);
});

test('brand and opening screens agree with the app palette before React starts', () => {
  const boot = fs.readFileSync(path.join(__dirname, '../../index.html'), 'utf8');
  assert.match(boot, /name="theme-color" content="#06070a"/);
  assert.match(boot, /\.boot-loader-orb[^}]+color: #081b28; background: linear-gradient\(150deg, #def5ff, #79c9f3/);
  const rail = read('styles/navigation-toolbar.css');
  assert.match(rail, /background: var\(--ui-primary\) !important; color: var\(--ui-primary-ink\)/);
  assert.match(read('components/FeedViewSwitch.css'), /background: var\(--ui-primary\)/);
  const navigation = read('components/NavigationPanel.css');
  assert.match(navigation, /\.navigation-dialog \.menu-panel \.login-pill \{ background: var\(--ui-primary\) !important; color: var\(--ui-primary-ink\)/);
  assert.match(navigation, /background: var\(--ui-surface\) !important/);
});

test('spacing remains responsive and touch targets remain usable', () => {
  assert.equal(token('--ui-gutter'), 'clamp(18px, 3vw, 48px)');
  const css = read('styles/cobalt-theme.css');
  assert.match(css, /@media \(max-width: 700px\)/);
  assert.match(css, /@media \(pointer: coarse\)/);
  assert.match(css, /min-height: 44px/);
  assert.doesNotMatch(css, /animation:[^;]+infinite|filter:\s*blur/);
});
