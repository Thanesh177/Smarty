import test from 'node:test';
import assert from 'node:assert/strict';
import { FEED_VIEWS, getFeedView, getFeedViewDirection } from './feedViews.js';

test('the compact toggle has four destinations without a learning tab', () => {
  assert.equal(FEED_VIEWS.length, 4);
  assert(!FEED_VIEWS.some(view => view.id === 'learn'));
  for (const view of FEED_VIEWS) {
    const url = new URL(view.to, 'https://smarty.example');
    assert.equal(getFeedView(url), view.id);
  }
});
test('topic feeds and legacy video routes select the correct segment', () => {
  assert.equal(getFeedView({ pathname: '/feed', search: '?topic=Science%20%26%20Mathematics' }), 'all');
  assert.equal(getFeedView({ pathname: '/feed/News' }), 'news');
  assert.equal(getFeedView({ pathname: '/feed/Reels' }), 'video');
  assert.equal(getFeedView({ pathname: '/feed', search: '?topic=VIDEOS' }), 'video');
});
test('landing, authentication, and unrelated pages do not get a feed toggle', () => {
  for (const pathname of ['/feed', '/', '/login', '/quiz', '/news/story', '/learn', '/learn/lesson', '/feedish']) {
    assert.equal(getFeedView({ pathname }), null);
  }
});
test('content direction follows the segment order, including browser back', () => {
  assert.equal(getFeedViewDirection('all', 'video'), 1);
  assert.equal(getFeedViewDirection('saved', 'news'), -1);
  assert.equal(getFeedViewDirection('learn', 'learn'), 0);
  assert.equal(getFeedViewDirection(null, 'all'), 0);
  assert.equal(getFeedViewDirection('all', null), 0);
});
