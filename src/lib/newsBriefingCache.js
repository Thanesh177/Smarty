import { hasCurrentBriefing, hasEditorialBriefing, newsCacheIsFresh } from './newsAvailability.js';
import { hasNewsReports, isFallbackNews, loadNewsEdition, mergeNewsBriefing, normalizeNewsEdition } from './newsEdition.js';

const PREFIX = 'smarty_location_news_v22_';
const STALE_TTL = 48 * 60 * 60 * 1000;
export const NEWS_FEED_INTENT_EVENT = 'smarty-news-feed-intent';
export const getNewsCacheKey = (country, region) => `${PREFIX}${country}_${encodeURIComponent(region || 'all')}`;

export function latestSavedBriefing(now, ...summaries) {
  return summaries.reduce((latest, summary) => {
    if (!hasEditorialBriefing({ dailySummary: summary }) || !/^\d{4}-\d{2}-\d{2}$/.test(summary.editionDate || '')) return latest;
    const editionStart = Date.parse(`${summary.editionDate}T00:00:00Z`);
    const published = Date.parse(summary.generatedAt);
    const date = Number.isFinite(published) && published >= editionStart && published < editionStart + 86400000
      ? published : editionStart;
    if (!Number.isFinite(date) || date > now || now - date > STALE_TTL) return latest;
    return !latest || summary.editionDate > latest.editionDate ? summary : latest;
  }, null);
}

export function getCachedNews(country, region, storage, now = Date.now()) {
  try {
    storage = storage === undefined ? globalThis.localStorage : storage;
    const key = getNewsCacheKey(country, region);
    const cached = JSON.parse(storage.getItem(key) || 'null');
    if (!Number.isFinite(cached?.timestamp) || cached.timestamp > now) return null;
    if (now - cached.timestamp > STALE_TTL) { storage.removeItem(key); return null; }
    const news = normalizeNewsEdition(cached.news, { country, region });
    const lastEditorial = latestSavedBriefing(now, news.dailySummary,
      cached.lastEditorial ? normalizeNewsEdition({ articles: [], dailySummary: cached.lastEditorial }).dailySummary : null);
    if (!news.articles.length && !Object.keys(news.sections).length && !lastEditorial && !hasCurrentBriefing(news, now)) return null;
    const reportsTimestamp = cached.reportsTimestamp ?? cached.timestamp;
    return { news, lastEditorial, timestamp: cached.timestamp, reportsTimestamp,
      isFresh: newsCacheIsFresh(news, cached.timestamp, now),
      isReportsFresh: hasNewsReports(news) && !isFallbackNews(news) && Number.isFinite(reportsTimestamp)
        && reportsTimestamp <= now && now - reportsTimestamp < 60000,
    };
  } catch { return null; }
}

export function setCachedNews(country, region, value, storage, now = Date.now()) {
  const incoming = normalizeNewsEdition(value, { country, region });
  const existing = getCachedNews(country, region, storage, now);
  // Reports and the startup briefing finish independently. A fast reports
  // response must not erase a briefing that has just finished in the background.
  const today = new Date(now).toISOString().slice(0, 10);
  const retainBriefing = (!hasEditorialBriefing(incoming) || (incoming.dailySummary.editionDate && incoming.dailySummary.editionDate < today))
    && hasEditorialBriefing(existing?.news) && existing.news.dailySummary.editionDate === today;
  const retainReports = hasNewsReports(existing?.news) && (!hasNewsReports(incoming)
    || (isFallbackNews(incoming) && !isFallbackNews(existing.news)));
  const reportBase = retainReports ? existing.news : incoming;
  const summaryBase = retainBriefing ? existing.news : incoming;
  const news = mergeNewsBriefing({ ...reportBase, dailySummary: summaryBase.dailySummary }, summaryBase);
  // A saved summary can still be valuable during an outage, but a fallback
  // must not extend either freshness clock or replace better reports.
  const timestamp = retainBriefing || (retainReports && isFallbackNews(incoming)) ? existing.timestamp : now;
  const sameReportSnapshot = existing?.news.generatedAt && existing.news.generatedAt === reportBase.generatedAt
    && isFallbackNews(existing.news) === isFallbackNews(reportBase);
  const reportsTimestamp = retainReports || sameReportSnapshot ? existing.reportsTimestamp : now;
  if (retainReports && isFallbackNews(incoming)) news.notice = incoming.notice || reportBase.notice;
  try {
    storage = storage === undefined ? globalThis.localStorage : storage;
    const lastEditorial = latestSavedBriefing(now, news.dailySummary, incoming.dailySummary, existing?.lastEditorial);
    storage.setItem(getNewsCacheKey(country, region), JSON.stringify({ timestamp, reportsTimestamp, news,
      ...(lastEditorial && lastEditorial !== news.dailySummary ? { lastEditorial } : {}),
    }));
  }
  catch { /* The in-memory request cache still works when storage is full or disabled. */ }
  return news;
}

// Only public editions are shared. Account-specific saved reports and follows
// never enter this cache. Failed requests are retryable, not stored as success.
export function createBriefingPreloader({ load, storage, now = Date.now } = {}) {
  const pending = new Map();
  return function preload({ country = 'GLOBAL', region = '' } = {}) {
    const key = getNewsCacheKey(country, region);
    const cached = getCachedNews(country, region, storage, now());
    if (pending.has(key)) return pending.get(key);
    if (cached?.isFresh && hasNewsReports(cached.news) && hasCurrentBriefing(cached.news, now())) return Promise.resolve(cached.news);
    const freshReports = cached?.isReportsFresh ? cached.news : null;
    const save = news => setCachedNews(country, region, news, storage, now());
    let visibleReports;
    const task = Promise.resolve().then(() => loadNewsEdition({
      load: view => load({ country, region, lang: 'english', ...(view ? { view } : {}) }),
      savedReports: freshReports,
      preferBriefing: true,
      place: { country, region },
      onReports: (reports, { cached }) => {
        visibleReports = reports;
        if (!cached) save(reports);
      },
    }))
      .then(news => news === visibleReports ? getCachedNews(country, region, storage, now())?.news || news : save(news))
      .finally(() => { if (pending.get(key) === task) pending.delete(key); });
    pending.set(key, task);
    return task;
  };
}

export function newsOutlookParagraphs(digest) {
  const seen = new Set();
  return [digest?.context, digest?.next].flatMap(value => {
    if (typeof value !== 'string' || !value.trim()) return [];
    const text = value.trim(), key = text.replace(/\s+/g, ' ').replace(/[.!?]+$/, '').toLowerCase();
    if (seen.has(key)) return [];
    seen.add(key);
    return [text];
  });
}
