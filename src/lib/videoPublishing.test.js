import test from 'node:test';
import assert from 'node:assert/strict';
import { VIDEO_TOPICS, getVideoTopic, matchesVideoTopic, videoFeedPath, videoTopicLabel } from '../data/videoTopics.js';
import { isVideoTopicPost } from './videoFeed.js';
import { readPostDraft, savePostDraft } from './postDraft.js';
import { normalizeVideoUpload, validateStudioVideo, videoPostPayload, videoUploadType } from './videoPublishing.js';

test('dedicated video topics round trip through the existing post topic field', () => {
  assert.equal(new Set(VIDEO_TOPICS.map(topic => topic.id)).size, VIDEO_TOPICS.length);
  for (const topic of VIDEO_TOPICS) {
    const post = { topic: videoTopicLabel(topic), videoUrl: '/example.mp4' };
    assert.equal(getVideoTopic(topic.id), topic);
    assert(isVideoTopicPost(post));
    assert(matchesVideoTopic(post, topic.id));
    assert(!matchesVideoTopic(post, 'different'));
    assert.match(videoFeedPath(topic.id), /^\/feed\?topic=Video&category=/);
  }
  assert(matchesVideoTopic({ topic: 'Video' }, ''));
  assert(!matchesVideoTopic({ topic: 'Video' }, 'science'));
  assert(!isVideoTopicPost({ topic: 'Science' }));
});

test('the studio accepts known video types and checks file size before uploading', () => {
  assert.equal(videoUploadType({ name: 'demo.MOV', type: 'application/octet-stream' }), 'video/quicktime');
  assert.equal(validateStudioVideo({ type: '', name: 'demo.mp4', size: 600 }), '');
  assert.match(validateStudioVideo({ type: 'image/png', name: 'demo.mp4', size: 600 }), /Choose a video/);
  assert.match(validateStudioVideo({ type: 'video/mp4', size: 0 }), /empty/);
  assert.match(validateStudioVideo({ type: 'video/mp4', size: 251 * 1024 * 1024 }), /250 MB/);
});

test('upload confirmation accepts the deployed response shapes but refuses malformed destinations', () => {
  const value = { uploadUrl: 'https://media.example/signed', publicUrl: 'https://media.example/example.mp4', fileKey: 'clips/example.mp4' };
  assert.deepEqual(normalizeVideoUpload({ statusCode: 200, body: JSON.stringify(value) }), {
    uploadUrl: value.uploadUrl, fileUrl: value.publicUrl, key: value.fileKey,
  });
  for (const invalid of ['not json', { ...value, statusCode: 403 }, { ...value, uploadUrl: 'javascript:alert(1)' }, { ...value, uploadUrl: 'https://x:y@media.example/signed' }]) {
    assert.throws(() => normalizeVideoUpload(invalid), /couldn’t start/);
  }
});

test('video payload preserves audience and optional cover without changing backend fields', () => {
  const post = videoPostPayload({
    id: 'retry-id', draft: { title: '  One idea ', body: '', visibility: 'private' },
    topic: getVideoTopic('science'), video: { key: 'v.mp4', fileUrl: '' }, cover: { key: 'cover.jpg', fileUrl: '' },
  });
  assert.equal(post.id, 'retry-id');
  assert.equal(post.visibility, 'private');
  assert.equal(post.body, 'One idea');
  assert.equal(post.videoKey, 'v.mp4');
  assert.equal(post.thumbKey, 'cover.jpg');
  assert(matchesVideoTopic(post, 'science'));
});

test('video text drafts are separate from text-post drafts and other accounts', () => {
  const values = new Map();
  const storage = { setItem: (key, value) => values.set(key, value), getItem: key => values.get(key), removeItem: key => values.delete(key) };
  savePostDraft('member', { title: 'Text post' }, storage);
  savePostDraft('video:member', { title: 'Video draft', topic: 'science' }, storage);
  assert.equal(readPostDraft('member', storage).title, 'Text post');
  assert.equal(readPostDraft('video:member', storage).topic, 'science');
  assert.equal(readPostDraft('video:another-member', storage).title, '');
});
