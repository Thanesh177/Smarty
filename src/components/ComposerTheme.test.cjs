const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const postcss = require('postcss');
const read = name => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');
const css = postcss.parse(read('pages/CreatePostComposer.css'));
function value(selector, prop) {
  return css.nodes.find(node => node.selector === selector)?.nodes.find(node => node.prop === prop)?.value;
}

test('Add post and Edit post share theme-aware writing surfaces and topic menus', () => {
  for (const page of ['CreatePostPage', 'EditPostPage']) assert.match(read(`pages/${page}.jsx`), /import '\.\/CreatePostComposer.css'/);
  for (const selector of ['.composer-paper', '.composer-topic-menu']) assert.equal(value(selector, 'background'), 'var(--ui-surface)');
  assert.equal(value('.composer-topic-menu', 'box-shadow'), 'var(--ui-shadow-float)');
  assert.equal(value('.composer-attach-icon', 'background'), 'var(--ui-accent-soft)');
  assert.equal(value(".post-composer .composer-view-switch button[aria-pressed='true']", 'background'), 'var(--ui-accent-soft)');
  assert.equal(value(".post-composer .composer-view-switch button[aria-pressed='true']", 'color'), 'var(--ui-accent-strong)');
  assert.equal(value('.post-composer textarea::placeholder', 'color'), 'var(--ui-faint)');
});

test('publish buttons use a matching readable ink, including the disabled state', () => {
  const selector = '.app-shell .content .post-composer .composer-primary';
  assert.equal(value(selector, 'background'), 'var(--ui-primary)');
  assert.equal(value(selector, 'color'), 'var(--ui-primary-ink)');
  assert.equal(value(selector + ':disabled', 'opacity'), '1');
  for (const prop of ['opacity', 'background', 'color', 'border-color']) {
    assert.equal(css.nodes.find(node => node.selector === selector + ':disabled').nodes.find(node => node.prop === prop).important, true, `Override legacy submit-button ${prop}`);
  }
  assert.equal(value(selector + ':disabled', 'background'), 'var(--ui-surface-raised)');
  assert.equal(value(selector + ':disabled', 'color'), 'var(--ui-muted)');
});

test('writing controls keep visible focus, legible hints and dark media backing', () => {
  assert.equal(value('.composer-topic-input:focus-within', 'outline'), '2px solid var(--ui-accent)');
  assert.equal(value('.post-composer :is(button, a, input, textarea, summary):focus-visible', 'outline'), '2px solid var(--ui-accent)');
  for (const selector of ['.composer-file-hint', '.composer-label-row', '.composer-writing-foot', '.composer-device-note']) assert.equal(value(selector, 'font-size'), '12px');
  assert.equal(value('.composer-attachment-preview :is(img, video), .composer-preview :is(img, video)', 'background'), '#08090a');
  assert.ok(css.nodes.some(node => node.params === '(max-width: 800px)'));
  assert.ok(css.nodes.some(node => node.params === '(prefers-reduced-motion: reduce)'));
});
