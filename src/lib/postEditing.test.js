import test from 'node:test';
import assert from 'node:assert/strict';
import { editPostError, editPostForm, editPostPayload, invalidateEditedFeed, normalizeEditUpload, postForEditing } from './postEditing.js';

const post = { id: 'one', title: 'How wheels work', body: 'Angular momentum.', topic: 'Physics', visibility: 'private', imageUrl: '/old.jpg', imageKey: 'old.jpg', thumbUrl: '/thumb.jpg', thumbKey: 'thumb.jpg', videoUrl: '', videoKey: '' };
test('edited feeds invalidate only the current account and tolerate blocked storage', () => {
  const removed = [];
  invalidateEditedFeed('one', { removeItem: key => removed.push(key) });
  assert.deepEqual(removed, ['smarty_cached_feed_v2:one', 'smarty_cached_feed_cursor_v2:one']);
  assert.doesNotThrow(() => invalidateEditedFeed('one', { removeItem() { throw Error('blocked'); } }));
});
test('editing accepts posts, nested posts, and explicit JSON envelopes without parsing captions', () => {
  assert.equal(postForEditing(post), post);
  assert.equal(postForEditing({ post }), post);
  assert.equal(postForEditing({ item: post }), post);
  assert.deepEqual(postForEditing({ statusCode: 200, body: JSON.stringify({ reel: post }) }), post);
  assert.throws(() => postForEditing({ success: true, item: null }), /no longer available/);
  assert.throws(() => postForEditing({ success: false }), /could not be published/);
});
test('ordinary edits preserve original media keys, thumbnail, and visibility', () => {
  const form = { ...editPostForm(post), title: 'A better headline' };
  const payload = editPostPayload('one', post, form);
  assert.equal(payload.imageUrl, '/old.jpg'); assert.equal(payload.imageKey, 'old.jpg');
  assert.equal(payload.thumbUrl, '/thumb.jpg'); assert.equal(payload.thumbKey, 'thumb.jpg');
  assert.equal(payload.visibility, 'private'); assert.equal(payload.title, form.title);
});
test('video replacement separates public URL and storage key and clears stale image media', () => {
  const upload = normalizeEditUpload({ statusCode: 200, body: JSON.stringify({ uploadUrl: 'https://upload.example/file', fileUrl: 'https://media.example/file.mp4', fileKey: 'videos/file.mp4' }) });
  const payload = editPostPayload('one', post, editPostForm(post), { file: { type: 'video/mp4' }, upload });
  assert.equal(payload.videoUrl, 'https://media.example/file.mp4'); assert.equal(payload.videoKey, 'videos/file.mp4');
  assert.equal(payload.imageUrl, ''); assert.equal(payload.imageKey, ''); assert.equal(payload.thumbUrl, '');
});
test('image replacement updates its thumbnail and clears the old video', () => {
  const payload = editPostPayload('one', { ...post, videoUrl: '/old.mp4', videoKey: 'old.mp4' }, editPostForm(post), { file: { type: 'image/png' }, upload: { fileUrl: '/new.png', key: 'new.png' } });
  assert.equal(payload.thumbUrl, '/new.png'); assert.equal(payload.thumbKey, 'new.png');
  assert.equal(payload.videoUrl, ''); assert.equal(payload.videoKey, '');
});
test('explicit removal clears every media field but ordinary text edits do not', () => {
  const payload = editPostPayload('one', post, editPostForm(post), { removeMedia: true });
  for (const key of ['imageUrl', 'imageKey', 'thumbUrl', 'thumbKey', 'videoUrl', 'videoKey']) assert.equal(payload[key], '');
  assert.equal(editPostForm({ ...post, photoUrl: '/legacy.jpg', ...payload }).imageUrl, '');
});
test('captionless videos can save; text and image posts still require content', () => {
  const form = { ...editPostForm(post), body: '' };
  assert.equal(editPostError(form, true), '');
  assert.match(editPostError(form, false), /content/);
  assert.equal(editPostPayload('one', post, form).body, post.title);
  assert.match(editPostError({ ...form, title: 'x'.repeat(141) }, true), /limits/);
});
