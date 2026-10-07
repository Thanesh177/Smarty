import test from 'node:test';
import assert from 'node:assert/strict';
import { topicPickerPosition } from './topicPickerPosition.js';

function fits(position, viewport) {
  assert(position.left >= (viewport.left || 0) + 12);
  assert(position.left + position.width <= (viewport.left || 0) + viewport.width - 12);
  assert(position.top >= (viewport.top || 0) + 12);
  assert(position.top + position.maxHeight <= (viewport.top || 0) + viewport.height - 12);
}
test('phone and desktop menus stay within their viewport', () => {
  for (const width of [320, 390, 834, 1512]) {
    const viewport = {width, height:844};
    const position = topicPickerPosition({left:width - 90, top:12, bottom:56}, viewport);
    fits(position, viewport);
    assert.equal(position.top,64);
    assert.equal(position.maxHeight,440);
  }
});
test('keyboard opening and visual viewport panning keep the entire list accessible', () => {
  for (const viewport of [{width:390,height:300},{width:390,height:280,top:180},
    {width:844,height:180}, {width:390,height:160,top:300}]) {
    const position = topicPickerPosition({left:20,top:12,bottom:56},viewport);
    fits(position,viewport);
    assert(position.maxHeight < 440);
  }
});
test('picker opens above a trigger near the lower edge', () => {
  const viewport = {width:390,height:600};
  const trigger = {left:20,top:490,bottom:534};
  const position = topicPickerPosition(trigger,viewport);
  fits(position,viewport);
  assert(position.top + position.maxHeight < trigger.top);
});
