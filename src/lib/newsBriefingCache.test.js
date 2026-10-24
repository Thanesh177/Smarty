import test from 'node:test';
import assert from 'node:assert/strict';
import { createBriefingPreloader, getCachedNews, getNewsCacheKey, setCachedNews, newsOutlookParagraphs } from './newsBriefingCache.js';

const clock = Date.parse('2026-10-24T12:00:00Z');
const storage = () => {
  const entries = new Map();
  return { getItem: key => entries.get(key) || null, setItem: (key, value) => entries.set(key, value), removeItem: key => entries.delete(key) };
};
const article = { title: 'Original reporting', news_link: 'https://example.com/report' };
const reports = { articles: [article], location: { countryCode: 'GLOBAL', region: '' } };
const briefing = { ...reports, dailySummary: { summaryMode: 'editorial', overview: 'A sourced overview.', editionDate: '2026-10-24' } };

test('startup preloading stores the full edition for immediate use on the News screen', async () => {
  const disk = storage(); let calls = 0;
  const warm = createBriefingPreloader({ storage: disk, now: () => clock, load: async options => {
    calls++; assert.deepEqual(options, { country: 'GLOBAL', region: '', lang: 'english' }); return briefing;
  } });
  await warm(); await warm();
  assert.equal(calls, 1);
  assert.equal(getCachedNews('GLOBAL', '', disk, clock).news.dailySummary.overview, briefing.dailySummary.overview);
});

test('concurrent startup and resume requests share one pending task', async () => {
  let finish, calls = 0;
  const warm = createBriefingPreloader({ storage: storage(), now: () => clock,
    load: () => { calls++; return new Promise(resolve => { finish = resolve; }); } });
  const one = warm(), two = warm();
  assert.equal(one, two);
  await Promise.resolve(); finish(briefing);
  await Promise.all([one, two]); assert.equal(calls, 1);
});

test('preload errors are not cached and the next attempt can recover', async () => {
  let calls = 0; const disk = storage();
  const warm = createBriefingPreloader({ storage: disk, now: () => clock,
    load: async () => { if (++calls === 1) throw new Error('Offline'); return briefing; } });
  await assert.rejects(warm(), /Offline/);
  assert.equal(getCachedNews('GLOBAL', '', disk, clock), null);
  await warm(); assert.equal(calls, 2);
});

test('a reports-only cache does not prevent preparing the daily briefing', async () => {
  const disk = storage(); setCachedNews('GLOBAL', '', reports, disk, clock);
  let calls = 0;
  await createBriefingPreloader({ storage: disk, now: () => clock, load: async () => { calls++; return briefing; } })();
  assert.equal(calls, 1);
});

test('a late reports response cannot erase the already-preloaded briefing', () => {
  const disk = storage(); setCachedNews('GLOBAL', '', briefing, disk, clock);
  const result = setCachedNews('GLOBAL', '', { ...reports, articles: [{ ...article, title: 'Newer report' }] }, disk, clock + 30000);
  assert.equal(result.dailySummary.overview, briefing.dailySummary.overview);
  assert.equal(result.articles[0].title, 'Newer report');
  assert.equal(getCachedNews('GLOBAL', '', disk, clock + 30000).timestamp, clock, 'Report updates must not renew an older summary’s freshness');
});

test('yesterday’s summary is never retained in a new day’s reports', () => {
  const disk = storage(); setCachedNews('GLOBAL', '', briefing, disk, clock);
  const result = setCachedNews('GLOBAL', '', reports, disk, clock + 86400000);
  assert.equal(result.dailySummary, undefined);
});

test('a summary-only startup response retains the already cached reports', () => {
  const disk = storage(); setCachedNews('GLOBAL', '', reports, disk, clock);
  const result = setCachedNews('GLOBAL', '', { ...briefing, articles: [], sections: {} }, disk, clock + 5000);
  assert.equal(result.articles[0].title, article.title);
  assert.equal(result.dailySummary.overview, briefing.dailySummary.overview);
});

test('updating reports cannot make an expired same-day briefing fresh again', () => {
  const disk = storage(); setCachedNews('GLOBAL', '', briefing, disk, clock);
  setCachedNews('GLOBAL', '', reports, disk, clock + 16 * 60000);
  assert.equal(getCachedNews('GLOBAL', '', disk, clock + 16 * 60000).isFresh, false);
});

test('countries and regions have separate persisted editions', async () => {
  const disk = storage();
  const warm = createBriefingPreloader({ storage: disk, now: () => clock,
    load: async place => ({ ...briefing, location: { countryCode: place.country, region: place.region } }) });
  await Promise.all([warm({ country: 'IN', region: 'Tamil Nadu' }), warm({ country: 'IN', region: 'Kerala' }), warm()]);
  assert.equal(getCachedNews('IN', 'Tamil Nadu', disk, clock).news.location.region, 'Tamil Nadu');
  assert.equal(getCachedNews('IN', 'Kerala', disk, clock).news.location.region, 'Kerala');
  assert.equal(getCachedNews('GLOBAL', '', disk, clock).news.location.countryCode, 'GLOBAL');
});

test('cache rejects corruption, future timestamps and expired records', () => {
  const disk = storage(), key = getNewsCacheKey('GLOBAL', '');
  for (const value of ['broken JSON', JSON.stringify({ timestamp: clock, news: { error: 'Failed' } }), JSON.stringify({ timestamp: clock + 1, news: briefing })]) {
    disk.setItem(key, value); assert.equal(getCachedNews('GLOBAL', '', disk, clock), null);
  }
  setCachedNews('GLOBAL', '', briefing, disk, clock);
  assert.equal(getCachedNews('GLOBAL', '', disk, clock + 49 * 3600000), null);
  assert.equal(disk.getItem(key), null);
});

test('unavailable local storage cannot break news loading', async () => {
  const disk = { getItem: () => { throw new Error('Unavailable'); }, setItem: () => { throw new Error('Full'); } };
  assert.equal(getCachedNews('GLOBAL', '', disk, clock), null);
  const result = await createBriefingPreloader({ storage: disk, now: () => clock, load: async () => briefing })();
  assert.equal(result.dailySummary.overview, briefing.dailySummary.overview);
});

test('merges context and outlook in order without repeating identical text', () => {
  assert.deepEqual(newsOutlookParagraphs({ context: 'Why this matters.', next: 'What happens next.' }), ['Why this matters.', 'What happens next.']);
  assert.deepEqual(newsOutlookParagraphs({ context: ' Same context. ', next: 'same   context' }), ['Same context.']);
  assert.deepEqual(newsOutlookParagraphs({ next: 'Next development.' }), ['Next development.']);
  assert.deepEqual(newsOutlookParagraphs({ context: {}, next: '' }), []);
});
