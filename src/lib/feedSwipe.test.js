import test from 'node:test';
import assert from 'node:assert/strict';
import { swipeDestination, swipeTargetAllowed } from './feedSwipe.js';

test('horizontal swipes follow toggle order without wrapping at the edges', () => {
  assert.equal(swipeDestination('all', { dx: -90, dy: 8 })?.id, 'news');
  assert.equal(swipeDestination('news', { dx: -90, dy: 8 })?.id, 'video');
  assert.equal(swipeDestination('saved', { dx: 90, dy: 8 })?.id, 'video');
  assert.equal(swipeDestination('all', { dx: 90, dy: 8 }), null);
  assert.equal(swipeDestination('saved', { dx: -90, dy: 8 }), null);
});
test('vertical scroll, taps, multitouch, and held gestures never switch views', () => {
  for (const gesture of [{ dx: 20, dy: 0 }, { dx: -70, dy: 90 }, { dx: -90, dy: 2, touches: 2 }, { dx: -90, dy: 2, elapsed: 1600 }]) assert.equal(swipeDestination('all', gesture), null);
  assert.equal(swipeDestination(null, { dx: -100, dy: 0 }), null);
});

test('interactive controls and horizontal carousels keep their own gestures', () => {
  const original = globalThis.getComputedStyle;
  globalThis.getComputedStyle = element => ({ overflowX: element.overflow || 'visible' });
  const target = match => ({ closest: selector => match(selector), clientWidth: 100, scrollWidth: 100 });
  try {
    for (const control of ['input', 'video', 'audio', '[data-no-feed-swipe]', '[role="dialog"]']) {
      assert.equal(swipeTargetAllowed(target(selector => selector.includes(control)), null), false);
    }
    assert.equal(swipeTargetAllowed(target(selector => selector.startsWith('button,a') ? {} : null), null), false);
    assert.equal(swipeTargetAllowed(target(selector => selector === '.feed-view-switch' ? {} : null), null), true);
    const card = target(() => null);
    assert.equal(swipeTargetAllowed(card, null), true);
    card.parentElement = { scrollWidth: 500, clientWidth: 100, overflow: 'auto' };
    assert.equal(swipeTargetAllowed(card, null), false);
  } finally {
    if (original === undefined) delete globalThis.getComputedStyle;
    else globalThis.getComputedStyle = original;
  }
});
