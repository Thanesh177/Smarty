import { getPostAuthorId, getPostAuthorUsername } from './postAuthor.js';
import { getPublishedVideoTopic } from '../data/videoTopics.js';

export const getVideoPostId = post => String(post?.reelId || post?.postId || post?.id || '').trim();

function mediaUrl(candidate) {
  const value = typeof candidate === 'string' ? candidate.trim() : '';
  if (!value || /[\u0000-\u001f\\]/.test(value)) return '';
  if (value.startsWith('/') && !value.startsWith('//')) return value;
  try {
    const url = new URL(value);
    if (['https:', 'http:'].includes(url.protocol) && !url.username && !url.password) return value;
  } catch { /* Other renditions may still be valid. */ }
  return '';
}

export function getPostVideoSources(post) {
  return [...new Set([post?.videoPlaybackUrl, post?.video?.playbackUrl, post?.videoUrl, post?.video?.url]
    .map(mediaUrl).filter(Boolean))];
}

export const getPostVideoUrl = post => getPostVideoSources(post)[0] || '';
export const getVideoPoster = post => [post?.videoPosterUrl, post?.posterUrl, post?.thumbUrl, post?.thumbnailUrl, post?.imageUrl]
  .map(mediaUrl).find(Boolean) || '';

export const getVideoCreatorId = getPostAuthorId;
export const getVideoCreatorName = getPostAuthorUsername;

export function getVideoPosts(posts = []) {
  const seen = new Set();
  return (Array.isArray(posts) ? posts : []).filter(post => {
    const id = getVideoPostId(post);
    const visibility = String(post?.visibility || 'public').trim().toLowerCase();
    const moderation = String(post?.moderationStatus || '').trim().toLowerCase();
    const hasVideoKey = typeof post?.videoKey === 'string' && Boolean(post.videoKey.trim());
    if (!id || seen.has(id) || (!getPostVideoUrl(post) && !hasVideoKey) || !['public', 'published', '', 'null'].includes(visibility)
      || ['pending', 'pending_review', 'removed', 'rejected', 'hidden'].includes(moderation) || post?.deleted === true || post?.isPrivate === true) return false;
    seen.add(id);
    return true;
  });
}

export const VIDEO_PAGE_SIZE = 20;
const VIDEO_PAGE_SCAN_LIMIT = 4;
export const VIDEO_FEED_INTENT_EVENT = 'smarty:video-feed-intent';
export const videoCursorKey = cursor => cursor ? JSON.stringify(cursor) : '';
export const unseenVideoCursor = (cursor, seen) => cursor && !seen.has(videoCursorKey(cursor)) ? cursor : null;

export async function discoverVideoPage(fetchPage, startCursor = null) {
  let cursor = startCursor;
  const seen = new Set();
  for (let step = 0; step < VIDEO_PAGE_SCAN_LIMIT; step++) {
    seen.add(videoCursorKey(cursor));
    const page = await fetchPage(cursor);
    const items = getVideoPosts(page.items);
    cursor = unseenVideoCursor(page.nextCursor, seen);
    // The server already looked through a bounded set of indexed posts. Give
    // its cursor to the viewer even when this part of the feed had no videos.
    if (page.mediaType === 'video' || items.length || !cursor) return { items, nextCursor: cursor, count: items.length };
  }
  return { items: [], nextCursor: cursor, count: 0 };
}

export function nextVideoPreload(post, connection) {
  return getPostVideoUrl(post) || (typeof post?.videoKey === 'string' && post.videoKey.trim())
    ? videoFeedWarmPreload(connection)
    : 'none';
}

export function shouldDiscoverMoreVideos({ selected, visible, hasCursor, busy, error, activeIndex, count }) {
  return selected && visible && hasCursor && !busy && !error && activeIndex >= count - 2;
}

// All snap slots are exactly one scrollport high. At the halfway point the
// new clip wins, without observing or measuring every offscreen article.
export function videoIndexAtScroll(scrollTop, height, count) {
  if (height <= 0 || count <= 0) return 0;
  return Math.min(count - 1, Math.max(0, Math.round(scrollTop / height)));
}

// Do not speculatively fetch large MOVs on cellular or slow links. Metadata
// on those connections can still resolve dimensions and open the media host.
export function videoFeedWarmPreload(connection) {
  if (connection?.saveData || /^(?:slow-)?2g$/.test(connection?.effectiveType || '')) return 'none';
  if (connection?.type === 'cellular' || connection?.effectiveType === '3g') return 'metadata';
  return 'auto';
}

export const canWarmVideoFeed = connection => videoFeedWarmPreload(connection) !== 'none';

export const isVideoTopic = topic => ['video', 'videos', 'reels'].includes(String(topic || '').trim().toLowerCase());
export function isVideoTopicPost(post) {
  return [post?.topic, post?.topics, post?.mainTopic, post?.topicDomain, post?.category, post?.categories]
    .flat().some(topic => typeof topic === 'string' && topic.split(',')
      .some(label => isVideoTopic(label) || getPublishedVideoTopic(label)));
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
