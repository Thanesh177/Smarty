import { cleanPostTopic, POST_LIMITS } from './postDraft.js';
import { normalizePostResponse } from './postResponse.js';
import { getUserScopedStorageKey } from './userScopedStorage.js';

const text = value => typeof value === 'string' ? value : '';
export function invalidateEditedFeed(account, storage) {
  try {
    const target = storage || window.localStorage;
    for (const base of ['smarty_cached_feed_v2', 'smarty_cached_feed_cursor_v2']) {
      target.removeItem(getUserScopedStorageKey(base, account));
    }
  } catch { /* A storage restriction must not turn a saved edit into a failure. */ }
}
export function postForEditing(response) {
  const value = normalizePostResponse(response);
  const post = value.post ?? value.item ?? value.reel ?? value;
  if (!post || typeof post !== 'object' || Array.isArray(post) || !['title', 'topic', 'id', 'reelId', 'postId'].some(key => Object.hasOwn(post, key))) {
    throw new Error('This post is no longer available.');
  }
  return post;
}
export function editPostForm(post) {
  return {
    topic: text(post.topic), title: text(post.title), body: text(post.body),
    visibility: post.visibility === 'private' ? 'private' : 'public',
    imageUrl: typeof post.imageUrl === 'string' ? post.imageUrl : text(post.photoUrl || post.thumbnail || post.coverImage),
    videoUrl: text(post.videoUrl),
  };
}
export function normalizeEditUpload(response) {
  const data = normalizePostResponse(response);
  return { uploadUrl: text(data.uploadUrl || data.url || data.presignedUrl), fileUrl: text(data.fileUrl || data.publicUrl), key: text(data.key || data.fileKey || data.imageKey || data.videoKey || data.mediaKey) };
}
export function editPostError(form, hasVideo) {
  if (cleanPostTopic(form.topic).length < 2) return 'Choose or enter a topic with at least two characters.';
  if (!form.title.trim()) return 'Add a headline for your post.';
  if (!hasVideo && !form.body.trim()) return 'Add the content of your post.';
  if (form.topic.trim().length > POST_LIMITS.topic || form.title.length > POST_LIMITS.title || form.body.length > POST_LIMITS.body) return 'Shorten the text to fit the displayed limits before saving.';
  return '';
}
export function editPostPayload(id, original, form, { file = null, upload = null, removeMedia = false } = {}) {
  const payload = {
    id, reelId: id, postId: id, topic: cleanPostTopic(form.topic), title: form.title.trim(),
    body: form.body.trim() || form.title.trim(), visibility: form.visibility,
    imageUrl: form.imageUrl, imageKey: text(original.imageKey),
    thumbUrl: text(original.thumbUrl), thumbKey: text(original.thumbKey),
    videoUrl: form.videoUrl, videoKey: text(original.videoKey),
  };
  if (removeMedia || file) {
    for (const key of ['imageUrl', 'imageKey', 'thumbUrl', 'thumbKey', 'videoUrl', 'videoKey']) payload[key] = '';
  }
  if (file && upload) {
    if (file.type.startsWith('video/')) {
      payload.videoUrl = upload.fileUrl; payload.videoKey = upload.key;
    } else {
      payload.imageUrl = upload.fileUrl; payload.imageKey = upload.key;
      payload.thumbUrl = upload.fileUrl; payload.thumbKey = upload.key;
    }
  }
  return payload;
}
