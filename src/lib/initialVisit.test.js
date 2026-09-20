import test from 'node:test';
import assert from 'node:assert/strict';

const freshModule = () => import(`./initialVisit.js?test=${Math.random()}`);
test('new device sees landing; later launches use saved choice', async () => {
  const items = new Map();
  const storage = { getItem: key => items.get(key), setItem: (key, value) => items.set(key, value) };
  const first = await freshModule();
  assert.equal(first.hasSeenLanding(storage), false);
  first.rememberLanding(storage);
  const nextLaunch = await freshModule();
  assert.equal(nextLaunch.hasSeenLanding(storage), true);
  assert.equal(items.size, 1);
});
test('unavailable storage preserves the choice for the current session', async () => {
  const visit = await freshModule();
  const storage = { getItem() { throw new Error('disabled'); }, setItem() { throw new Error('disabled'); } };
  assert.equal(visit.hasSeenLanding(storage), false);
  assert.doesNotThrow(() => visit.rememberLanding(storage));
  assert.equal(visit.hasSeenLanding(storage), true);
});
test('unrecognized stored values do not skip onboarding', async () => {
  const visit = await freshModule();
  assert.equal(visit.hasSeenLanding({ getItem: () => 'false' }), false);
});
