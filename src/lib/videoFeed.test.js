import test from 'node:test';
import assert from 'node:assert/strict';
import { formatVideoTime, getMostVisibleVideo, getPostVideoUrl, getVideoCreatorId, getVideoCreatorName, getVideoPosts, isVideoTopic, validateVideoUpload } from './videoFeed.js';
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
  for (const value of ['javascript:alert(1)', 'data:video/mp4;base64,x', 'file:///private/x', '//external/x', 'not a URL', {}, 'https://media.example/\nvideo']) {
    assert.equal(getPostVideoUrl({ videoUrl: value }), '');
  }
  assert.equal(getPostVideoUrl({ videoUrl: '/videos/one.mp4' }), '/videos/one.mp4');
  assert.equal(getPostVideoUrl({ videoUrl: 'https://media.example/one.mp4?signature=example' }), 'https://media.example/one.mp4?signature=example');
});
test('the most visible card wins and completely offscreen cards never play', () => {
  assert.equal(getMostVisibleVideo(new Map([['one', .25], ['two', .75]]), 'one'), 'two');
  assert.equal(getMostVisibleVideo(new Map([['one', 0], ['two', 0]]), 'one'), '');
  assert.equal(getMostVisibleVideo(new Map([['one', .25]]), 'one'), 'one');
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
