const OMIT = new Set('the a an in on at of to and or for with from after before amid as by over under says said new latest live updates update news how why what this that more about against into has have is are its their will could would'.split(' '));

export function cleanStoryQuery(value) {
  return String(value || '').replace(/[^\p{L}\p{N}\s'-]/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, 100);
}

// These are search suggestions, not factual or AI-generated event histories.
export function storyQuery(story) {
  if (story?.storyQuery) return cleanStoryQuery(story.storyQuery);
  const title = String(story?.title || '');
  const patterns = [
    [/\b(gaza|hamas)\b/i, 'Israel Gaza'],
    [/\bukrain\w*\b/i, 'Ukraine'],
    [/\b(sudan|darfur)\b/i, 'Sudan'],
    [/\bchatgpt\b/i, 'ChatGPT'],
    [/\bopenai\b/i, 'OpenAI'],
    [/\bartificial intelligence\b/i, 'artificial intelligence'],
    [/\bstarship\b/i, 'SpaceX Starship'],
    [/\bspacex\b/i, 'SpaceX'],
    [/\b(chandrayaan)\b/i, 'Chandrayaan'],
  ];
  for (const [pattern, query] of patterns) if (pattern.test(title)) return query;
  return cleanStoryQuery(title).split(' ').filter(word => word.length > 2 && !OMIT.has(word.toLowerCase())).slice(0, 4).join(' ');
}

export function storyTimelineUrl(story) {
  const query = storyQuery(story);
  return query.length >= 3 ? `/news/story?${new URLSearchParams({ q: query })}` : null;
}

export function timelineArticles(articles, order = 'oldest') {
  const seen = new Set();
  return (Array.isArray(articles) ? articles : []).filter(article => {
    if (typeof article?.title !== 'string' || !article.title.trim() || !Number.isFinite(Date.parse(article.published_at))) return false;
    try {
      const url = new URL(article.news_link);
      if (!['https:', 'http:'].includes(url.protocol) || seen.has(url.href)) return false;
      seen.add(url.href);
      return true;
    } catch { return false; }
  }).map(article => ({ ...article, title: article.title.trim(), source: typeof article.source === 'string' && article.source.trim() ? article.source.trim() : 'Original report' }))
    .sort((a, b) => (Date.parse(a.published_at) - Date.parse(b.published_at)) * (order === 'newest' ? -1 : 1));
}

export function storyPeriod(params, now = new Date()) {
  const requested = String(params.get('year') || 'recent');
  const year = /^\d{4}$/.test(requested) && Number(requested) >= 2000 && Number(requested) <= now.getUTCFullYear() ? requested : 'recent';
  const requestedMonth = Number(params.get('month'));
  const lastMonth = Number(year) === now.getUTCFullYear() ? now.getUTCMonth() + 1 : 12;
  const month = year !== 'recent' && Number.isInteger(requestedMonth) && requestedMonth >= 1 && requestedMonth <= lastMonth ? String(requestedMonth) : 'all';
  return { year, month, order: params.get('order') === 'newest' ? 'newest' : 'oldest' };
}

export function reportKey(article) {
  return String(article.id || article.news_link || '');
}

// Group only identical headlines on the same UTC day, not inferred events.
export function groupStoryReports(articles) {
  const groups = new Map();
  for (const article of articles) {
    const key = `${new Date(article.published_at).toISOString().slice(0, 10)}|${article.title.trim().toLocaleLowerCase().replace(/\s+/g, ' ')}`;
    if (groups.has(key)) groups.get(key).reports.push(article);
    else groups.set(key, { ...article, groupId: key, reports: [article] });
  }
  return [...groups.values()];
}

export function filterStoryReports(groups, { text = '', publisher = '', unopened = false } = {}, opened = new Set()) {
  const terms = text.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return groups.flatMap(group => {
    if (unopened && group.reports.some(report => opened.has(reportKey(report)))) return [];
    const matches = group.reports.filter(report => (!publisher || (report.source || 'Original report') === publisher)
      && terms.every(term => `${report.title} ${report.source || ''}`.toLocaleLowerCase().includes(term)));
    return matches.length ? [{ ...group, ...matches[0], reports: matches }] : [];
  });
}
