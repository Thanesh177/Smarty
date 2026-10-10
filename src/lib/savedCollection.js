import { contentList, filterContent } from './communityContent.js';
import { getPostVideoUrl } from './videoFeed.js';

export function savedContentKind(post) { return getPostVideoUrl(post) ? 'video' : 'read'; }
export function filterSavedCollection(posts, { kind = 'all', ...filters } = {}) {
  const matches = filterContent(posts.filter(post => kind === 'all' || savedContentKind(post) === kind), filters);
  if (filters.sort === 'title') return matches;
  const time = post => {
    const value = post.savedAt || post.createdAt;
    if (typeof value === 'number' || (typeof value === 'string' && /^\d+$/.test(value))) {
      const number = Number(value); return number < 1e12 ? number * 1000 : number;
    }
    return Date.parse(value) || 0;
  };
  return matches.sort((a, b) => (time(b) - time(a)) * (filters.sort === 'oldest' ? -1 : 1));
}
export function normalizeSavedCollection(response) {
  let value = response;
  for (let depth = 0; depth < 3; depth += 1) {
    if (typeof value === 'string') { value = JSON.parse(value); continue; }
    if (value?.success === false || value?.error) throw new Error('Saved posts could not be loaded.');
    if (value && typeof value.body === 'string' && (value.statusCode || Object.keys(value).length === 1)) {
      if (value.statusCode && Number(value.statusCode) >= 400) throw new Error('Saved posts could not be loaded.');
      value = value.body; continue;
    }
    return contentList(Array.isArray(value?.savedReels) ? value.savedReels : Array.isArray(value?.data) ? value.data : value);
  }
  throw new Error('Saved posts could not be loaded.');
}
