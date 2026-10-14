import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isAuthenticationPath, safeAuthDestination, saveAuthDestination, readAuthDestination, clearAuthDestination } from './authNavigation.js';

test('authentication navigation stays absent on sign-in, registration and verification aliases', () => {
  for (const value of ['/login', '/login/', '/LOGIN', '/register', '/confirm/']) assert.equal(isAuthenticationPath(value), true);
  for (const value of ['/news', '/news/story', '/feed', '/profile', '/login-not-a-route']) assert.equal(isAuthenticationPath(value), false);
});

test('auth return paths preserve an internal page and reject external or replay destinations', () => {
  assert.equal(safeAuthDestination({ pathname: '/rooms', search: '?id=42', hash: '#chat' }), '/rooms?id=42#chat');
  for (const value of ['https://evil.invalid', '//evil.invalid', '/\\evil.invalid', '/login', '/login?google=1', '/register/', '/confirm', '/feed?code=used&state=old', '/\n/evil.invalid']) {
    assert.equal(safeAuthDestination(value), '/feed', value);
  }
});

test('non-essential redirect storage failures cannot block login or navigation', () => {
  const blocked = { getItem() { throw Error('blocked'); }, setItem() { throw Error('blocked'); }, removeItem() { throw Error('blocked'); } };
  globalThis.localStorage = blocked;
  globalThis.sessionStorage = blocked;
  try {
    assert.equal(saveAuthDestination('/rooms'), '/rooms');
    assert.equal(readAuthDestination(), '/feed');
    assert.doesNotThrow(clearAuthDestination);
  } finally { delete globalThis.localStorage; delete globalThis.sessionStorage; }
});

test('social return paths are sanitized when read from storage', () => {
  const values = new Map();
  globalThis.sessionStorage = { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
  try {
    saveAuthDestination('/feed?topic=News');
    assert.equal(readAuthDestination(), '/feed?topic=News');
    values.set('smarty-post-login-redirect', '//evil.invalid');
    assert.equal(readAuthDestination(), '/feed');
    clearAuthDestination();
    assert.equal(values.size, 0);
  } finally { delete globalThis.sessionStorage; }
});
