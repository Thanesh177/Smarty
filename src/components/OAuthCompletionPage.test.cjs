const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { transformSync } = require('esbuild');

const compiled = transformSync(fs.readFileSync(__dirname + '/OAuthCompletionPage.jsx', 'utf8'), {
  loader: 'jsx', jsx: 'automatic', format: 'cjs',
}).code;
const nextTurn = () => new Promise(resolve => setImmediate(resolve));

function mount({ loading = true, user = null, authError = '' } = {}) {
  let resolve, reject;
  const recovery = new Promise((success, fail) => { resolve = success; reject = fail; });
  const navigations = [], authClears = [], removed = [], recoveryAttempts = [];
  const auth = { loading, user, authError,
    restoreSession: ({ attempts }) => { recoveryAttempts.push(attempts); return recovery; },
  };
  const navigate = (path, { replace }) => navigations.push([path, replace]);
  const slots = [];
  let index, queued = [];
  const react = {
    useState: initial => {
      const slot = slots[index++] ?? (slots[index - 1] = { value: typeof initial === 'function' ? initial() : initial });
      return [slot.value, next => { slot.value = next; }];
    },
    useRef: initial => slots[index++] ?? (slots[index - 1] = { current: initial }),
    useEffect: (run, dependencies) => {
      const slot = slots[index++] ?? (slots[index - 1] = {});
      if (!slot.dependencies || dependencies.some((value, i) => !Object.is(value, slot.dependencies[i]))) {
        slot.dependencies = dependencies;
        slot.run = run;
        queued.push(slot);
      }
    },
  };
  const module = { exports: {} };
  vm.runInNewContext(compiled, { module, exports: module.exports,
    sessionStorage: { removeItem: key => removed.push(key) },
    require(name) {
      if (name === 'react') return react;
      if (name === 'react-router-dom') return { useNavigate: () => navigate };
      if (name.endsWith('/AuthContext')) return { useAuth: () => auth };
      if (name.endsWith('/authNavigation')) return {
        readAuthDestination: () => '/feed?topic=Science', clearAuthDestination: () => authClears.push(true),
      };
      return require(name);
    },
  });
  const loader = 'pending';
  function render(update) {
    Object.assign(auth, update);
    index = 0;
    queued = [];
    const output = module.exports.default({ children: loader });
    for (const slot of queued) {
      slot.cleanup?.();
      slot.cleanup = slot.run();
    }
    return output;
  }
  function replayEffects() {
    for (const slot of slots.filter(value => value.run)) {
      slot.cleanup?.();
      slot.cleanup = slot.run();
    }
  }
  return { loader, render, replayEffects, resolve, reject, recoveryAttempts, navigations, authClears, removed };
}

test('OAuth callback waits through startup and slow recovery without treating an earlier error as terminal', async () => {
  const app = mount({ authError: 'The first lookup failed.' });
  assert.equal(app.render(), app.loader);
  await nextTurn();
  assert.deepEqual(app.recoveryAttempts, []);

  assert.equal(app.render({ loading: false }), app.loader);
  await nextTurn();
  assert.deepEqual(app.recoveryAttempts, [8]);
  assert.equal(app.render(), app.loader);

  const user = { sub: 'fixture-user' };
  app.resolve(user);
  await nextTurn();
  assert.equal(app.render({ user }), app.loader);
  assert.deepEqual(app.navigations, [['/feed?topic=Science', true]]);
  assert.deepEqual(app.authClears, [true]);
  assert.deepEqual(app.removed, ['smarty-auth-redirecting']);
});

test('a rejected OAuth recovery shows the sign-in action after the final failure', async () => {
  const app = mount({ loading: false, authError: 'Check your connection and try again.' });
  assert.equal(app.render(), app.loader);
  app.replayEffects();
  await nextTurn();
  assert.deepEqual(app.recoveryAttempts, [8]);
  app.reject(new Error('Synthetic lookup failure'));
  await nextTurn();

  const error = app.render();
  assert.equal(error.props.role, 'alert');
  assert.equal(error.props.children.props.children[0].props.children[1].props.children, 'Check your connection and try again.');
  error.props.children.props.children[1].props.onClick();
  assert.deepEqual(app.navigations, [['/login', true]]);
});
