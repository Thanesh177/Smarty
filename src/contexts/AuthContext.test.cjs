// Real provider code with synthetic identities and controlled SDK timing.
// No Cognito requests, real credentials, or browser-profile storage are used.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const { transformSync } = require('esbuild');
const compiled = transformSync(fs.readFileSync(path.join(__dirname, 'AuthContext.jsx'), 'utf8'), {
  loader: 'jsx', format: 'cjs', define: { 'import.meta.env': '{}' },
}).code;
const flush = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const jwt = (sub, nonce, expiresIn = 3600) => `fixture.${Buffer.from(JSON.stringify({ sub, nonce, exp: Math.floor(Date.now() / 1000) + expiresIn })).toString('base64url')}.not-a-real-signature`;
const storage = () => { const data = new Map(); return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, String(value)), removeItem: key => data.delete(key) }; };

async function mount({ restore, exchange, refresh, initialNativeSession, initialSearch = '', pendingState = '', signInResult = { isSignedIn: true }, signInError } = {}) {
  const localStorage = storage(), sessionStorage = storage();
  if (initialNativeSession) {
    const subject = initialNativeSession.sub;
    const token = jwt(subject, undefined, initialNativeSession.expiresIn ?? -60);
    localStorage.setItem('eduscroll_token', token);
    localStorage.setItem('eduscroll_user', JSON.stringify({
      id: subject, userId: subject, sub: subject,
      email: `${subject}@example.invalid`, name: 'Remembered user', token,
    }));
    if (initialNativeSession.withNativeRefresh !== false) {
      localStorage.setItem('smarty-native-refresh-token', 'fixture-refresh-token');
      localStorage.setItem('smarty-native-refresh-subject', subject);
    }
  }
  if (pendingState) for (const store of [localStorage, sessionStorage]) {
    store.setItem('smarty-native-oauth-state', pendingState);
    store.setItem('smarty-native-oauth-nonce', `nonce-${pendingState}`);
  }
  const effects = [], states = [], events = [], listeners = new Map();
  let value, hub, exchanges = 0, refreshes = 0, sdkReads = 0, sdkSignedIn = false;
  const react = {
    createContext: () => ({ Provider: {} }), useCallback: fn => fn, useMemo: fn => fn(), useRef: current => ({ current }),
    useState: initial => { const i = states.push(initial) - 1; return [initial, next => { states[i] = typeof next === 'function' ? next(states[i]) : next; }]; },
    useEffect: fn => effects.push(fn), createElement: (type, props) => { value = props.value; return null; },
  };
  const window = { __SMARTY_NATIVE_APP__: true, location: { search: initialSearch, origin: 'https://fixture.invalid', replace: () => {} },
    addEventListener: (name, fn) => { const set = listeners.get(name) || new Set(); set.add(fn); listeners.set(name, set); },
    removeEventListener: (name, fn) => listeners.get(name)?.delete(fn),
    dispatchEvent: event => { events.push(event); listeners.get(event.type)?.forEach(fn => fn(event)); }, setTimeout, clearTimeout };
  const module = { exports: {} };
  vm.runInNewContext(compiled, { module, exports: module.exports, React: react, window, localStorage, sessionStorage,
    URL, URLSearchParams, Date, atob, navigator: { userAgent: 'Smarty-iOS' },
    CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options?.detail; } },
    console: { error() {}, warn() {} }, require: name => {
      if (name === 'react') return react;
      if (name === 'aws-amplify/utils') return { Hub: { listen: (channel, fn) => { hub = fn; return () => {}; } } };
      if (name === 'aws-amplify/auth') return {
        getCurrentUser: async () => { sdkReads++; if (sdkSignedIn) return { userId: 'older-user' }; if (typeof restore === 'function') return restore(sdkReads); if (restore) return restore; const error = Error('No current user'); error.name = 'UserUnAuthenticatedException'; throw error; },
        fetchAuthSession: async () => ({ tokens: { idToken: { toString: () => jwt('older-user'), payload: { sub: 'older-user' } } } }),
        signOut: async () => { sdkSignedIn = false; },
        signIn: async () => { if (signInError) throw signInError; sdkSignedIn = Boolean(signInResult.isSignedIn); return signInResult; },
        confirmSignIn: async () => { sdkSignedIn = true; return { isSignedIn: true }; },
      };
      if (name.includes('cognito')) return {
        exchangeNativeCodeForTokens: async () => {
          exchanges++;
          const nonce = sessionStorage.getItem('smarty-native-oauth-nonce');
          if (exchange) await exchange;
          return { id_token: jwt('new-user', nonce), access_token: jwt('new-user'), refresh_token: 'fixture-refresh-token' };
        },
        persistNativeRefreshSession: (tokens, subject) => {
          if (!tokens?.refresh_token || !subject) return false;
          localStorage.setItem('smarty-native-refresh-token', tokens.refresh_token);
          localStorage.setItem('smarty-native-refresh-subject', subject);
          return true;
        },
        hasNativeRefreshSession: subject => Boolean(
          localStorage.getItem('smarty-native-refresh-token') &&
          localStorage.getItem('smarty-native-refresh-subject') === subject
        ),
        clearNativeRefreshSession: () => {
          localStorage.removeItem('smarty-native-refresh-token');
          localStorage.removeItem('smarty-native-refresh-subject');
        },
        refreshNativeSession: async () => {
          refreshes++;
          if (refresh) return refresh();
          const subject = localStorage.getItem('smarty-native-refresh-subject');
          return { id_token: jwt(subject), access_token: jwt(subject), refresh_token: 'fixture-refresh-token' };
        },
      };
      if (name.includes('userScopedStorage')) return { removeLegacyAccountCacheKeys() {} };
      if (name.includes('adminAccess')) return { normalizeGroups: () => [] };
      throw Error(`Unmocked import: ${name}`);
    } });
  module.exports.AuthProvider({ children: null });
  effects.forEach(fn => fn());
  await flush();
  return { window, localStorage, sessionStorage, states, events, value, get exchanges() { return exchanges; }, get refreshes() { return refreshes; }, get sdkReads() { return sdkReads; },
    hub: payload => hub({ payload }),
    begin: state => { for (const store of [localStorage, sessionStorage]) { store.setItem('smarty-native-oauth-state', state); store.setItem('smarty-native-oauth-nonce', `nonce-${state}`); store.setItem('smarty-native-oauth-code-verifier', 'fixture-verifier'); } },
    callback: state => window.__SMARTY_COMPLETE_NATIVE_OAUTH__(`smarty://callback?code=fixture-${state}&state=${state}`),
  };
}

test('first native callback completes; duplicate callbacks exchange only once', async () => {
  const app = await mount(); app.begin('first'); app.callback('first'); app.callback('first'); await flush();
  assert.equal(app.exchanges, 1); assert.equal(app.states[0].sub, 'new-user');
  app.callback('first'); await flush(); assert.equal(app.exchanges, 1);
});

test('a stale callback cannot clear the state of a newer attempt', async () => {
  const app = await mount(); app.begin('new-attempt'); app.callback('old-attempt'); await flush();
  assert.equal(app.exchanges, 0);
  assert.equal(app.sessionStorage.getItem('smarty-native-oauth-state'), 'new-attempt');
  app.callback('new-attempt'); await flush(); assert.equal(app.states[0].sub, 'new-user');
});

test('a delayed bootstrap cannot overwrite a completed native sign-in', async () => {
  const old = deferred(); const app = await mount({ restore: old.promise });
  app.begin('first'); app.callback('first'); await flush();
  old.resolve({ userId: 'older-user' }); await flush(); await flush();
  assert.equal(app.states[0].sub, 'new-user');
  assert.equal(JSON.parse(app.localStorage.getItem('eduscroll_user')).sub, 'new-user');
});

test('logout invalidates a native exchange that is still in flight', async () => {
  const pending = deferred(); const app = await mount({ exchange: pending.promise });
  app.begin('first'); app.callback('first'); await app.value.logout(); pending.resolve(); await flush();
  assert.equal(app.states[0], null); assert.equal(app.localStorage.getItem('eduscroll_user'), null);
});

test('explicit logout removes the persistent native session', async () => {
  const app = await mount();
  app.begin('first'); app.callback('first'); await flush();
  assert.equal(app.localStorage.getItem('smarty-native-refresh-token'), 'fixture-refresh-token');
  await app.value.logout();
  assert.equal(app.localStorage.getItem('smarty-native-refresh-token'), null);
  assert.equal(app.localStorage.getItem('eduscroll_user'), null);
});

test('SDK sign-out cannot erase a separate native social session', async () => {
  const app = await mount({ initialNativeSession: { sub: 'remembered-user', expiresIn: 3600 } });
  await app.hub({ event: 'signedOut' });
  assert.equal(app.states[0]?.sub, 'remembered-user');
  assert.ok(app.localStorage.getItem('smarty-native-refresh-token'));
});

test('SDK sign-out during native restoration does not cancel it', async () => {
  const pending = deferred();
  const app = await mount({ initialNativeSession: { sub: 'remembered-user' }, refresh: () => pending.promise });
  await app.hub({ event: 'signedOut' });
  pending.resolve({ id_token: jwt('remembered-user'), access_token: jwt('remembered-user') });
  await flush();
  assert.equal(app.states[0]?.sub, 'remembered-user');
  assert.ok(app.localStorage.getItem('smarty-native-refresh-token'));
});

test('confirmed email-session sign-out still clears the email account', async () => {
  const app = await mount({ initialNativeSession: { sub: 'older-user', expiresIn: 3600, withNativeRefresh: false } });
  await app.hub({ event: 'signedOut' });
  assert.equal(app.states[0], null);
  assert.equal(app.localStorage.getItem('eduscroll_user'), null);
});

test('reconnecting after explicit logout does not silently sign in again', async () => {
  const app = await mount({ initialNativeSession: { sub: 'remembered-user', expiresIn: 3600 } });
  await app.value.logout();
  app.window.dispatchEvent({type:'online'});
  app.window.dispatchEvent({type:'focus'});
  await flush();
  assert.equal(app.states[0], null);
  assert.equal(app.refreshes, 0);
});

test('an expired saved session recovers when connectivity returns', async () => {
  let online = false;
  const app = await mount({ initialNativeSession: { sub: 'remembered-user' }, refresh: async () => {
    if (!online) throw Error('Network unavailable');
    return { id_token: jwt('remembered-user'), access_token: jwt('remembered-user') };
  } });
  await flush();
  online = true;
  app.window.dispatchEvent({ type: 'online' });
  await flush(); await flush();
  assert.equal(app.refreshes, 2);
  const token = JSON.parse(app.localStorage.getItem('eduscroll_user')).token;
  assert.ok(JSON.parse(Buffer.from(token.split('.')[1], 'base64url')).exp > Date.now() / 1000);
});

test('restoration uses the active native identity without waiting on the SDK', async () => {
  const app = await mount(); app.begin('first'); app.callback('first'); await flush();
  const before = app.sdkReads;
  const result = await app.value.restoreSession();
  assert.equal(result.sub, 'new-user'); assert.equal(app.sdkReads, before);
});

test('an expired native token is refreshed after an app relaunch', async () => {
  const app = await mount({
    initialNativeSession: { sub: 'remembered-user', expiresIn: -60 },
  });
  await flush();
  assert.equal(app.refreshes, 1);
  assert.equal(app.states[0].sub, 'remembered-user');
  assert.equal(app.sdkReads, 0);
  assert.ok(JSON.parse(app.localStorage.getItem('eduscroll_user')).token);
});

test('a temporary relaunch failure keeps the remembered native session', async () => {
  const app = await mount({
    initialNativeSession: { sub: 'remembered-user', expiresIn: -60 },
    refresh: async () => { throw Error('The network is temporarily unavailable'); },
  });
  await flush();
  assert.equal(app.localStorage.getItem('smarty-native-refresh-token'), 'fixture-refresh-token');
  assert.equal(JSON.parse(app.localStorage.getItem('eduscroll_user')).sub, 'remembered-user');
  assert.equal(app.states[0].sub, 'remembered-user');
});

async function waitForBootstrap(app) {
  const deadline = Date.now() + 4000;
  while (app.states[1] && Date.now() < deadline) {
    await new Promise(resolve => setTimeout(resolve, 25));
  }
  assert.equal(app.states[1], false, 'session restoration should finish');
}

test('email session restoration retries a temporary failure on relaunch', async () => {
  const app = await mount({
    initialNativeSession: { sub: 'older-user', withNativeRefresh: false },
    restore: attempt => {
      if (attempt < 3) throw Error('Network unavailable');
      return { userId: 'older-user' };
    },
  });
  await waitForBootstrap(app);
  assert.equal(app.sdkReads, 3);
  assert.equal(app.states[0].sub, 'older-user');
  assert.equal(JSON.parse(app.localStorage.getItem('eduscroll_user')).sub, 'older-user');
});

test('offline email restoration preserves saved records without trusting an expired token', async () => {
  const app = await mount({
    initialNativeSession: { sub: 'older-user', withNativeRefresh: false },
    restore: () => { throw Error('Network unavailable'); },
  });
  await waitForBootstrap(app);
  assert.equal(app.sdkReads, 4);
  assert.equal(app.states[0], null);
  assert.equal(JSON.parse(app.localStorage.getItem('eduscroll_user')).sub, 'older-user');
  assert.ok(app.localStorage.getItem('eduscroll_token'));
});

test('an invalid remembered session is removed instead of being reused', async () => {
  const invalidSession = Error('The refresh token is no longer valid');
  invalidSession.invalidSession = true;
  const app = await mount({
    initialNativeSession: { sub: 'remembered-user', expiresIn: -60 },
    refresh: async () => { throw invalidSession; },
  });
  await flush();
  assert.equal(app.localStorage.getItem('smarty-native-refresh-token'), null);
  assert.equal(app.localStorage.getItem('eduscroll_user'), null);
  assert.equal(app.states[0], null);
});

test('a late failure from a previous exchange cannot cancel a newer attempt', async () => {
  const pending = deferred(); const app = await mount({ exchange: pending.promise });
  app.begin('old'); app.callback('old'); app.begin('new'); pending.reject(Error('Network failure')); await flush();
  assert.equal(app.sessionStorage.getItem('smarty-native-oauth-state'), 'new');
  assert.equal(app.events.filter(event => event.detail?.status === 'failed').length, 0);
});

test('late SDK sign-in events cannot restore a user after logout', async () => {
  const app = await mount({ restore: Promise.resolve({ userId: 'older-user' }) });
  await app.value.logout();
  await app.hub({ event: 'signedIn' });
  assert.equal(app.states[0], null); assert.equal(app.localStorage.getItem('eduscroll_user'), null);
});

test('SDK redirect failures release the pending screen', async () => {
  const app = await mount();
  app.window.__SMARTY_NATIVE_APP__ = false;
  await app.hub({ event: 'signInWithRedirect_failure' });
  assert.equal(app.states[1], false);
  assert.ok(app.states.includes('Connected sign-in could not be completed. Please try again.'));
});

test('an old provider error in the callback URL cannot erase a newer attempt', async () => {
  const app = await mount({ pendingState: 'new', initialSearch: '?native_oauth=ios&error=access_denied&state=old' });
  assert.equal(app.sessionStorage.getItem('smarty-native-oauth-state'), 'new');
  assert.equal(app.exchanges, 0);
});

test('API requests prefer the signed-in native account over stale SDK tokens', async () => {
  const localStorage = storage(), sessionStorage = storage();
  const current = jwt('new-user');
  localStorage.setItem('eduscroll_token', current);
  localStorage.setItem('eduscroll_user', JSON.stringify({ sub: 'new-user' }));
  let sdkReads = 0;
  const module = { exports: {} };
  const source = fs.readFileSync(path.join(__dirname, '../api/client.js'), 'utf8') + '\nexport { getAuthToken as testGetAuthToken };';
  const apiCompiled = transformSync(source, { format: 'cjs', define: { 'import.meta.env': '{}' } }).code;
  vm.runInNewContext(apiCompiled, { module, exports: module.exports, localStorage, sessionStorage, URL, URLSearchParams, atob, Date,
    window: { __SMARTY_IS_NATIVE_APP__: true, location: { origin: 'https://fixture.invalid' }, addEventListener() {} }, navigator: { userAgent: 'Smarty-iOS' },
    require: name => {
      if (name === 'axios') return { create: () => ({ interceptors: { request: { use() {} } } }) };
      if (name === 'aws-amplify/auth') return { fetchAuthSession: async () => { sdkReads++; return { tokens: { idToken: { toString: () => jwt('older-user') } } }; } };
      if (name.includes('requestCache')) return { createRequestCache: () => ({ clear() {} }) };
      return {};
    } });
  assert.equal(await module.exports.testGetAuthToken(), current);
  assert.equal(sdkReads, 0);
  localStorage.removeItem('eduscroll_token'); localStorage.removeItem('eduscroll_user');
  sessionStorage.setItem('smarty-native-oauth-state', 'pending-attempt');
  assert.equal(await module.exports.testGetAuthToken(), '');
  assert.equal(sdkReads, 0);
});

test('API requests refresh an expired native session without switching accounts', async () => {
  const localStorage = storage(), sessionStorage = storage();
  const expired = jwt('remembered-user', undefined, -60);
  const current = jwt('remembered-user');
  localStorage.setItem('eduscroll_token', expired);
  localStorage.setItem('eduscroll_user', JSON.stringify({
    id: 'remembered-user', sub: 'remembered-user', token: expired,
  }));
  localStorage.setItem('smarty-native-refresh-token', 'fixture-refresh-token');
  localStorage.setItem('smarty-native-refresh-subject', 'remembered-user');
  let sdkReads = 0, refreshes = 0;
  const module = { exports: {} };
  const source = fs.readFileSync(path.join(__dirname, '../api/client.js'), 'utf8') + '\nexport { getAuthToken as testGetAuthToken };';
  const apiCompiled = transformSync(source, { format: 'cjs', define: { 'import.meta.env': '{}' } }).code;
  vm.runInNewContext(apiCompiled, { module, exports: module.exports, localStorage, sessionStorage, URL, URLSearchParams, atob, Date,
    window: { __SMARTY_IS_NATIVE_APP__: true, location: { origin: 'https://fixture.invalid' }, addEventListener() {} }, navigator: { userAgent: 'Smarty-iOS' },
    require: name => {
      if (name === 'axios') return { create: () => ({ interceptors: { request: { use() {} } } }) };
      if (name === 'aws-amplify/auth') return { fetchAuthSession: async () => { sdkReads++; return {}; } };
      if (name.includes('requestCache')) return { createRequestCache: () => ({ clear() {} }) };
      if (name.includes('cognito')) return {
        hasNativeRefreshSession: subject => subject === 'remembered-user',
        refreshNativeSession: async () => {
          refreshes++;
          return { id_token: current, access_token: current };
        },
      };
      return {};
    } });
  assert.equal(await module.exports.testGetAuthToken(), current);
  assert.equal(refreshes, 1);
  assert.equal(sdkReads, 0);
  assert.equal(JSON.parse(localStorage.getItem('eduscroll_user')).token, current);
});

test('email sign-in returns a ready session on its first attempt', async () => {
  const app = await mount();
  const result = await app.value.login('fixture@example.invalid', 'synthetic-test-value');
  assert.equal(result.success, true); assert.equal(app.states[0].sub, 'older-user');
});

test('verification challenges do not authenticate until confirmation succeeds', async () => {
  const app = await mount({ signInResult: { isSignedIn: false, nextStep: { signInStep: 'CONFIRM_SIGN_IN_WITH_EMAIL_CODE' } } });
  const result = await app.value.login('fixture@example.invalid', 'synthetic-test-value');
  assert.equal(result.success, false); assert.equal(app.states[0], null);
  assert.equal((await app.value.confirmLogin('fixture-code')).success, true);
});

test('incorrect credentials do not save a session', async () => {
  const app = await mount({ signInError: Error('Incorrect username or password') });
  await assert.rejects(app.value.login('fixture@example.invalid', 'synthetic-test-value'));
  assert.equal(app.states[0], null); assert.equal(app.localStorage.getItem('eduscroll_user'), null);
});
