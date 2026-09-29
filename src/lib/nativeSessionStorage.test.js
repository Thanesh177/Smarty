import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createNativeSessionStorage, isSessionKey } from './nativeSessionStorage.js';

// Fresh Storage prototypes represent a destroyed/recreated WKWebView. The
// fake device record persists independently; no real credentials are accessed.
function page(device, initial = {}, handler) {
  class Storage {
    values = new Map();
    get length() { return this.values.size; }
    key(index) { return [...this.values.keys()][index] ?? null; }
    getItem(key) { return this.values.get(String(key)) ?? null; }
    setItem(key, value) { this.values.set(String(key), String(value)); }
    removeItem(key) { this.values.delete(String(key)); }
    clear() { this.values.clear(); }
  }
  const localStorage = new Storage(), sessionStorage = new Storage();
  Object.entries(initial).forEach(([key, value]) => localStorage.setItem(key, value));
  const calls = [];
  const win = { Storage, localStorage, sessionStorage, setTimeout, clearTimeout,
    webkit: { messageHandlers: { smartySession: { postMessage: async message => {
      calls.push(message);
      if (handler) await handler(message);
      if (message.action === 'read') return { values: structuredClone(device.values) };
      device.values = structuredClone(message.values);
      return { saved: true };
    } } } },
  };
  return { win, calls, ...createNativeSessionStorage(win) };
}
const SOCIAL = {
  eduscroll_user: '{"sub":"fixture-user"}',
  'smarty-native-refresh-token': 'synthetic-refresh-only',
  'smarty-native-refresh-subject': 'fixture-user',
};

test('existing social session is adopted and restored after all website storage disappears', async () => {
  const device = { values: null };
  const first = page(device, SOCIAL);
  await first.initialize();
  const reopened = page(device);
  await reopened.initialize();
  assert.equal(reopened.win.localStorage.getItem('smarty-native-refresh-token'), SOCIAL['smarty-native-refresh-token']);
  assert.equal(reopened.win.localStorage.getItem('eduscroll_user'), SOCIAL.eduscroll_user);
});

test('email SDK refresh and device metadata survive a new web process', async () => {
  const device = { values: null }, first = page(device);
  await first.initialize();
  first.win.localStorage.setItem('CognitoIdentityServiceProvider.client.LastAuthUser', 'fixture-user');
  first.win.localStorage.setItem('CognitoIdentityServiceProvider.client.fixture-user.refreshToken', 'synthetic');
  first.win.localStorage.setItem('CognitoIdentityServiceProvider.client.fixture-user.deviceKey', 'synthetic-device');
  await first.flush();
  const reopened = page(device);
  await reopened.initialize();
  assert.equal(reopened.win.localStorage.getItem('CognitoIdentityServiceProvider.client.fixture-user.refreshToken'), 'synthetic');
  assert.equal(reopened.win.localStorage.getItem('CognitoIdentityServiceProvider.client.fixture-user.deviceKey'), 'synthetic-device');
});

test('explicit logout stays logged out, even with stale website data on reopen', async () => {
  const device = { values: SOCIAL }, first = page(device);
  await first.initialize();
  Object.keys(SOCIAL).forEach(key => first.win.localStorage.removeItem(key));
  await first.flush();
  assert.deepEqual(device.values, {});
  const reopened = page(device, { ...SOCIAL, theme: 'blue' });
  await reopened.initialize();
  assert.equal(reopened.win.localStorage.getItem('eduscroll_user'), null);
  assert.equal(reopened.win.localStorage.getItem('theme'), 'blue');
});

test('account deletion clears saved auth without restoring it next launch', async () => {
  const device = { values: SOCIAL }, first = page(device);
  await first.initialize();
  first.win.localStorage.clear();
  await first.flush();
  assert.deepEqual(device.values, {});
});

test('temporary Keychain read failure never overwrites the saved session', async () => {
  const device = { values: SOCIAL };
  const first = page(device, {}, () => { throw Error('temporarily locked'); });
  await assert.rejects(first.initialize());
  assert.equal(first.calls.length, 1);
  assert.deepEqual(device.values, SOCIAL);
  const reopened = page(device);
  await reopened.initialize();
  assert.equal(reopened.win.localStorage.getItem('eduscroll_user'), SOCIAL.eduscroll_user);
});

test('only allowlisted login data is mirrored; never drafts, passwords, or OAuth attempts', async () => {
  const device = { values: null };
  const first = page(device, { ...SOCIAL, password: 'not-real', 'smarty-native-oauth-state': 'pending', draft: 'private draft' });
  await first.initialize();
  first.win.localStorage.setItem('draft', 'changed');
  first.win.sessionStorage.setItem('eduscroll_user', 'session-only');
  await first.flush();
  assert.deepEqual(device.values, SOCIAL);
  assert.equal(first.calls.length, 2);
  assert.equal(isSessionKey('CognitoIdentityServiceProvider.client.password'), false);
});

test('writes are ordered so a delayed login cannot replace a subsequent logout', async () => {
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  let blocked = true;
  const device = { values: {} }, first = page(device, {}, async message => {
    if (message.action === 'write' && blocked) { blocked = false; await gate; }
  });
  await first.initialize();
  first.win.localStorage.setItem('eduscroll_user', 'fixture');
  first.win.localStorage.removeItem('eduscroll_user');
  const flushed = first.flush();
  release();
  await flushed;
  assert.deepEqual(device.values, {});
});

test('failed writes can be retried without losing local session data', async () => {
  let fail = true;
  const device = { values: {} }, first = page(device, {}, message => {
    if (message.action === 'write' && fail) throw Error('storage busy');
  });
  await first.initialize();
  first.win.localStorage.setItem('eduscroll_user', 'fixture');
  await assert.rejects(first.flush());
  fail = false;
  await first.flush();
  assert.equal(device.values.eduscroll_user, 'fixture');
});

test('initialization is shared and an existing device session replaces a stale account cache', async () => {
  const device = { values: SOCIAL }, first = page(device, { eduscroll_user: 'old-account' });
  await Promise.all([first.initialize(), first.initialize()]);
  assert.equal(first.calls.length, 1);
  assert.equal(first.win.localStorage.getItem('eduscroll_user'), SOCIAL.eduscroll_user);
});

test('web browsers and older wrappers retain their existing storage behavior', async () => {
  const storage = createNativeSessionStorage({});
  await storage.initialize();
  await storage.flush();
});

test('ordinary API reads reusing the same token do not repeatedly write the Keychain', async () => {
  const device = { values: SOCIAL }, first = page(device);
  await first.initialize();
  for (let i=0; i<100; i++) first.win.localStorage.setItem('eduscroll_user', SOCIAL.eduscroll_user);
  first.win.localStorage.removeItem('eduscroll_access_token');
  await first.flush();
  assert.equal(first.calls.length, 1);
});
