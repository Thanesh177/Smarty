import test from 'node:test';
import assert from 'node:assert/strict';
import { createActionConfirmation, assertActionAccepted } from './actionConfirmation.js';

test('confirmation does not approve until the user explicitly confirms', async () => {
  const controller = createActionConfirmation();
  const states = [];
  controller.subscribe(value => states.push(value));
  const result = controller.request({ title: 'Delete post?', confirmLabel: 'Delete post' });
  assert.equal(states[0].title, 'Delete post?');
  assert.equal(states[0].danger, true);
  controller.finish(true);
  assert.equal(await result, true);
  assert.equal(states.at(-1), null);
});

test('cancellation and duplicate clicks never authorize destructive actions', async () => {
  const controller = createActionConfirmation();
  const first = controller.request({ title: 'Delete message?' });
  assert.equal(await controller.request({ title: 'Duplicate request' }), false);
  controller.cancel();
  assert.equal(await first, false);
  controller.finish(true);
  const next = controller.request({ title: 'Leave room?', danger: false });
  controller.finish('true');
  assert.equal(await next, false, 'Only the boolean true approves an action');
});

test('a canceled request can be retried and subscriptions are released', async () => {
  const controller = createActionConfirmation();
  let notifications = 0;
  const unsubscribe = controller.subscribe(() => notifications++);
  const canceled = controller.request();
  controller.cancel();
  assert.equal(await canceled, false);
  unsubscribe();
  const retried = controller.request({ title: 'Remove member?' });
  controller.finish(true);
  assert.equal(await retried, true);
  assert.equal(notifications, 2);
});

test('a rejected success payload is not mistaken for a completed deletion', () => {
  assert.throws(() => assertActionAccepted({ success: false }));
  assert.throws(() => assertActionAccepted({ data: { success: false } }));
  assert.doesNotThrow(() => assertActionAccepted({ success: true }));
  assert.doesNotThrow(() => assertActionAccepted({ deleted: true }));
});
