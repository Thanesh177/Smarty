import { cleanStoryQuery } from './newsStories.js';
import { normalizeNewsPreference } from './newsPreferences.js';

// User-specific responses stay scoped in React Query. Reject broken envelopes
// and discard unusable entries before rendering or delivering notifications.
export function normalizePersonalNews(value) {
  if (!value || !Array.isArray(value.stories) || !Array.isArray(value.updates)) {
    throw new Error('Story updates are temporarily unavailable. Please try again.');
  }
  const seenStories = new Set(), seenUpdates = new Set();
  const stories = value.stories.slice(0, 250).flatMap(item => {
    if (!item || typeof item.query !== 'string' || typeof item.id !== 'string') return [];
    const query = cleanStoryQuery(item.query), identity = query.toLowerCase();
    if (query.length < 3 || !item.id || item.id.length > 200 || seenStories.has(identity)) return [];
    seenStories.add(identity);
    return [{ ...item, id: item.id.slice(0, 200), query }];
  }).slice(0, 50);
  const updates = value.updates.slice(0, 500).flatMap(item => {
    if (!item || typeof item.id !== 'string' || typeof item.query !== 'string' || typeof item.body !== 'string') return [];
    const query = cleanStoryQuery(item.query);
    if (!item.id || item.id.length > 200 || query.length < 3 || seenUpdates.has(item.id)) return [];
    seenUpdates.add(item.id);
    const readAt = typeof item.readAt === 'number' && Number.isFinite(item.readAt) && item.readAt > 0
      || typeof item.readAt === 'string' && Number.isFinite(Date.parse(item.readAt)) ? item.readAt : '';
    return [{ ...item, id: item.id.slice(0, 200), query, body: item.body.slice(0, 1500), readAt }];
  }).slice(0, 100);
  return { ...value, preferences: normalizeNewsPreference(value.preferences), stories, updates };
}
