const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const postcss = require('postcss');
const css = postcss.parse(fs.readFileSync(__dirname + '/../pages/VideoTopicPage.css', 'utf8'));
const rule = selector => css.nodes.find(node => node.selector === selector);
const value = (selector, property) => rule(selector)?.nodes.find(node => node.prop === property)?.value;

test('the video stage fills available width without cropping educational content', () => {
  assert.equal(value('.reel-video-stage', 'width'), '100%');
  assert.equal(value('.reel-video-stage > video, .reel-video-placeholder', 'object-fit'), 'contain');
  assert.equal(value('.reel-video-stage > video, .reel-video-placeholder', 'background'), '#000');
});

test('the scrolling preview avoids size containment and transformed controls that can leave stale frames', () => {
  assert.equal(value('.app-shell .content .video-topic-scroll', 'container-type'), undefined);
  assert.equal(value('.reel-video-bottom', 'transform'), undefined);
  assert.equal(value('.reel-video-bottom', 'margin-inline'), 'auto');
});

test('the action rail and upload controls overlay each viewport-sized clip', () => {
  assert.equal(value('.video-topic-tools', 'position'), 'absolute');
  assert.equal(value('.reel-video-actions', 'flex-direction'), 'column');
  assert.equal(value('.reel-video', 'height'), '100%');
  assert.equal(value('.reel-video', 'scroll-snap-stop'), 'always');
  assert.equal(value('.video-topic-tail', 'position'), 'absolute');
});
