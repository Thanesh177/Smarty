import { hasEditorialBriefing, newsCacheIsFresh } from './newsAvailability.js';
import { mergeNewsBriefing, normalizeNewsEdition } from './newsEdition.js';

const PREFIX = 'smarty_location_news_v22_';
const STALE_TTL = 48 * 60 * 60 * 1000;
export const getNewsCacheKey = (country, region) => `${PREFIX}${country}_${encodeURIComponent(region || 'all')}`;

export function getCachedNews(country, region, storage, now = Date.now()) {
  try {
    storage = storage === undefined ? globalThis.localStorage : storage;
    const key = getNewsCacheKey(country, region);
    const cached = JSON.parse(storage.getItem(key) || 'null');
    if (!Number.isFinite(cached?.timestamp) || cached.timestamp > now) return null;
    if (now - cached.timestamp > STALE_TTL) { storage.removeItem(key); return null; }
    const news = normalizeNewsEdition(cached.news);
    if (!news.articles.length && !Object.keys(news.sections).length && !hasEditorialBriefing(news)) return null;
    return { news, timestamp: cached.timestamp, isFresh: newsCacheIsFresh(news, cached.timestamp, now) };
  } catch { return null; }
}

export function setCachedNews(country, region, value, storage, now = Date.now()) {
  const incoming = normalizeNewsEdition(value);
  const existing = getCachedNews(country, region, storage, now);
  // Reports and the startup briefing finish independently. A fast reports
  // response must not erase a briefing that has just finished in the background.
  const retainBriefing = !hasEditorialBriefing(incoming) && hasEditorialBriefing(existing?.news)
    && existing.news.dailySummary.editionDate === new Date(now).toISOString().slice(0, 10);
  const retainReports = hasEditorialBriefing(incoming) && existing
    && !incoming.articles.length && !Object.keys(incoming.sections).length;
  const news = retainBriefing ? mergeNewsBriefing(incoming, existing.news)
    : retainReports ? mergeNewsBriefing(existing.news, incoming) : incoming;
  const timestamp = retainBriefing ? existing.timestamp : now;
  try {
    storage = storage === undefined ? globalThis.localStorage : storage;
    storage.setItem(getNewsCacheKey(country, region), JSON.stringify({ timestamp, news }));
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
    if (cached?.isFresh && hasEditorialBriefing(cached.news)) return Promise.resolve(cached.news);
    if (pending.has(key)) return pending.get(key);
    const task = Promise.resolve().then(() => load({ country, region, lang: 'english' }))
      .then(news => setCachedNews(country, region, news, storage, now()))
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
