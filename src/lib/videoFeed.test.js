import test from 'node:test';
import assert from 'node:assert/strict';
import { canWarmVideoFeed, discoverVideoPage, formatVideoTime, getMostVisibleVideo, getPostVideoUrl, getVideoCreatorId, getVideoCreatorName, getVideoPosts, isVideoTopic, isVideoTopicPost, nextVideoPreload, validateVideoUpload } from './videoFeed.js';
import { hasBufferedOpening, hasPlaybackHeadroom } from './reelPlayback.js';
import { MAIN_TOPICS, getMainTopicDefinition, postMatchesMainTopic } from '../data/topicTaxonomy.js';

test('Video is available in navigation and resolves legacy video labels', () => {
  assert(MAIN_TOPICS.some(topic => topic.label === 'Video'));
  for (const label of ['Video', 'Videos', 'Reels', ' video ']) {
    assert(isVideoTopic(label));
    assert.equal(getMainTopicDefinition(label)?.id, 'video');
  }
  assert(!isVideoTopic('News'));
});
test('Video shows media from every subject but never text-only posts', () => {
  const scienceVideo = { topic: 'Physics', topicDomain: 'Science & Mathematics', videoUrl: 'https://media.example/a.mp4' };
  assert(postMatchesMainTopic(scienceVideo, 'Video', ['Physics']));
  assert(postMatchesMainTopic(scienceVideo, 'Science & Mathematics', ['Physics']));
  assert(!postMatchesMainTopic({ topic: 'Video' }, 'Video', ['Video']));
});
test('only public, unmoderated, unique playable videos enter the viewer', () => {
  const video = { id: 'one', videoUrl: 'https://media.example/a.mp4' };
  const posts = [video, video, { id: 'text' }, { ...video, id: 'private', visibility: 'private' },
    { ...video, id: 'pending', moderationStatus: 'pending' }, { ...video, id: 'removed', moderationStatus: 'removed' },
    { ...video, id: 'deleted', deleted: true }, { ...video, id: 'approved', moderationStatus: 'approved' },
    { ...video, id: 'invalid', videoUrl: 'javascript:alert(1)' }];
  assert.deepEqual(getVideoPosts(posts).map(post => post.id), ['one', 'approved']);
});
test('media URLs reject executable, credential-like, and invalid payloads', () => {
  for (const value of ['javascript:alert(1)', 'data:video/mp4;base64,x', 'file:///private/x', '//external/x', 'not a URL', {}, 'https://media.example/\nvideo', 'https://name:password@media.example/movie.mp4']) {
    assert.equal(getPostVideoUrl({ videoUrl: value }), '');
  }
  assert.equal(getPostVideoUrl({ videoUrl: '/videos/one.mp4' }), '/videos/one.mp4');
  assert.equal(getPostVideoUrl({ videoUrl: 'https://media.example/one.mp4?signature=example' }), 'https://media.example/one.mp4?signature=example');
  assert.equal(getPostVideoUrl({ videoPlaybackUrl: '/lighter.mp4', videoUrl: '/original.mov' }), '/lighter.mp4');
  assert.equal(getPostVideoUrl({ videoPlaybackUrl: 'javascript:alert(1)', videoUrl: '/original.mov' }), '/original.mov');
  assert.equal(getPostVideoUrl({ videoUrl: '/\\example.invalid/movie.mp4' }), '');
});

test('video discovery follows the mixed-feed cursor before exposing an empty page', async () => {
  const calls = [];
  const video = { id: 'clip', videoUrl: '/sample.mov' };
  const page = await discoverVideoPage(async cursor => {
    calls.push(cursor);
    return cursor ? { items: [video], nextCursor: 'next' } : { items: [{ id: 'text' }], nextCursor: 'more' };
  });
  assert.deepEqual(calls, [null, 'more']);
  assert.deepEqual(page, { items: [video], nextCursor: 'next', count: 1 });
});

test('discovery limits requests and terminates repeated cursor loops', async () => {
  let pages = 0;
  assert.equal((await discoverVideoPage(async () => ({ items: [], nextCursor: String(++pages) }))).nextCursor, '4');
  assert.equal(pages, 4);
  assert.equal((await discoverVideoPage(async () => ({ items: [], nextCursor: 'same' }), 'same')).nextCursor, null);
});

test('next clip warming waits for playback headroom and respects slow links and data saving', () => {
  const video = { paused: false, currentTime: 1, readyState: 4, duration: 20,
    buffered: { length: 1, start: () => 0, end: () => 5.5 } };
  assert.equal(hasPlaybackHeadroom(video), true);
  assert.equal(hasPlaybackHeadroom({ ...video, currentTime: 3 }), false);
  assert.equal(hasPlaybackHeadroom({ ...video, paused: true }), false);
  assert.equal(nextVideoPreload({ videoUrl: '/large.mov' }, { effectiveType: '4g', downlink: 15 }), 'auto');
  assert.equal(nextVideoPreload({ videoUrl: '/small.mp4', videoBytes: 2000 }), 'auto');
  assert.equal(nextVideoPreload({ videoUrl: '/small.mp4', videoBytes: 2000 }, { saveData: true }), 'none');
  assert.equal(nextVideoPreload({ videoUrl: '/unknown.mp4' }), 'auto');
  assert.equal(nextVideoPreload({ videoUrl: '/unknown.mp4' }, { effectiveType: '3g' }), 'metadata');
  assert.equal(nextVideoPreload({ videoUrl: '/unknown.mp4' }, { effectiveType: 'slow-2g' }), 'none');
});

test('warming the unopened Videos tab skips data saver, known cellular and slow links', () => {
  assert.equal(canWarmVideoFeed({ effectiveType: '4g', type: 'wifi' }), true);
  assert.equal(canWarmVideoFeed(undefined), true);
  for (const connection of [{ saveData: true }, { effectiveType: '4g', type: 'cellular' }, { effectiveType: '3g' }, { effectiveType: 'slow-2g' }]) {
    assert.equal(canWarmVideoFeed(connection), false);
  }
});

test('a warm clip needs an actual contiguous opening, not just metadata or a later buffered range', () => {
  const buffered = (start, end) => ({ length: 1, start: () => start, end: () => end });
  assert.equal(hasBufferedOpening({ readyState: 1, duration: 10, buffered: buffered(0, 5) }), false);
  assert.equal(hasBufferedOpening({ readyState: 3, duration: 10, buffered: buffered(2, 6) }), false);
  assert.equal(hasBufferedOpening({ readyState: 3, duration: 10, buffered: buffered(0, 1) }), false);
  assert.equal(hasBufferedOpening({ readyState: 3, duration: 10, buffered: buffered(0, 3) }), true);
  assert.equal(hasBufferedOpening({ readyState: 3, duration: 1.5, buffered: buffered(0, 1.5) }), true);
});
test('the most visible card wins and completely offscreen cards never play', () => {
  assert.equal(getMostVisibleVideo(new Map([['one', .25], ['two', .75]]), 'one'), 'two');
  assert.equal(getMostVisibleVideo(new Map([['one', 0], ['two', 0]]), 'one'), '');
  assert.equal(getMostVisibleVideo(new Map([['one', .25]]), 'one'), '');
});
test('All posts excludes Video-topic aliases but retains videos in other learning subjects', () => {
  for (const post of [{ topic: 'Video' }, { topic: ['Physics', 'Reels'] }, { topic: 'Physics,Video' }, { topicDomain: 'Videos' }, { category: 'video' }, { categories: ['Reels'] }]) assert(isVideoTopicPost(post));
  assert(!isVideoTopicPost({ topic: 'Physics', videoUrl: '/science.mp4' }));
  assert(!isVideoTopicPost({ topic: 'Video editing techniques' }));
});
test('video upload has a specific supported-container check', () => {
  assert.match(validateVideoUpload({ type: 'image/png' }), /Choose a video/);
  assert.match(validateVideoUpload({ type: 'video/x-msvideo' }), /MP4/);
  for (const type of ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-m4v']) assert.equal(validateVideoUpload({ type }), '');
});
test('creator data is resolved safely and video times are bounded', () => {
  assert.equal(getVideoCreatorName({ author: { name: 'Sam' } }), 'Sam');
  assert.equal(getVideoCreatorId({ authorId: 'sam' }), 'sam');
  assert.equal(getVideoCreatorName({ author: {} }), 'Smarty member');
  assert.equal(formatVideoTime(65.7), '1:05');
  assert.equal(formatVideoTime(Infinity), '0:00');
  assert.equal(formatVideoTime(-4), '0:00');
});
