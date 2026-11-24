import test from 'node:test';
import assert from 'node:assert/strict';
import { vocabularyPanelPosition, manageVocabularyDialog } from './postVocabularyDialog.js';
import { subscribePostVocabulary } from './postVocabularyEvents.js';

function eventTarget() {
  const events = new Map();
  return {
    events,
    addEventListener(name, fn) { if (!events.has(name)) events.set(name, new Set()); events.get(name).add(fn); },
    removeEventListener(name, fn) { events.get(name)?.delete(fn); if (!events.get(name)?.size) events.delete(name); },
    emit(name, event = {}) { for (const fn of [...events.get(name) || []]) fn(event); },
  };
}
function harness() {
  const content = { style: { overflowY: 'auto' } };
  const shell = { inert: false, querySelector: () => content };
  const doc = { ...eventTarget(), body: { style: { overflow: 'clip' } }, querySelector: () => shell, activeElement: null };
  const view = { ...eventTarget(), visualViewport: eventTarget() };
  const element = () => ({ isConnected: true, getClientRects: () => [{}], focus() { doc.activeElement = this; } });
  const trigger = element(), button = element();
  const panel = { ...element(), querySelectorAll: () => [button], contains: target => target === panel || target === button };
  let closed = 0;
  const cleanup = manageVocabularyDialog({ panel, trigger, onClose: () => { closed++; }, doc, view });
  const key = (name, options = {}) => {
    const event = { key: name, prevented: false, stopped: false, preventDefault() { this.prevented = true; }, stopImmediatePropagation() { this.stopped = true; }, ...options };
    view.emit('keydown', event); return event;
  };
  return { doc, view, shell, content, trigger, panel, button, cleanup, key, get closed() { return closed; } };
}

test('the dialog makes the background inert and restores the exact prior page state', () => {
  const app = harness();
  assert.equal(app.shell.inert, true);
  assert.equal(app.doc.body.style.overflow, 'hidden');
  assert.equal(app.content.style.overflowY, 'hidden');
  assert.equal(app.doc.activeElement, app.panel);
  app.cleanup();
  assert.equal(app.shell.inert, false);
  assert.equal(app.doc.body.style.overflow, 'clip');
  assert.equal(app.content.style.overflowY, 'auto');
  assert.equal(app.doc.activeElement, app.trigger);
  assert.equal(app.view.events.size, 0);
  assert.equal(app.view.visualViewport.events.size, 0);
  assert.equal(app.doc.events.size, 0);
});

test('Escape closes, Tab remains inside, and global search cannot open behind the dialog', () => {
  const app = harness();
  assert.equal(app.key('Tab').prevented, true);
  assert.equal(app.doc.activeElement, app.button);
  assert.equal(app.key('Tab', { shiftKey: true }).prevented, true);
  assert.equal(app.doc.activeElement, app.button);
  app.doc.activeElement = app.trigger;
  app.doc.emit('focusin', { target: app.trigger });
  assert.equal(app.doc.activeElement, app.panel);
  assert.equal(app.key('k', { metaKey: true }).stopped, true);
  const escape = app.key('Escape');
  assert.equal(escape.prevented, true);
  assert.equal(escape.stopped, true);
  assert.equal(app.closed, 1);
  app.cleanup();
});

test('long explanations can scroll without moving the page, and viewport changes dismiss safely', () => {
  const app = harness();
  const outside = { target: app.trigger, cancelable: true, prevented: false, preventDefault() { this.prevented = true; } };
  const inside = { ...outside, target: app.panel };
  const pinch = { ...outside, touches: [{}, {}] };
  app.doc.emit('touchmove', outside); app.doc.emit('touchmove', inside);
  app.doc.emit('touchmove', pinch);
  assert.equal(outside.prevented, true);
  assert.equal(inside.prevented, false);
  assert.equal(pinch.prevented, false, 'Magnification remains available');
  app.doc.emit('scroll', { target: app.panel });
  assert.equal(app.closed, 0);
  app.view.visualViewport.emit('resize');
  assert.equal(app.closed, 1);
  app.cleanup();
});

test('popover bounds respect zoomed visual viewports and short landscape screens', () => {
  for (const view of [
    { innerWidth: 390, innerHeight: 844 },
    { innerWidth: 844, innerHeight: 220 },
    { innerWidth: 390, innerHeight: 844, visualViewport: { width: 230, height: 320, offsetLeft: 80, offsetTop: 100 } },
  ]) {
    const bounds = view.visualViewport || { width: view.innerWidth, height: view.innerHeight, offsetLeft: 0, offsetTop: 0 };
    const style = vocabularyPanelPosition({ left: 800, bottom: 900 }, view);
    assert.ok(style.left >= bounds.offsetLeft + 16);
    assert.ok(style.left + style.width <= bounds.offsetLeft + bounds.width - 16);
    assert.ok(style.top >= bounds.offsetTop + 16);
    assert.ok(style.top + style.maxHeight <= bounds.offsetTop + bounds.height - 16);
  }
});

test('all post views share one ready-event listener and release it after the last unmount', () => {
  const target = eventTarget(), received = [];
  const first = subscribePostVocabulary('one', glossary => received.push(['first', glossary]), target);
  const second = subscribePostVocabulary('one', glossary => received.push(['second', glossary]), target);
  const other = subscribePostVocabulary('two', glossary => received.push(['other', glossary]), target);
  assert.equal(target.events.get('smarty-post-vocabulary-ready').size, 1);
  const glossary = { version: 1, terms: [] };
  target.emit('smarty-post-vocabulary-ready', { detail: { postId: 'one', postGlossary: glossary } });
  assert.deepEqual(received.map(entry => entry[0]), ['first', 'second']);
  first(); first(); second();
  assert.equal(target.events.get('smarty-post-vocabulary-ready').size, 1);
  other(); assert.equal(target.events.size, 0);
});
