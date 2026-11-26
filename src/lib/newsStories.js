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
      if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || seen.has(url.href)) return false;
      seen.add(url.href);
      return true;
    } catch { return false; }
  }).map(article => ({ ...article, title: article.title.trim(), source: typeof article.source === 'string' && article.source.trim() ? article.source.trim() : 'Original report' }))
    .sort((a, b) => (Date.parse(a.published_at) - Date.parse(b.published_at)) * (order === 'newest' ? -1 : 1));
}

export function normalizeStoryTimeline(value, expectedQuery = '') {
  if (value?.kind !== 'story-timeline' || !Array.isArray(value.articles)) {
    throw new Error('Story coverage is temporarily unavailable. Please try again.');
  }
  const query = cleanStoryQuery(value.query);
  if (query && expectedQuery && query.toLowerCase() !== cleanStoryQuery(expectedQuery).toLowerCase()) {
    throw new Error('This coverage belongs to a different story. Please try again.');
  }
  const text = value => typeof value === 'string' ? value : '';
  return { ...value, query, articles: timelineArticles(value.articles).slice(0, 1000),
    coverageNote: text(value.coverageNote), notice: text(value.notice), updatedAt: text(value.updatedAt),
    cacheStatus: ['fresh', 'fresh-cache', 'stale-cache'].includes(value.cacheStatus) ? value.cacheStatus : '' };
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

const EVENT_STOP = new Set([...OMIT, ...'today yesterday report reports reporting reportedly officials official according told also during been was were it not'.split(' ')]);
const EVENT_VERBS = new Map([
  ...['approve', 'approves', 'approved', 'approval', 'backs'].map(word => [word, 'approve']),
  ...['reject', 'rejects', 'rejected', 'rejection'].map(word => [word, 'reject']),
  ...['resume', 'resumes', 'resumed', 'restart', 'restarts'].map(word => [word, 'resume']),
  ...['launch', 'launches', 'launched', 'launching'].map(word => [word, 'launch']),
  ...['halt', 'halts', 'halted', 'suspend', 'suspends', 'suspended'].map(word => [word, 'halt']),
  ...['rise', 'rises', 'rose', 'rising', 'increase', 'increases', 'increased'].map(word => [word, 'increase']),
  ...['fall', 'falls', 'fell', 'falling', 'decrease', 'decreases', 'decreased'].map(word => [word, 'decrease']),
  ...['win', 'wins', 'won'].map(word => [word, 'win']),
  ...['lose', 'loses', 'lost'].map(word => [word, 'lose']),
]);
function eventSignature(article) {
  const title = article.title.normalize('NFKC');
  const words = title.toLocaleLowerCase().match(/[\p{L}\p{N}]+/gu) || [];
  const tokens = new Set(words.filter(word => word.length > 2 && !EVENT_STOP.has(word)).map(word => EVENT_VERBS.get(word) || word));
  const entities = new Set((title.match(/\b[A-Z][a-z]+\b|\b[A-Z]{2,}\b/g) || [])
    .map(word => word.toLowerCase()).filter(word => tokens.has(word) && !EVENT_VERBS.has(word)));
  return { tokens, entities, numbers: (title.match(/\d+(?:[.,]\d+)*/g) || []).join('|'),
    negative: /\b(not|no|denies|denied|false|without)\b/i.test(title),
    tentative: /\b(may|might|could|expected|proposed|potential|likely|considering|considers|planning|plans)\b/i.test(title),
    day: new Date(article.published_at).toISOString().slice(0, 10),
    exact: title.toLocaleLowerCase().replace(/\s+/g, ' ').trim() };
}
function sameReportedEvent(left, right) {
  if (left.day !== right.day) return false;
  if (left.exact === right.exact) return true;
  if (left.numbers !== right.numbers || left.negative !== right.negative || left.tentative !== right.tentative
    || Math.min(left.tokens.size, right.tokens.size) < 5) return false;
  // Names/actions must not change merely because the rest of a headline looks
  // similar. Ambiguous matches remain separate instead of inventing a timeline.
  for (const word of left.entities) if (!right.tokens.has(word)) return false;
  for (const word of right.entities) if (!left.tokens.has(word)) return false;
  for (const word of ['approve', 'reject', 'resume', 'launch', 'halt', 'increase', 'decrease', 'win', 'lose']) {
    if (left.tokens.has(word) !== right.tokens.has(word)) return false;
  }
  const shared = [...left.tokens].filter(word => right.tokens.has(word)).length;
  return shared >= 5 && shared / Math.min(left.tokens.size, right.tokens.size) >= .8
    && shared / Math.max(left.tokens.size, right.tokens.size) >= .68;
}

// Conservative same-day reporting clusters, not verified factual event chains.
// Complete-link matching prevents A~B~C from merging unrelated A and C reports.
export function groupStoryReports(articles) {
  const groups = [];
  for (const article of Array.isArray(articles) ? articles.slice(0, 1000) : []) {
    if (typeof article?.title !== 'string' || !article.title.trim() || !Number.isFinite(Date.parse(article.published_at))) continue;
    const signature = eventSignature(article);
    const group = groups.find(group => group.signatures.length < 16
      && group.signatures.every(prior => sameReportedEvent(prior, signature)));
    if (group) { group.reports.push(article); group.signatures.push(signature); }
    else groups.push({ ...article, groupId: `${signature.day}|${signature.exact}|${groups.length}`, reports: [article], signatures: [signature] });
  }
  return groups.map(({ signatures, ...group }) => ({ ...group,
    matchMethod: signatures.every(item => item.exact === signatures[0].exact) ? 'same-headline' : 'similar-reporting' }));
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
