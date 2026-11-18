import test from 'node:test';
import assert from 'node:assert/strict';
import { FEED_VIEWS, feedLaunchTarget, getFeedView, getFeedViewDirection } from './feedViews.js';

test('the compact toggle has three destinations without learning or saved tabs', () => {
  assert.equal(FEED_VIEWS.length, 3);
  assert(!FEED_VIEWS.some(view => ['learn', 'saved'].includes(view.id)));
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
test('entry redirects, authentication, and unrelated pages do not get a feed toggle', () => {
  for (const pathname of ['/feed', '/', '/login', '/quiz', '/news/story', '/learn', '/learn/lesson', '/feedish', '/saved']) {
    assert.equal(getFeedView({ pathname }), null);
  }
});
test('root and bare feed open All posts without a first-visit flag', () => {
  for (const path of ['/', '/feed', '/feed?topic=%20']) {
    assert.deepEqual(feedLaunchTarget(new URL(path, 'https://smarty.example')), {
      pathname: '/feed', search: '?topic=All', hash: '',
    });
  }
});
test('the launch target retains an explicit topic and other link parameters', () => {
  const target = feedLaunchTarget({ search: '?topic=News&country=IN', hash: '#reports' });
  assert.equal(getFeedView(target), 'news');
  assert.deepEqual(target, { pathname: '/feed', search: '?topic=News&country=IN', hash: '#reports' });
});
test('content direction follows the segment order, including browser back', () => {
  assert.equal(getFeedViewDirection('all', 'video'), 1);
  assert.equal(getFeedViewDirection('video', 'news'), -1);
  assert.equal(getFeedViewDirection('saved', 'news'), 0);
  assert.equal(getFeedViewDirection('learn', 'learn'), 0);
  assert.equal(getFeedViewDirection(null, 'all'), 0);
  assert.equal(getFeedViewDirection('all', null), 0);
});
