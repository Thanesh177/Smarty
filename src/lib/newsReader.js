import { safeNewsUrl } from './newsEdition.js';

export const NEWS_OPENED_LIMIT = 600;
export const newsReaderKey = account => `smarty-news-reader-v1-${encodeURIComponent(String(account || 'guest'))}`;

export function normalizeNewsReader(value) {
  const opened = new Map();
  for (const item of Array.isArray(value?.opened) ? value.opened : []) {
    const url = safeNewsUrl(item?.url);
    if (!url || !Number.isFinite(item?.at) || item.at <= 0) continue;
    opened.set(url, Math.max(opened.get(url) || 0, item.at));
  }
  return { opened: [...opened].map(([url, at]) => ({ url, at }))
    .sort((a, b) => b.at - a.at).slice(0, NEWS_OPENED_LIMIT) };
}

export function readNewsReader(account, storage = globalThis.localStorage) {
  try { return normalizeNewsReader(JSON.parse(storage.getItem(newsReaderKey(account)) || 'null')); }
  catch { return { opened: [] }; }
}

export function recordNewsOpen(state, url, now = Date.now()) {
  const safe = safeNewsUrl(url);
  if (!safe) return normalizeNewsReader(state);
  return normalizeNewsReader({ opened: [{ url: safe, at: now }, ...normalizeNewsReader(state).opened] });
}

// Deduplicate across sections too: a report can appear in more than one provider feed.
export function uniqueNewsReports(reports) {
  const seen = new Set();
  return (Array.isArray(reports) ? reports : []).flatMap(article => {
    const url = safeNewsUrl(article?.news_link);
    if (!url || typeof article?.title !== 'string' || !article.title.trim() || seen.has(url)) return [];
    seen.add(url);
    return [{ ...article, news_link: url }];
  });
}

export function balancedNewsReports(reports) {
  const groups = new Map();
  for (const article of uniqueNewsReports(reports)) {
    const section = article.section || 'World';
    if (!groups.has(section)) groups.set(section, []);
    groups.get(section).push(article);
  }
  const priority = ['world', 'local', 'politics', 'business', 'technology', 'science', 'health', 'environment', 'education', 'culture', 'sports'];
  const rank = section => { const index = priority.indexOf(section.toLowerCase()); return index < 0 ? priority.length : index; };
  const buckets = [...groups].sort(([a], [b]) => rank(a) - rank(b)).map(([, items]) => items);
  const balanced = [];
  for (let row = 0; buckets.some(items => items.length > row); row++) {
    for (const items of buckets) if (items[row]) balanced.push(items[row]);
  }
  return balanced;
}

export function newsPreviewParagraphs(article) {
  const summary = typeof article?.summary === 'string' ? article.summary.trim() : '';
  // Some RSS providers return a source placeholder instead of a real summary.
  if (!summary || summary === article?.title?.trim() || /^current\s+.{0,60}reporting\s+from\s+/i.test(summary)) return [];
  return summary.split(/\n\s*\n/).map(text => text.trim()).filter(Boolean);
}

export function selectNewsReports(reports, { section = 'All', search = '', unopened = false, order = 'edition' } = {}, opened = new Set()) {
  const terms = search.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const selected = uniqueNewsReports(reports).filter(article => (section === 'All' || article.section === section)
    && (!unopened || !opened.has(article.news_link))
    && terms.every(term => `${article.title} ${article.summary || ''} ${article.source || ''} ${article.section || ''}`.toLocaleLowerCase().includes(term)));
  if (order === 'newest') {
    // Missing dates stay at the end, not silently treated as breaking news.
    const timestamp = article => Number.isFinite(Date.parse(article.published_at)) ? Date.parse(article.published_at) : -Infinity;
    selected.sort((a, b) => {
      const left = timestamp(a), right = timestamp(b);
      return left === right ? 0 : left > right ? -1 : 1;
    });
  }
  return selected;
}

// Include briefing context only when its source list explicitly includes this report.
export function reportBriefingContext(summary, article) {
  const url = safeNewsUrl(article?.news_link);
  if (!url) return null;
  return (Array.isArray(summary?.keyTakeaways) ? summary.keyTakeaways : []).find(item =>
    typeof item?.summary === 'string' && item.summary.trim()
    && Array.isArray(item.stories) && item.stories.some(story => safeNewsUrl(story?.news_link) === url)) || null;
}
