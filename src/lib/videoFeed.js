import { getPostAuthorId, getPostAuthorUsername } from './postAuthor.js';

export const getVideoPostId = post => String(post?.reelId || post?.postId || post?.id || '').trim();

export function getPostVideoUrl(post) {
  const value = typeof post?.videoUrl === 'string' ? post.videoUrl.trim() : '';
  if (!value || /[\u0000-\u001f]/.test(value)) return '';
  // A media URL is never an executable link or an embedded data payload.
  if (value.startsWith('/') && !value.startsWith('//')) return value;
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) ? value : '';
  } catch { return ''; }
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
