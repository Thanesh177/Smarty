import test from 'node:test';
import assert from 'node:assert/strict';
import { createVocabularyPublisher, vocabularyOutboxKey } from './postVocabularyPublishing.js';

const glossary = { version: 1, sourceHash: 'a'.repeat(64), terms: [{ term: 'ATP', meaning: 'A molecule that transfers energy between reactions inside a cell.' }] };
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const settle = async () => { for (let n = 0; n < 8; n++) await Promise.resolve(); };
function harness(options = {}) {
  const values = new Map(), timers = new Map(), calls = [], ready = [];
  let clock = 1000000, timerId = 0, online = true;
  const storage = { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
  const controller = createVocabularyPublisher({ storage, now: () => clock,
    canRun: () => online,
    schedule: (run, delay) => { const id = ++timerId; timers.set(id, { run, at: clock + delay }); return id; },
    cancel: id => timers.delete(id),
    enqueue: async id => { calls.push(id); return options.enqueue ? options.enqueue(id) : { status: 'queued' }; },
    readStatus: options.readStatus || (async () => ({ status: 'ready', postGlossary: glossary })),
    onReady: event => ready.push(event),
  });
  return { controller, values, timers, calls, ready, storage,
    setOnline: value => { online = value; },
    advance: async milliseconds => {
      clock += milliseconds;
      const due = [...timers].filter(([, value]) => value.at <= clock);
      for (const [id, value] of due) { timers.delete(id); await value.run(); }
      await settle();
    },
  };
}
const payload = { id: 'p1', title: 'How a cell uses ATP', body: 'A learning post.' };

test('confirmation does not wait for optional preparation and persists no content or credentials', async () => {
  const pending = deferred(), view = harness({ enqueue: () => pending.promise });
  view.controller.activate('alice');
  assert.equal(view.controller.submit({ success: true, item: { id: 'p1' } }, payload), true);
  await settle();
  const saved = JSON.parse(view.values.get(vocabularyOutboxKey('alice')));
  assert.deepEqual(saved, [{ id: 'p1', createdAt: 1000000 }]);
  assert.equal(view.ready.length, 0);
  pending.resolve({ status: 'queued' }); await settle();
  assert.equal(view.values.has(vocabularyOutboxKey('alice')), false);
  await view.advance(4000);
  assert.deepEqual(view.ready, [{ account: 'alice', postId: 'p1', postGlossary: glossary }]);
});

test('offline or interrupted enqueue resumes only for its original account', async () => {
  const view = harness(); view.setOnline(false);
  view.controller.activate('alice'); view.controller.submit({ id: 'p1' }, payload);
  view.controller.activate('bob'); view.setOnline(true); view.controller.resume(); await settle();
  assert.deepEqual(view.calls, []);
  view.controller.activate('alice'); await settle();
  assert.deepEqual(view.calls, ['p1']);
});

test('a late response after logout or account switching cannot update another account', async () => {
  const result = deferred(), view = harness({ enqueue: () => result.promise });
  view.controller.activate('alice'); view.controller.submit({ id: 'p1' }, payload); await settle();
  view.controller.activate('bob');
  result.resolve({ status: 'ready', postGlossary: glossary }); await settle();
  assert.deepEqual(view.ready, []);
  assert.ok(view.values.has(vocabularyOutboxKey('alice')));
  assert.equal(view.values.has(vocabularyOutboxKey('bob')), false);
});

test('accepted edits replace an in-flight enqueue so the newer saved source is not lost', async () => {
  const first = deferred(); let calls = 0;
  const view = harness({ enqueue: () => ++calls === 1 ? first.promise : { status: 'queued' } });
  view.controller.activate('alice'); view.controller.submit({ id: 'p1' }, payload); await settle();
  view.controller.submit({ id: 'p1' }, { ...payload, body: 'Edited text.' });
  first.resolve({ status: 'ready', postGlossary: glossary }); await settle();
  assert.equal(view.ready.length, 0, 'The earlier response cannot win over the new edit');
  await view.advance(0);
  assert.equal(calls, 2);
  assert.equal(view.values.has(vocabularyOutboxKey('alice')), false);
});

test('transient enqueue failures have finite retries and unauthorized or deleted posts are discarded', async () => {
  const view = harness({ enqueue: () => { throw new Error('Offline'); } });
  view.controller.activate('alice'); view.controller.submit({ id: 'p1' }, payload); await settle();
  await view.advance(5000); await view.advance(20000); await view.advance(60000);
  assert.equal(view.calls.length, 3);
  assert.equal(view.timers.size, 0);
  assert.ok(view.values.has(vocabularyOutboxKey('alice')), 'The next app open can recover interrupted enqueue');
  for (const status of [400, 401, 403, 404, 410]) {
    const rejected = harness({ enqueue: () => { throw { response: { status } }; } });
    rejected.controller.activate('alice'); rejected.controller.submit({ id: 'p1' }, payload); await settle();
    assert.equal(rejected.values.size, 0);
    assert.equal(rejected.timers.size, 0);
  }
});

test('status polling stops for exhausted jobs and never triggers generation itself', async () => {
  let statusReads = 0;
  const view = harness({ readStatus: async () => { statusReads++; return { status: 'unavailable' }; } });
  view.controller.activate('alice'); view.controller.submit({ id: 'p1' }, payload); await settle();
  await view.advance(4000); await view.advance(300000);
  assert.equal(statusReads, 1);
  assert.equal(view.calls.length, 1);
  assert.equal(view.timers.size, 0);
});

test('failed writes and expired or corrupt outbox entries cause no preparation', async () => {
  const view = harness();
  view.values.set(vocabularyOutboxKey('alice'), JSON.stringify([{ id: 'old', createdAt: -7 * 86400000 }, { id: {}, createdAt: 0 }]));
  view.controller.activate('alice');
  for (const result of [{ success: false }, { error: 'Failed' }, 'not JSON']) assert.equal(view.controller.submit(result, payload), false);
  await settle(); assert.deepEqual(view.calls, []);
  view.controller.deactivate();
  view.values.set(vocabularyOutboxKey('alice'), 'corrupt JSON');
  assert.doesNotThrow(() => view.controller.activate('alice'));
});

test('polling has a hard stop and deactivate cancels background timers', async () => {
  let statusReads = 0;
  const view = harness({ readStatus: async () => { statusReads++; return { status: 'preparing' }; } });
  view.controller.activate('alice'); view.controller.submit({ id: 'p1' }, payload); await settle();
  for (let n = 0; n < 10; n++) await view.advance(30000);
  assert.equal(statusReads, 6);
  assert.equal(view.timers.size, 0);
  view.controller.submit({ id: 'p2' }, payload); await settle(); view.controller.deactivate();
  assert.equal(view.timers.size, 0);
});
