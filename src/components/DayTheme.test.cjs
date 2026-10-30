const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const postcss = require('postcss');
const read = name => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');
const css = read('styles/day-theme.css');
const palette = postcss.parse(css).nodes.find(node => node.selector === ":root[data-app-theme='day']");
const token = name => palette.nodes.find(node => node.prop === name)?.value;
function luminance(hex) {
  const values = hex.slice(1).match(/../g).map(x => parseInt(x, 16) / 255).map(x => x <= .04045 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4);
  return .2126 * values[0] + .7152 * values[1] + .0722 * values[2];
}
function contrast(a, b) { const [high, low] = [luminance(a), luminance(b)].sort((a, b) => b - a); return (high + .05) / (low + .05); }

test('the day palette uses oatmeal, pine and lilac with readable text', () => {
  assert.equal(token('--ui-bg'), '#f4efe6'); assert.equal(token('--ui-primary'), '#214d40'); assert.equal(token('--ui-accent-soft'), '#e8e0f0');
  for (const background of ['--ui-bg', '--ui-surface', '--ui-surface-raised', '--ui-control-bg']) {
    for (const foreground of ['--ui-text', '--ui-secondary', '--ui-muted', '--ui-faint', '--ui-accent']) {
      assert.ok(contrast(token(foreground), token(background)) >= 4.5, `${foreground} on ${background}`);
    }
  }
  for (const background of ['--ui-primary', '--ui-primary-hover', '--ui-primary-pressed']) assert.ok(contrast(token('--ui-primary-ink'), token(background)) >= 4.5);
  assert.ok(contrast(token('--ui-accent-strong'), token('--ui-accent-soft')) >= 4.5);
  assert.ok(contrast(token('--ui-danger'), token('--ui-danger-soft')) >= 4.5);
  assert.ok(contrast(token('--ui-success'), token('--ui-success-soft')) >= 4.5);
});

test('one appearance provider serves all routes and syncs device changes without touching accounts', () => {
  const main = read('main.jsx');
  assert.match(main, /<AppearanceProvider>\s*<App \/>\s*<\/AppearanceProvider>/);
  assert.ok(main.indexOf("'./styles/day-theme.css'") > main.indexOf("'./styles/cobalt-theme.css'"));
  const provider = read('contexts/AppearanceContext.jsx');
  assert.match(provider, /addEventListener\('storage', sync\)/); assert.match(provider, /removeEventListener\('storage', sync\)/);
  assert.doesNotMatch(provider, /logout|signOut|location\.reload|fetch\(/);
});

test('the switch is accessible and available before and after sign-in', () => {
  const component = read('components/AppearanceSwitch.jsx');
  assert.match(component, /role="group" aria-label="Appearance"/); assert.match(component, /aria-pressed=\{theme === 'day'\}/);
  assert.match(component, /aria-label=\{label\}/);
  for (const file of ['components/NavbarMenu.jsx', 'pages/LoginPage.jsx', 'pages/RegisterPage.jsx', 'components/landing/SmartyLanding.jsx']) assert.match(read(file), /<AppearanceSwitch/);
  assert.match(css, /@media \(pointer: coarse\)[^}]+min-height: 44px/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
});

test('appearance stays out of the rail and remains available in Settings and video chrome', () => {
  assert.doesNotMatch(read('App.jsx'), /<AppearanceSwitch/);
  assert.match(read('components/AppearanceSwitch.jsx'), /quick-icon-link appearance-rail-toggle/);
  assert.match(read('components/AppearanceSwitch.jsx'), /className="nav-control-label" aria-hidden="true"/);
  assert.match(read('components/FeedViewSwitch.jsx'), /active === 'video' && <AppearanceSwitch compact\s*\/>/);
  assert.match(css, /\.appearance-quick-toggle[^}]+width: 44px[^}]+height: 44px/);
  assert.match(read('components/FeedViewSwitch.css'), /grid-template-columns: auto minmax\(0, 1fr\) auto/);
});

test('day mode keeps media and reader preferences independent and does not add scrolling or layout locks', () => {
  assert.doesNotThrow(() => postcss.parse(css));
  assert.match(css, /:is\(\.reader-theme-dark, \.reader-theme-sepia, \.video-topic-page\)/);
  assert.doesNotMatch(css, /\.reader-theme-(?:light|sepia)\s*\{/);
  assert.match(css, /\.option-btn\.correct/); assert.match(css, /\.option-btn\.wrong/);
  assert.doesNotMatch(css, /filter:\s*invert|position:\s*fixed|scroll-snap-type|touch-action:\s*none|transition:\s*all/);
});

test('legacy quiz captions and search arrows use readable day-mode text', () => {
  const rules = postcss.parse(css).nodes.filter(node => node.type === 'rule');
  for (const selector of ['.quiz-masthead > span', '.universal-search-quick-grid button > svg:last-child']) {
    const rule = rules.find(node => node.selector.includes(selector));
    assert.ok(rule, selector);
    assert.ok(rule.nodes.some(node => node.prop === 'color' && node.value === 'var(--ui-muted)'));
  }
});
