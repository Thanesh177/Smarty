import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeNewsEdition, mergeNewsBriefing, normalizeSavedNews, safeNewsUrl } from './newsEdition.js';

const report = { id: 'one', title: 'A real report', news_link: 'https://example.com/report', summary: 'Original coverage.', section: 'World' };
const reports = { location: {countryCode:'IN',region:'Tamil Nadu'}, articles: [report], sections: {World:[report]}, generatedAt:'2026-10-13T12:00:00Z' };
const summary = { summaryMode:'editorial', overview:'A sourced daily summary.', sectionDigests:[{section:'World',summary:'World context'}] };
test('a late summary-only response never erases already loaded reports', () => {
  const merged = mergeNewsBriefing(reports, { location:reports.location, dailySummary:summary, articles:[], sections:{}, generatedAt:'2026-10-13T12:02:00Z' });
  assert.equal(merged.articles[0].news_link, report.news_link);
  assert.deepEqual(merged.sections, reports.sections);
  assert.equal(merged.dailySummary.overview, summary.overview);
});
test('an older report snapshot accompanying a summary cannot replace fast reports', () => {
  const old = {...report,title:'Older report'};
  const merged = mergeNewsBriefing(reports, {...reports,articles:[old],sections:{World:[old]},dailySummary:summary});
  assert.equal(merged.articles[0].title, report.title);
});
test('a summary from a different country or region cannot be mixed into an edition', () => {
  for(const location of [{countryCode:'US',region:''},{countryCode:'IN',region:'Kerala'}]) {
    assert.throws(() => mergeNewsBriefing(reports, {location,dailySummary:summary}), /another edition/);
  }
});
test('headline-only fallback cannot replace reports with an artificial AI briefing', () => {
  assert.equal(mergeNewsBriefing(reports,{articles:[],dailySummary:{summaryMode:'extractive',overview:'Headlines'}}),reports);
});
test('malformed server responses produce a retryable error', () => {
  for(const value of [null,[], 'error', {error:'offline'},{sections:'bad'}]) assert.throws(() => normalizeNewsEdition(value));
  assert.deepEqual(normalizeNewsEdition({articles:[],sections:{}}).articles,[]);
});
test('unsafe links, duplicate reports and malformed fields are normalized', () => {
  const normalized = normalizeNewsEdition({articles:[report,report,{...report,news_link:'javascript:alert(1)'},{news_link:'https://example.com/',title:[]},{...report,news_link:'https://example.com/two',summary:{bad:true}}],sections:{World:[report]},sources:'bad'});
  assert.equal(normalized.articles.length,2);
  assert.equal(normalized.articles[1].summary,'');
  assert.deepEqual(normalized.sources,[]);
  assert.equal(safeNewsUrl('https://user:password@example.com/'),'');
});

test('malformed summary prose and location labels cannot crash the reader', () => {
  const result = normalizeNewsEdition({...reports,notice:{bad:true},location:{label:{bad:true}},dailySummary:{...summary,title:{bad:true},overviewParagraphs:['A paragraph',{}],highlights:[{}],keyTakeaways:[{}],sectionDigests:[{section:'World',summary:'Context',summaryParagraphs:[{},'Good prose'],context:{bad:true},topStories:[{}]}]}});
  assert.equal(result.location.label,''); assert.equal(result.notice,''); assert.equal(result.dailySummary.title,'');
  assert.deepEqual(result.dailySummary.overviewParagraphs,['A paragraph']);
  assert.deepEqual(result.dailySummary.sectionDigests[0].summaryParagraphs,['Good prose']);
  assert.equal(result.dailySummary.sectionDigests[0].context,'');
});

test('saved news and optional briefing metadata cannot crash the reader', () => {
  assert.deepEqual(normalizeSavedNews([null, {}, report, report]), [normalizeNewsEdition({ articles: [report] }).articles[0]]);
  const result = normalizeNewsEdition({ articles: [report], dailySummary: { ...summary, editionTimezone: {}, coverageWindow: [], unavailableSectors: [{}, 'Sports'] } });
  assert.equal(result.dailySummary.editionTimezone, ''); assert.equal(result.dailySummary.coverageWindow, '');
  assert.deepEqual(result.dailySummary.unavailableSectors, ['Sports']);
});
