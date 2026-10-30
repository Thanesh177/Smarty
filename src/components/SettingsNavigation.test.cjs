const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
test('Settings owns appearance, offline library and account destinations, preserving admin visibility', () => {
  const menu = read('components/NavbarMenu.jsx');
  const settings = menu.slice(menu.indexOf('{settingsOpen && <section'));
  for (const value of ['<AppearanceSwitch', 'Offline library', 'to="/saved"', 'to="/notifications"', 'isAdminUser(user)', 'to="/admin"']) assert.ok(settings.includes(value), value);
  assert.match(settings, /smartyNative\.postMessage\(\{ action: 'nativeScreen', screen: 'downloads' \}\)/);
  assert.match(menu, /setSettingsOpen\(false\)/);
  assert.doesNotMatch(read('App.jsx'), /<AppearanceSwitch/);
});
test('day-mode legacy conversation and lesson palettes follow readable app tokens', () => {
  const css = read('styles/day-theme.css');
  for (const value of ['--chat-ink: var(--ui-text)', '--chat-muted: var(--ui-muted)', '--post-ai-ink: var(--ui-text)', '.message.mine', '.msg p', '.room-privacy-toggle button.active', '.post-ai-lesson-opening', '.post-ai-form textarea']) assert.ok(css.includes(value), value);
  assert.match(css, /\.message:has\(\.message-media-preview, \.audio-mini-card\) \{ background: transparent !important/);
});
