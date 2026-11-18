import test from 'node:test';
import assert from 'node:assert/strict';
import { createNewsPreferenceSync } from './newsPreferenceSync.js';

test('rapid choices are saved in order and skip intermediate pending editions', async () => {
  const sync = createNewsPreferenceSync();
  const sent = [];
  let finishFirst;
  const firstResponse = new Promise(resolve => { finishFirst = resolve; });
  const submit = choice => () => {
    sent.push(choice);
    return choice === 'world' ? firstResponse : Promise.resolve(choice);
  };

  const first = sync('user', submit('world'));
  const intermediate = sync('user', submit('Ontario'));
  const last = sync('user', submit('Tamil Nadu'));
  assert.deepEqual(sent, ['world']);
  assert.deepEqual(await intermediate, { status: 'superseded' });

  finishFirst('world');
  assert.deepEqual(await first, { status: 'superseded' });
  assert.deepEqual(await last, { status: 'synced', value: 'Tamil Nadu' });
  assert.deepEqual(sent, ['world', 'Tamil Nadu']);
});

test('an earlier failed save does not block the next save or report a stale warning', async () => {
  const sync = createNewsPreferenceSync();
  let failFirst;
  const first = sync('user', () => new Promise((_, reject) => { failFirst = reject; }));
  const latest = sync('user', async () => 'world');
  failFirst(Error('offline'));
  assert.deepEqual(await first, { status: 'superseded' });
  assert.deepEqual(await latest, { status: 'synced', value: 'world' });
  assert.deepEqual(await sync('user', () => { throw Error('offline'); }), { status: 'failed' });
});

test('another account does not wait for an old account, and a queued write can be skipped', async () => {
  const sync = createNewsPreferenceSync();
  let finishFirst;
  let account = 'first';
  const started = sync('first', () => new Promise(resolve => { finishFirst = resolve; }));
  const queued = sync('first', () => {
    if (account !== 'first') return null;
    assert.fail('a write queued for the previous account must not send');
  });
  account = 'second';
  assert.deepEqual(await sync('second', async () => 'Ontario'), { status: 'synced', value: 'Ontario' });
  finishFirst('world');
  assert.deepEqual(await started, { status: 'superseded' });
  assert.deepEqual(await queued, { status: 'synced', value: null });
});
