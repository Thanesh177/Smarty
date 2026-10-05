export const EMPTY_POST = { topic: '', title: '', body: '', visibility: 'public' };
export const POST_LIMITS = { topic: 60, title: 140, body: 5000 };

export function cleanPostTopic(value) {
  return String(value || '').replace(/[\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim().slice(0, POST_LIMITS.topic);
}

export function normalizePostDraft(value = {}) {
  const text = (key) => typeof value?.[key] === 'string' ? value[key].slice(0, POST_LIMITS[key]) : '';
  return { topic: text('topic'), title: text('title'), body: text('body'), visibility: value?.visibility === 'private' ? 'private' : 'public' };
}

export function hasPostDraft(form) {
  return Boolean(form.topic.trim() || form.title.trim() || form.body.trim());
}

export const postDraftKey = (account) => `smarty-post-draft-v1-${encodeURIComponent(account)}`;

export function readPostDraft(account, storage) {
  try {
    const saved = JSON.parse((storage || window.localStorage).getItem(postDraftKey(account)) || 'null');
    return normalizePostDraft(saved?.form);
  } catch { return { ...EMPTY_POST }; }
}

export function savePostDraft(account, form, storage) {
  try {
    const target = storage || window.localStorage;
    const normalized = normalizePostDraft(form);
    if (hasPostDraft(normalized)) target.setItem(postDraftKey(account), JSON.stringify({ form: normalized, savedAt: Date.now() }));
    else target.removeItem(postDraftKey(account));
    return true;
  } catch { return false; }
}

export function postReadingStats(body) {
  const words = body.trim().split(/\s+/).filter(Boolean).length;
  return { words, minutes: Math.max(1, Math.ceil(words / 200)) };
}

export function validatePostMedia(file) {
  if (!file) return '';
  const type = String(file.type || '').toLowerCase();
  if (!type.startsWith('image/') && !type.startsWith('video/')) return 'Choose an image or video file.';
  if (type === 'image/svg+xml') return 'Choose a JPG, PNG, WebP, GIF, or a video instead of an SVG.';
  if (!file.size) return 'This file is empty. Choose another file.';
  const limit = type.startsWith('image/') ? 12 : 250;
  return file.size > limit * 1024 * 1024 ? `${type.startsWith('image/') ? 'Images' : 'Videos'} must be ${limit} MB or smaller.` : '';
}
