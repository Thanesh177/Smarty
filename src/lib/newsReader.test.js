import test from 'node:test';
import assert from 'node:assert/strict';
import { balancedNewsReports, newsPreviewParagraphs, NEWS_OPENED_LIMIT, newsReaderKey, normalizeNewsReader, readNewsReader, recordNewsOpen,
  reportBriefingContext, selectNewsReports, uniqueNewsReports } from './newsReader.js';

const report = (id, section = 'Science', extra = {}) => ({ title: `Report ${id}`, news_link: `https://example.org/${id}`,
  summary: 'New findings explained', source: 'Research journal', section, ...extra });

test('reader progress is isolated by account and survives reopening', () => {
  const values = new Map();
  const storage = { getItem: key => values.get(key) || null };
  const state = recordNewsOpen(null, 'https://example.org/one', 123);
  values.set(newsReaderKey('alice'), JSON.stringify(state));
  assert.deepEqual(readNewsReader('alice', storage), state);
  assert.deepEqual(readNewsReader('bob', storage), { opened: [] });
  assert.deepEqual(readNewsReader('guest', storage), { opened: [] });
  assert.notEqual(newsReaderKey('a/b'), newsReaderKey('a%2Fb'));
});

test('reader progress tolerates damaged or unavailable device storage', () => {
  assert.deepEqual(readNewsReader('a', { getItem: () => '{invalid' }), { opened: [] });
  assert.deepEqual(readNewsReader('a', { getItem() { throw Error('blocked'); } }), { opened: [] });
  assert.deepEqual(normalizeNewsReader({ opened: [null, {}, { url: 'javascript:alert(1)', at: 1 },
    { url: 'https://user:pass@example.org', at: 1 }, { url: 'https://example.org', at: '1' },
    { url: 'https://example.org', at: -1 }] }), { opened: [] });
  assert.doesNotThrow(() => recordNewsOpen({ opened: {} }, 'https://example.org', 2));
});

test('opening a report updates its timestamp without duplicating it', () => {
  let state = recordNewsOpen(null, 'https://example.org', 10);
  state = recordNewsOpen(state, 'https://example.org/', 20);
  assert.deepEqual(state.opened, [{ url: 'https://example.org/', at: 20 }]);
  assert.deepEqual(recordNewsOpen(state, 'file:///etc/passwd'), state);
});

test('reader history is bounded and keeps most recently opened reports', () => {
  const opened = Array.from({ length: NEWS_OPENED_LIMIT + 20 }, (_, id) => ({ url: `https://example.org/${id}`, at: id + 1 }));
  const state = normalizeNewsReader({ opened });
  assert.equal(state.opened.length, NEWS_OPENED_LIMIT);
  assert.equal(state.opened[0].at, NEWS_OPENED_LIMIT + 20);
  assert.equal(state.opened.at(-1).at, 21);
});

test('report collections deduplicate URLs across coverage sections', () => {
  const list = [report('a'), report('a', 'World'), report('b'), null, report('c', 'Science', { news_link: 'data:text/plain,x' })];
  assert.deepEqual(uniqueNewsReports(list).map(item => item.title), ['Report a', 'Report b']);
});

test('balanced coverage reveals different sections before repeating a section', () => {
  const list = [report('business-1', 'Business'), report('business-2', 'Business'), report('science-1'),
    report('world-1', 'World'), report('business-1', 'World'), report('world-2', 'World'), report('culture-1', 'Culture')];
  assert.deepEqual(balancedNewsReports(list).map(item => item.title),
    ['Report world-1', 'Report business-1', 'Report science-1', 'Report culture-1', 'Report world-2', 'Report business-2']);
  assert.equal(list[0].title, 'Report business-1');
  assert.deepEqual(balancedNewsReports([]), []);
});

test('quick reads never pass a provider placeholder off as a real summary', () => {
  assert.deepEqual(newsPreviewParagraphs(report('a', 'Business', { summary: 'Current business reporting from A publisher.' })), []);
  assert.deepEqual(newsPreviewParagraphs(report('a', 'Science', { summary: 'Report a' })), []);
  assert.deepEqual(newsPreviewParagraphs(report('a', 'Science', { summary: '' })), []);
  assert.deepEqual(newsPreviewParagraphs(report('a', 'Science', { summary: 'First paragraph.\n\nSecond paragraph.' })), ['First paragraph.', 'Second paragraph.']);
});

test('search, section, unopened and sort filters work together without changing the input', () => {
  const list = [report('one', 'Science', { published_at: '2026-10-01', summary: 'Ocean discovery' }),
    report('two', 'Science', { published_at: '2026-10-03', summary: 'Ocean discovery' }),
    report('three', 'World', { published_at: '2026-10-05', summary: 'Ocean discovery' }),
    report('four', 'Science', { published_at: '2026-10-02', summary: 'Ocean discovery' })];
  const selected = selectNewsReports(list, { section: 'Science', search: '  ocean journal ', unopened: true, order: 'newest' }, new Set([list[0].news_link]));
  assert.deepEqual(selected.map(item => item.title), ['Report two', 'Report four']);
  assert.equal(list[0].title, 'Report one');
  assert.deepEqual(selectNewsReports(list).map(item => item.title), list.map(item => item.title));
});

test('newest sort keeps undated reports last and stable instead of dropping them', () => {
  const list = [report('unknown', 'World', { published_at: 'invalid' }), report('older', 'World', { published_at: '2026-01-01' }),
    report('undated'), report('recent', 'World', { published_at: '2026-10-01' })];
  assert.deepEqual(selectNewsReports(list, { order: 'newest' }).map(item => item.title), ['Report recent', 'Report older', 'Report unknown', 'Report undated']);
});

test('saved report selection works without a current news response', () => {
  const saved = [report('a', 'World'), report('b', 'Science')];
  assert.equal(selectNewsReports(saved, { section: 'Science' }).length, 1);
  assert.equal(selectNewsReports(saved, { search: 'not found' }).length, 0);
  assert.equal(selectNewsReports(saved, { unopened: true }, new Set(saved.map(item => item.news_link))).length, 0);
});

test('briefing context must explicitly cite the selected report', () => {
  const article = report('one');
  const related = { title: 'A finding in context', summary: 'The supported context.', stories: [{ news_link: article.news_link }] };
  const unrelated = { title: 'Unrelated politics', summary: 'Not about this report.', stories: [report('two', 'World')] };
  assert.equal(reportBriefingContext({ keyTakeaways: [unrelated, related] }, article), related);
  assert.equal(reportBriefingContext({ keyTakeaways: [unrelated] }, article), null);
  assert.equal(reportBriefingContext({ keyTakeaways: [related] }, report('bad', 'World', { news_link: 'javascript:alert(1)' })), null);
  assert.equal(reportBriefingContext(null, article), null);
});
