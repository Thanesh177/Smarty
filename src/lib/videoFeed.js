import { getPostAuthorId, getPostAuthorUsername } from './postAuthor.js';

export const getVideoPostId = post => String(post?.reelId || post?.postId || post?.id || '').trim();

export function getPostVideoUrl(post) {
  for (const candidate of [post?.videoPlaybackUrl, post?.videoUrl]) {
    const value = typeof candidate === 'string' ? candidate.trim() : '';
    if (!value || /[\u0000-\u001f\\]/.test(value)) continue;
    if (value.startsWith('/') && !value.startsWith('//')) return value;
    try {
      const url = new URL(value);
      if (['https:', 'http:'].includes(url.protocol) && !url.username && !url.password) return value;
    } catch { /* Try the original when an optimized rendition is unavailable. */ }
  }
  return '';
}

export const getVideoCreatorId = getPostAuthorId;
export const getVideoCreatorName = getPostAuthorUsername;

export function getVideoPosts(posts = []) {
  const seen = new Set();
  return posts.filter(post => {
    const id = getVideoPostId(post);
    const visibility = String(post?.visibility || 'public').toLowerCase();
    const moderation = String(post?.moderationStatus || '').toLowerCase();
    if (!id || seen.has(id) || !getPostVideoUrl(post) || !['public', 'published', '', 'null'].includes(visibility)
      || ['pending', 'removed'].includes(moderation) || post?.deleted === true) return false;
    seen.add(id);
    return true;
  });
}

export const VIDEO_PAGE_SIZE = 20;
const VIDEO_PAGE_SCAN_LIMIT = 4;
export async function discoverVideoPage(fetchPage, startCursor = null) {
  let cursor = startCursor;
  const seen = new Set();
  for (let step = 0; step < VIDEO_PAGE_SCAN_LIMIT; step++) {
    seen.add(JSON.stringify(cursor));
    const page = await fetchPage(cursor);
    const items = getVideoPosts(page.items);
    cursor = page.nextCursor || null;
    if (cursor && seen.has(JSON.stringify(cursor))) cursor = null;
    if (items.length || !cursor) return { items, nextCursor: cursor, count: items.length };
  }
  return { items: [], nextCursor: cursor, count: 0 };
}

export function nextVideoPreload(post, connection) {
  if (!getPostVideoUrl(post) || connection?.saveData || /^(?:slow-)?2g$/.test(connection?.effectiveType || '')) return 'none';
  if (connection?.effectiveType === '3g') return 'metadata';
  // Even large legacy MOVs need media bytes, not just their dimensions.
  // Only the immediate successor gets this hint, once the current video is safe.
  return 'auto';
}

export function getMostVisibleVideo(entries) {
  const visible = [...entries].filter(([, ratio]) => ratio >= 0.5);
  visible.sort((a, b) => b[1] - a[1]);
  return visible[0]?.[0] || '';
}

export const isVideoTopic = topic => ['video', 'videos', 'reels'].includes(String(topic || '').trim().toLowerCase());
export function isVideoTopicPost(post) {
  return [post?.topic, post?.topics, post?.mainTopic, post?.topicDomain, post?.category, post?.categories]
    .flat().some(topic => typeof topic === 'string' && topic.split(',').some(isVideoTopic));
}

export function validateVideoUpload(file) {
  if (!file?.type?.startsWith('video/')) return 'Choose a video for the Video feed.';
  if (!['video/mp4', 'video/quicktime', 'video/webm', 'video/x-m4v'].includes(file.type.toLowerCase())) {
    return 'Choose an MP4, MOV, or WebM video. MP4 with H.264 works best across devices.';
  }
  return '';
}

export const formatVideoTime = seconds => {
  const total = Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0;
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
};
