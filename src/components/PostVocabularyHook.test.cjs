const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { createHash } = require('node:crypto');
const { setImmediate: tick } = require('node:timers/promises');
const { transformSync } = require('esbuild');
const actualVerify = require('../lib/postGlossary.js').verifyPostGlossary;
const { subscribePostVocabulary } = require('../lib/postVocabularyEvents.js');

function harness(verify = actualVerify) {
  const values = [], events = new Map();
  const checks = new Set();
  let cursor = 0, dependencies, pending, cleanup;
  const target = {
    addEventListener(name, fn) { events.set(name, fn); },
    removeEventListener(name, fn) { if (events.get(name) === fn) events.delete(name); },
  };
  const module = { exports: {} };
  const code = transformSync(fs.readFileSync(__dirname + '/../hooks/usePostVocabulary.js', 'utf8'), { format: 'cjs' }).code;
  vm.runInNewContext(code, { module, exports: module.exports,
    require(name) {
      if (name === 'react') return {
        useState(initial) { const slot = cursor++; if (!(slot in values)) values[slot] = initial; return [values[slot], value => { values[slot] = value; }]; },
        useEffect(effect, next) {
          if (!dependencies || next.some((value, index) => !Object.is(value, dependencies[index]))) { dependencies = [...next]; pending = effect; }
        },
      };
      if (name === '../lib/postGlossary') return { verifyPostGlossary: (...args) => {
        const check = Promise.resolve(verify(...args));
        checks.add(check);
        check.then(() => checks.delete(check), () => checks.delete(check));
        return check;
      } };
      if (name === '../lib/postVocabularyEvents') return { subscribePostVocabulary: (id, callback) => subscribePostVocabulary(id, callback, target) };
      throw new Error(name);
    },
  });
  return {
    render(post) { cursor = 0; return module.exports.default(post); },
    commit() { if (pending) { cleanup?.(); cleanup = pending(); pending = null; } },
    unmount() { cleanup?.(); },
    ready(postId, postGlossary) { events.get('smarty-post-vocabulary-ready')?.({ detail: { postId, postGlossary } }); },
    get listeners() { return events.size; },
    async settle() { await Promise.allSettled([...checks]); await tick(); },
  };
}
const post = { id: 'one', title: 'A leaf at work', body: 'Chlorophyll absorbs light.' };
const terms = [{ term: 'Chlorophyll', meaning: 'The green substance in a leaf that absorbs light used to make sugars.' }];
const glossary = (source = post, entries = terms) => ({ version: 1, sourceHash: createHash('sha256').update(source.title + '\n' + source.body).digest('hex'), terms: entries });

test('the split hook verifies saved meanings and cleans up its subscription', async () => {
  const app = harness(), source = { ...post, postGlossary: glossary() };
  assert.equal(app.render(null).length, 0); app.commit();
  assert.equal(app.listeners, 0);
  assert.equal(app.render(source).length, 0); app.commit(); await app.settle();
  assert.deepEqual(app.render(source), terms);
  app.unmount(); assert.equal(app.listeners, 0);
});

test('ready events add highlights without reloading and cannot apply to another post or source', async () => {
  const app = harness(); app.render(post); app.commit();
  app.ready('different-post', glossary()); await app.settle();
  assert.equal(app.render(post).length, 0);
  app.ready('one', glossary()); await app.settle();
  assert.deepEqual(app.render(post), terms);
  app.ready('one', glossary({ ...post, body: 'Different content.' })); await app.settle();
  assert.deepEqual(app.render(post), terms, 'An invalid event must not clear a valid current definition');
  const edited = { ...post, body: 'Corrected content.' };
  assert.equal(app.render(edited).length, 0, 'Source edits hide prior terms before effects run');
  app.commit(); app.ready('one', glossary()); await app.settle();
  assert.equal(app.render(edited).length, 0); app.unmount();
});

test('late checks from an old source or unmounted page cannot update a new post', async () => {
  const pending = [];
  const app = harness(() => new Promise(resolve => pending.push(resolve)));
  app.render(post); app.commit(); app.ready('one', glossary());
  const next = { ...post, id: 'two', body: 'A different source.' };
  app.render(next); app.commit();
  pending[0](glossary()); await tick();
  assert.equal(app.render(next).length, 0);
  app.ready('two', glossary(next)); app.unmount();
  pending[1](glossary(next)); await tick();
  assert.equal(app.listeners, 0);
});

test('a valid background update wins a racing initial check but invalid events do not cancel it', async () => {
  const pending = [];
  const app = harness(() => new Promise(resolve => pending.push(resolve)));
  const source = { ...post, postGlossary: glossary() };
  app.render(source); app.commit(); app.ready('one', glossary());
  pending[1](null); await tick(); pending[0](glossary()); await tick();
  assert.deepEqual(app.render(source), terms);
  const fuller = [{ ...terms[0], meaning: terms[0].meaning + ' It helps capture the energy needed by the plant.' }];
  app.ready('one', glossary(post, fuller)); pending[2](glossary(post, fuller)); await tick();
  assert.deepEqual(app.render(source), fuller); app.unmount();
});
