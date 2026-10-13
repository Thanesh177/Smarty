const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { transformSync } = require('esbuild');

function harness({ capability = true, loading = false, user = 'alice', pending } = {}) {
  let effect;
  const listeners = new Map(), emitted = [], saved = [], requests = [], microtasks = [], timers = new Map();
  const window = { __SMARTY_NATIVE_PUSH__: capability,
    addEventListener: (name, fn) => listeners.set(name, fn),
    removeEventListener: (name, fn) => { if (listeners.get(name) === fn) listeners.delete(name); },
    dispatchEvent: event => emitted.push(event),
    setTimeout: fn => { timers.set(1, fn); return 1; }, clearTimeout: id => timers.delete(id) };
  const document = { visibilityState: 'visible', addEventListener() {}, removeEventListener() {} };
  const scope = { exports: {} };
  vm.runInNewContext(transformSync(fs.readFileSync(__dirname + '/../hooks/useNativePush.js', 'utf8'), { format: 'cjs' }).code, {
    module: scope, exports: scope.exports, window, document,
    CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init.detail; } },
    queueMicrotask: fn => microtasks.push(fn),
    require(name) {
      if (name === 'react') return { useEffect: fn => { effect = fn; } };
      if (name.includes('api/client')) return { userApi: { savePushToken: async (token, platform) => saved.push({ token, platform }) } };
      if (name.includes('nativeNotifications')) return { supportsNativeReminders: () => true,
        nativeNotificationRequest: async (command, value) => {
          requests.push({ command, value });
          if (command === 'push-token') return pending || { token: 'fixture-device-registration-123', permission: 'granted' };
          return { permission: 'granted' };
        } };
      if (name.includes('userScopedStorage')) return { getUserScope: value => value || 'anonymous' };
      if (name.includes('notificationPreferences')) return { loadNotificationPreferences: () => ({ enabled: true }) };
      if (name.includes('dailyReminder')) return { reminderTime: () => null };
      throw new Error(name);
    },
  });
  scope.exports.default(user, loading);
  const cleanup = effect();
  const flush = async () => { for (const fn of microtasks.splice(0)) fn(); for (let i=0;i<8;i++) await Promise.resolve(); };
  return { requests, emitted, saved, listeners, cleanup, flush };
}

test('native push never starts before account restoration or in an older wrapper', async () => {
  for (const options of [{ loading: true }, { capability: false }]) {
    const app = harness(options); await app.flush(); assert.equal(app.requests.length, 0);
  }
});
test('registration binds to the authenticated account, deduplicates and cleans up', async () => {
  const app = harness(); await app.flush();
  assert.equal(app.requests[0].value.userScope, 'alice');
  assert.deepEqual(app.saved, [{ token: 'fixture-device-registration-123', platform: 'ios' }]);
  await app.listeners.get('smarty-native-push-ready')();
  assert.equal(app.saved.length, 1);
  app.cleanup(); assert.equal(app.listeners.size, 0);
});
test('logout configures anonymous device scope without uploading registration', async () => {
  const app = harness({ user: '' }); await app.flush();
  assert.equal(app.requests[0].value.userScope, 'anonymous');
  assert.equal(app.saved.length, 0); app.cleanup();
});
test('a pending registration cannot bind after account cleanup', async () => {
  let resolve; const pending = new Promise(done => { resolve = done; });
  const app = harness({ pending }); await app.flush(); app.cleanup();
  resolve({ token: 'fixture-device-registration-123' }); await app.flush();
  assert.equal(app.saved.length, 0);
});
test('a notification tap for another account cannot open a private route', async () => {
  const app = harness(); await app.flush();
  const open = app.listeners.get('smarty-native-push-open');
  open({ detail: { userId: 'bob', url: '/news/story?q=test' } });
  assert.equal(app.emitted.filter(event => event.type === 'smarty-notification-open').length, 0);
  open({ detail: { userId: 'alice', url: '/news/story?q=test' } });
  assert.equal(app.emitted.filter(event => event.type === 'smarty-notification-open').length, 1); app.cleanup();
});
