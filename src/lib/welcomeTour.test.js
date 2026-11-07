import test from 'node:test';
import assert from 'node:assert/strict';
import { isWelcomeTourEntry, WELCOME_TOUR_KEY } from './welcomeTour.js';

const freshModule = () => import(`./welcomeTour.js?test=${Math.random()}`);
const storageFixture = () => {
  const items = new Map();
  return { getItem: key => items.get(key), setItem: (key, value) => items.set(key, value) };
};

test('only new devices and queued first visits are offered the tour automatically', async () => {
  const storage = storageFixture();
  const first = await freshModule();
  assert.equal(first.shouldOfferWelcomeTour(true, storage), false);
  assert.equal(first.shouldOfferWelcomeTour(false, storage), true);
  first.queueWelcomeTour(storage);
  assert.equal(storage.getItem(WELCOME_TOUR_KEY), 'pending');
  const nextLaunch = await freshModule();
  assert.equal(nextLaunch.shouldOfferWelcomeTour(true, storage), true);
});

test('finishing or skipping stays dismissed across restarts and is not requeued', async () => {
  const storage = storageFixture();
  const first = await freshModule();
  first.queueWelcomeTour(storage);
  first.finishWelcomeTour(storage);
  const nextLaunch = await freshModule();
  nextLaunch.queueWelcomeTour(storage);
  assert.equal(storage.getItem(WELCOME_TOUR_KEY), 'done');
  assert.equal(nextLaunch.shouldOfferWelcomeTour(false, storage), false);
});

test('private storage does not block the tour or undo a dismissal in this session', async () => {
  const first = await freshModule();
  const storage = { getItem() { throw Error('Unavailable'); }, setItem() { throw Error('Unavailable'); } };
  first.queueWelcomeTour(storage);
  assert.equal(first.shouldOfferWelcomeTour(true, storage), true);
  first.finishWelcomeTour(storage);
  assert.equal(first.shouldOfferWelcomeTour(false, storage), false);
});

test('the tour leaves the first landing, sign-in, and deep links alone', () => {
  assert.equal(isWelcomeTourEntry({ pathname: '/feed', search: '?topic=All' }), true);
  for (const path of ['/login', '/register', '/rooms/invite/a', '/news', '/feed?topic=Video', '/feed', '/feed/Physics']) {
    assert.equal(isWelcomeTourEntry(new URL(path, 'https://example.test')), false);
  }
});
