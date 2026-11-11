import test from 'node:test';
import assert from 'node:assert/strict';
import { scheduleStartupIdle } from './startupIdle.js';

test('background work waits for a grace period and a browser idle slot', () => {
  let called = 0, afterDelay, idle;
  const host = {
    setTimeout(fn, delay) { assert.equal(delay, 900); afterDelay = fn; return 1; },
    requestIdleCallback(fn, options) { assert.equal(options.timeout, 1200); idle = fn; return 2; },
    clearTimeout() {},
  };
  scheduleStartupIdle(() => called++, { delay: 900, host });
  assert.equal(called, 0);
  afterDelay();
  assert.equal(called, 0);
  idle();
  assert.equal(called, 1);
});

test('route changes cancel both queued stages, even if a callback was already queued', () => {
  let afterDelay, idle, called = 0;
  const cancelled = [];
  const host = {
    setTimeout(fn) { afterDelay = fn; return 1; },
    requestIdleCallback(fn) { idle = fn; return 2; },
    clearTimeout(id) { cancelled.push(id); },
    cancelIdleCallback(id) { cancelled.push(id); },
  };
  const cancel = scheduleStartupIdle(() => called++, { host });
  afterDelay();
  cancel();
  idle();
  assert.equal(called, 0);
  assert.deepEqual(cancelled, [1, 2]);
});

test('browsers without idle scheduling still run background work after the grace period', () => {
  let afterDelay, called = 0;
  scheduleStartupIdle(() => called++, {
    host: { setTimeout(fn) { afterDelay = fn; return 1; }, clearTimeout() {} },
  });
  assert.equal(called, 0);
  afterDelay();
  assert.equal(called, 1);
});
