export const FEED_VIEWS = [
  { id: 'all', label: 'All posts', compactLabel: 'All posts', to: '/feed?topic=All' },
  { id: 'learn', label: 'My learning', compactLabel: 'Learn', to: '/learn' },
  { id: 'news', label: 'News', compactLabel: 'News', to: '/feed?topic=News' },
  { id: 'video', label: 'Videos', compactLabel: 'Videos', to: '/feed?topic=Video' },
  { id: 'saved', label: 'Saved', compactLabel: 'Saved', to: '/saved' },
];

export function getFeedView({ pathname = '', search = '' } = {}) {
  if (pathname === '/learn') return 'learn';
  if (pathname === '/saved') return 'saved';
  if (pathname !== '/feed' && !pathname.startsWith('/feed/')) return null;
  const pathTopic = pathname.startsWith('/feed/') ? pathname.slice(6) : '';
  const topic = (new URLSearchParams(search).get('topic') || pathTopic).trim().toLowerCase();
  // The first-visit landing and unrelated routes retain their own navigation.
  if (!topic) return null;
  if (topic === 'news') return 'news';
  if (['video', 'videos', 'reels'].includes(topic)) return 'video';
  return 'all';
}

export function getFeedViewDirection(previous, next) {
  const before = FEED_VIEWS.findIndex(view => view.id === previous);
  const after = FEED_VIEWS.findIndex(view => view.id === next);
  return before < 0 || after < 0 ? 0 : Math.sign(after - before);
}
