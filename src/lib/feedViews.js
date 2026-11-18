export const FEED_VIEWS = [
  { id: 'all', label: 'All posts', compactLabel: 'All posts', to: '/feed?topic=All' },
  { id: 'news', label: 'News', compactLabel: 'News', to: '/feed?topic=News' },
  { id: 'video', label: 'Videos', compactLabel: 'Videos', to: '/feed?topic=Video' },
];

export function feedLaunchTarget({ search = '', hash = '' } = {}) {
  const params = new URLSearchParams(search);
  if (!params.get('topic')?.trim()) params.set('topic', 'All');
  return { pathname: '/feed', search: `?${params}`, hash };
}

export function getFeedView({ pathname = '', search = '' } = {}) {
  if (pathname !== '/feed' && !pathname.startsWith('/feed/')) return null;
  const pathTopic = pathname.startsWith('/feed/') ? pathname.slice(6) : '';
  const topic = (new URLSearchParams(search).get('topic') || pathTopic).trim().toLowerCase();
  // The bare feed URL redirects before displaying a feed view.
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
