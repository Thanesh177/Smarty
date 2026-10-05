import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanStoryQuery, filterStoryReports, groupStoryReports, reportKey, storyPeriod, storyQuery, storyTimelineUrl, timelineArticles } from './newsStories.js';

test('related headlines open the same suggested story', () => {
  assert.equal(storyQuery({ title: 'Gaza talks resume' }), 'Israel Gaza');
  assert.equal(storyQuery({ title: 'Hamas negotiators respond' }), 'Israel Gaza');
  assert.equal(storyQuery({ title: 'SpaceX launches satellites' }), 'SpaceX');
  assert.equal(storyQuery({ title: 'Starship test flight' }), 'SpaceX Starship');
});

test('invalid and future date links fall back to supported periods', () => {
  const now = new Date('2026-10-03T12:00:00Z');
  const period = value => storyPeriod(new URLSearchParams(value), now);
  assert.deepEqual(period('year=1999&month=10&order=wrong'), {year:'recent',month:'all',order:'oldest'});
  assert.deepEqual(period('year=2026&month=12&order=newest'), {year:'2026',month:'all',order:'newest'});
  assert.deepEqual(period('year=2023&month=02'), {year:'2023',month:'2',order:'oldest'});
  assert.equal(period('year=recent&month=5').month, 'all');
  assert.equal(period('year=2027').year, 'recent');
});

test('only identical headlines on the same day are grouped, retaining every source', () => {
  const reports = [
    {id:'one',title:'Talks resume today',source:'Source A',published_at:'2023-01-01T12:00:00Z'},
    {id:'two',title:'Talks  resume today',source:'Source B',published_at:'2023-01-01T15:00:00Z'},
    {id:'three',title:'Talks resume today',source:'Source B',published_at:'2023-01-02T15:00:00Z'},
    {id:'four',title:'Talks resume tomorrow',source:'Source A',published_at:'2023-01-02T15:00:00Z'},
  ];
  const groups = groupStoryReports(reports);
  assert.equal(groups.length, 3);
  assert.equal(groups[0].reports.length, 2);
  assert.equal(groups.flatMap(group => group.reports).length, 4);
  const filtered = filterStoryReports(groups, {publisher:'Source B',text:'resume today'});
  assert.equal(filtered.length, 2);
  assert.equal(filtered[0].id, 'two');
  assert.equal(filterStoryReports(groups,{unopened:true},new Set(['two'])).length, 2);
  assert.equal(filterStoryReports(groups,{text:'nonexistent'}).length, 0);
});

test('unknown publishers and reports without provider IDs remain usable', () => {
  const article = {title:'A discovery',news_link:'https://example.org/report',published_at:'2023-01-01T12:00:00Z'};
  assert.equal(reportKey(article), article.news_link);
  assert.equal(filterStoryReports(groupStoryReports([article]),{publisher:'Original report'}).length,1);
  const valid = timelineArticles([article, {...article,title:{bad:true}}, {...article,title:'   '}]);
  assert.equal(valid.length,1);
  assert.equal(valid[0].source,'Original report');
});
test('supports specific stories beyond the built-in suggestions', () => {
  assert.equal(storyQuery({ title: 'Tamil Nadu Assembly budget debate' }), 'Tamil Nadu Assembly budget');
  assert.equal(storyQuery({ storyQuery: 'São Paulo flood', title: 'Update' }), 'São Paulo flood');
  assert.equal(storyTimelineUrl({ title: 'An update' }), null);
  assert.match(storyTimelineUrl({ title: 'Ukraine peace talks' }), /q=Ukraine/);
  assert.equal(cleanStoryQuery('a'.repeat(130)).length, 100);
});
test('timeline excludes unsafe URLs, duplicates and undated reports, sorts both directions', () => {
  const first = { title: 'Earlier', news_link: 'https://example.org/a', published_at: '2023-01-02T12:00:00Z' };
  const last = { title: 'Latest', news_link: 'https://example.org/b', published_at: '2024-03-02T12:00:00Z' };
  const records = [last, first, first, { ...first, news_link: 'javascript:alert(1)' }, { ...last, news_link: 'https://example.org/c', published_at: '' }];
  assert.deepEqual(timelineArticles(records).map(a => a.title), ['Earlier', 'Latest']);
  assert.deepEqual(timelineArticles(records, 'newest').map(a => a.title), ['Latest', 'Earlier']);
});
