import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { APP_THEME_KEY, normalizeAppTheme, readAppTheme, saveAppTheme, applyAppTheme } from './appTheme.js';

function documentFixture() {
  const attributes = new Map();
  const metas = new Map(['theme-color', 'color-scheme'].map(name => [name, { setAttribute: (key, value) => attributes.set(name + ':' + key, value) }]));
  return { attributes, documentElement: { style: {}, setAttribute: (key, value) => attributes.set(key, value), getAttribute: key => attributes.get(key) },
    querySelector: selector => metas.get(selector.match(/name="([^"]+)"/)?.[1]) };
}

test('appearance accepts only supported modes and preserves dark as the default', () => {
  assert.equal(normalizeAppTheme('day'), 'day');
  for (const value of [null, undefined, 'light', 'system', '<script>', {}, 'DARK']) assert.equal(normalizeAppTheme(value), 'dark');
});

test('the appearance choice survives a fresh read without changing other stored preferences', t => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const values = new Map([['unrelated-setting', 'keep']]);
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) } });
  t.after(() => previous ? Object.defineProperty(globalThis, 'localStorage', previous) : delete globalThis.localStorage);
  assert.equal(readAppTheme(), 'dark');
  assert.equal(saveAppTheme('day'), 'day');
  assert.equal(values.get(APP_THEME_KEY), 'day');
  assert.equal(readAppTheme(), 'day');
  assert.equal(values.get('unrelated-setting'), 'keep');
  saveAppTheme('dark'); assert.equal(readAppTheme(), 'dark');
});

test('blocked device storage does not break the switch or page rendering', t => {
  const previousStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const previousDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const doc = documentFixture(); doc.documentElement.setAttribute('data-app-theme', 'day');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw Error('Storage unavailable'); } });
  Object.defineProperty(globalThis, 'document', { configurable: true, value: doc });
  t.after(() => {
    previousStorage ? Object.defineProperty(globalThis, 'localStorage', previousStorage) : delete globalThis.localStorage;
    previousDocument ? Object.defineProperty(globalThis, 'document', previousDocument) : delete globalThis.document;
  });
  assert.equal(readAppTheme(), 'day');
  assert.equal(saveAppTheme('day'), 'day');
  assert.equal(applyAppTheme('dark'), 'dark');
  assert.equal(doc.attributes.get('data-app-theme'), 'dark');
});

test('switching appearance updates native browser chrome and form color scheme', () => {
  const doc = documentFixture();
  applyAppTheme('day', doc);
  assert.equal(doc.attributes.get('data-app-theme'), 'day');
  assert.equal(doc.attributes.get('theme-color:content'), '#f4efe6');
  assert.equal(doc.attributes.get('color-scheme:content'), 'light');
  assert.equal(doc.documentElement.style.backgroundColor, '#f4efe6');
  assert.equal(doc.documentElement.style.colorScheme, 'light');
  applyAppTheme('dark', doc);
  assert.equal(doc.attributes.get('theme-color:content'), '#06070a');
  assert.equal(doc.documentElement.style.colorScheme, 'dark');
  assert.equal(applyAppTheme('day', null), 'day');
});

test('the first paint restores day mode before the app, including when storage is blocked', () => {
  const script = fs.readFileSync(new URL('../../public/appearance.js', import.meta.url), 'utf8');
  for (const value of ['day', 'dark', null, 'invalid', 'blocked']) {
    const doc = documentFixture();
    vm.runInNewContext(script, { document: doc, localStorage: { getItem: key => { assert.equal(key, APP_THEME_KEY); if (value === 'blocked') throw Error('Unavailable'); return value; } } });
    assert.equal(doc.attributes.get('data-app-theme'), value === 'day' ? 'day' : 'dark');
    assert.equal(doc.documentElement.style.backgroundColor, value === 'day' ? '#f4efe6' : '#06070a');
  }
  const html = fs.readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
  assert.ok(html.indexOf('src="/appearance.js"') < html.indexOf('<body'));
  assert.match(html, /html\[data-app-theme='day'\] \.boot-loader-orb \{ background: #214d40/);
  assert.doesNotMatch(script, /fetch\(|cookie|removeItem|clear\(/);
});
