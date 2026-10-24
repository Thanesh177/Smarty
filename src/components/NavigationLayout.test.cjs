const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const postcss = require('postcss');

const css = postcss.parse(fs.readFileSync(path.join(__dirname, '../styles/navigation-toolbar.css'), 'utf8'));
const topLevel = css.nodes.filter(node => node.type === 'rule');
const rule = selector => topLevel.find(node => node.selector === selector);
const declaration = (node, property) => node.nodes.find(item => item.type === 'decl' && item.prop === property);

test('one fixed rail floats above an isolated full-width content layer', () => {
  const rail = rule('body .app-shell > .topbar.glass-topbar');
  assert.equal(declaration(rail, 'position').value, 'fixed');
  assert.equal(declaration(rail, 'position').important, true);
  assert.equal(declaration(rail, 'z-index').value, 'var(--app-rail-layer, 32000)');
  assert.equal(declaration(rail, 'contain').value, 'none');
  assert.equal(declaration(rail, 'transform').value, 'none');
  const content = rule('body .app-shell > .content');
  assert.equal(declaration(content, 'width').value, '100%');
  assert.equal(declaration(content, 'max-width').value, 'none');
  assert.equal(declaration(content, 'isolation').value, 'isolate');
  assert.equal(declaration(content, 'z-index').value, '0');
});

test('rail geometry has one shared safe-area-aware definition', () => {
  const tokens = rule('body .app-shell.has-overlay-navigation');
  assert.equal(declaration(tokens, '--app-rail-width').value, '56px');
  assert.equal(declaration(tokens, '--app-rail-layer').value, '32000');
  assert.match(declaration(tokens, '--app-rail-right').value, /safe-area-inset-right/);
  assert.match(declaration(tokens, '--app-rail-bottom').value, /safe-area-inset-bottom/);
});

test('reading and collection containers do not reserve a right-hand lane', () => {
  const reset = topLevel.find(node => node.selector.includes('.single-post-heading'));
  for (const selector of ['.single-post-layout', '.single-post-reading', '.single-post-discussion',
    '.public-profile-header', '.public-profile-tabs', '.public-profile-collection',
    '.saved-page .saved-topic', '.saved-page .saved-title-btn', '.saved-page .saved-card-body > p',
    '.post-editor .composer-details', '.creator-dashboard-page .community-toolbar', '.chat-page .chat-list']) {
    assert.ok(reset.selector.includes(selector), selector);
  }
  assert.ok(reset.selector.startsWith('body .app-shell.has-overlay-navigation > .content'));
  assert.equal(declaration(reset, 'padding-right').value, '0');
  assert.equal(declaration(reset, 'padding-right').important, true);
  // Do not remove local space protecting destructive/send actions from the rail.
  assert.ok(!reset.selector.includes('.saved-card-actions'));
  assert.ok(!reset.selector.includes('.post-ai-form'));
  assert.ok(!reset.selector.includes('.composer-publish-area'));
});

test('last reading/list items can scroll clear of the floating rail', () => {
  const clearance = topLevel.find(node => declaration(node, 'padding-bottom')?.value === 'var(--app-rail-scroll-room)');
  assert.ok(clearance.selector.includes('.single-post-page'));
  assert.ok(clearance.selector.includes('.saved-page.community-workspace'));
  assert.ok(clearance.selector.includes('.chat-page .chat-list'));
  assert.equal(declaration(clearance, 'padding-bottom').important, true);
});

test('active conversations still use their own controls instead of the app rail', () => {
  const conversations = rule('body .app-shell:has(.chat-page.has-active-chat, .rooms-page.has-active-room) > .topbar.glass-topbar');
  assert.equal(declaration(conversations, 'display').value, 'none');
  assert.equal(declaration(conversations, 'display').important, true);
});
