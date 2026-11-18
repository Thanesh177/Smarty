const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { transformSync } = require('esbuild');

function client(payload, browserArticles = []) {
  let fallbackCalls = 0;
  let reads = 0;
  const instance = { interceptors: { request: { use() {} }, response: { use() {} } } };
  const axios = { create: () => instance, get: async (_url, options) => {
    reads++;
    return { data: typeof payload === 'function' ? payload(options.params) : payload };
  } };
  const scope = { exports: {} };
  vm.runInNewContext(transformSync(fs.readFileSync(__dirname + '/client.js', 'utf8'), {
    format: 'cjs', define: { 'import.meta.env': JSON.stringify({DEV:false,PROD:true,VITE_API_BASE_URL:'https://fixture.example'}) },
  }).code, {
    module: scope, exports: scope.exports, console, URL, URLSearchParams, AbortController, DOMException,
    setTimeout, clearTimeout, setInterval, clearInterval,
    require(name) {
      if (name === 'axios') return axios;
      if (name === 'aws-amplify/auth') return { fetchAuthSession: async () => ({}) };
      if (name.includes('/firebase')) return { requestNotificationToken: async () => null };
      if (name.includes('/cognito')) return { hasNativeRefreshSession: () => false, refreshNativeSession: async () => null };
      return require(name);
    },
  });
  const api = scope.exports.newsApi;
  api.getHackerNews = async () => { fallbackCalls++; return browserArticles; };
  api.getSpaceflightNews = async () => { fallbackCalls++; return []; };
  return { api, reads: () => reads, fallbackCalls: () => fallbackCalls };
}

test('summary-only API response is accepted without unrelated provider fallbacks', async () => {
  const dailySummary = { summaryMode:'editorial',overview:'A daily summary from reporting.' };
  const fixture = client({status:200,articles:[],sections:{},dailySummary});
  const response = await fixture.api.loadLatestNews({country:'GLOBAL'});
  assert.equal(response.dailySummary.overview,dailySummary.overview);
  assert.equal(response.articles.length,0);
  assert.equal(fixture.fallbackCalls(),0);
});

test('empty sections still allow valid top-level reports', async () => {
  const fixture = client({status:200,sections:{},articles:[{title:'A report',news_link:'https://example.com/report',section:'World',summary:'Original reporting.'}]});
  const response = await fixture.api.loadLatestNews({country:'GLOBAL',view:'reports'});
  assert.equal(response.articles.length,1);
  assert.equal(fixture.fallbackCalls(),0);
});

test('a genuinely empty provider response offers an error, never a false briefing', async () => {
  const fixture = client({status:200,articles:[],sections:{}});
  await assert.rejects(fixture.api.loadLatestNews({country:'IN'}),/temporarily unavailable/);
});

test('a failed world briefing falls back to official reports before contacting alternative providers', async () => {
  const { loadNewsEdition } = await import('../lib/newsEdition.js');
  const official = {title:'A current official report',news_link:'https://example.com/report',section:'World'};
  const fixture = client(({ view }) => {
    if (view === 'reports') return {status:200,articles:[official]};
    throw new Error('Combined endpoint unavailable');
  });
  const result = await loadNewsEdition({
    place: { country: 'GLOBAL', region: '' },
    preferBriefing: true,
    load: view => fixture.api.getLatestNews({ country: 'GLOBAL', view }),
  });
  assert.equal(result.articles[0].title, official.title);
  assert.equal(fixture.reads(), 2);
  assert.equal(fixture.fallbackCalls(), 0);
});

test('if both world requests fail, alternative reports are tried once and remain readable', async () => {
  const { loadNewsEdition } = await import('../lib/newsEdition.js');
  const browserReport = {title:'Alternate science report',news_link:'https://example.com/science'};
  const fixture = client(() => { throw new Error('Public news unavailable'); }, [browserReport]);
  const result = await loadNewsEdition({
    place: { country: 'GLOBAL', region: '' },
    preferBriefing: true,
    load: view => fixture.api.getLatestNews({ country: 'GLOBAL', view }),
  });
  assert.equal(result.articles[0].title, browserReport.title);
  assert.equal(result.cacheStatus, 'browser-fallback');
  assert.equal(fixture.reads(), 2);
  assert.equal(fixture.fallbackCalls(), 2, 'each alternative provider is called just once');
});

test('manual story refresh bypasses the read cache without duplicating normal reads', async () => {
  const fixture = client({ kind: 'story-timeline', query: 'SpaceX', articles: [] });
  await fixture.api.getStoryTimeline({ query: 'SpaceX' });
  await fixture.api.getStoryTimeline({ query: 'SpaceX' });
  assert.equal(fixture.reads(), 1);
  await fixture.api.getStoryTimeline({ query: 'SpaceX', forceRefresh: true });
  assert.equal(fixture.reads(), 2);
});
