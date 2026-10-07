import test from 'node:test';
import assert from 'node:assert/strict';
import { hasEditorialBriefing, newsCacheIsFresh, editorialNewsSections } from './newsAvailability.js';

const now = Date.parse('2026-10-06T10:00:00Z');
const editorial = {dailySummary: {summaryMode: 'editorial', overview: 'Verified reporting.', editionDate: '2026-10-06'}};
test('only meaningful editorial content is presented as an AI briefing', () => {
  assert.equal(hasEditorialBriefing(editorial), true);
  assert.equal(hasEditorialBriefing({dailySummary:{summaryMode:'extractive',overview:'Headlines'}}), false);
  assert.equal(hasEditorialBriefing({dailySummary:{summaryMode:'editorial',overview:' '}}), false);
  assert.equal(hasEditorialBriefing({dailySummary:{summaryMode:'editorial',overviewParagraphs:['Available context']}}), true);
});
test('fallback reports are rechecked shortly instead of hiding AI recovery for fifteen minutes', () => {
  const fallback = {dailySummary:{summaryMode:'extractive'}};
  assert.equal(newsCacheIsFresh(fallback, now - 30000, now), true);
  assert.equal(newsCacheIsFresh(fallback, now - 61000, now), false);
  assert.equal(newsCacheIsFresh(editorial, now - 10 * 60000, now), true);
  assert.equal(newsCacheIsFresh(editorial, now - 16 * 60000, now), false);
  assert.equal(newsCacheIsFresh(editorial, now + 1, now), false);
  assert.equal(newsCacheIsFresh({...editorial,dailySummary:{...editorial.dailySummary,editionDate:'2026-10-05'}}, now-1, now), false);
});
test('editorial sectors exclude malformed or headline-only summaries', () => {
  const sections = [{section:'Science',summary:'Science context',summaryMode:'editorial'},
    {section:'World',summary:'Headlines only',summaryMode:'extractive'},null,{section:'Sports',summary:[]},{section:'Health',summary:''}];
  assert.deepEqual(editorialNewsSections({...editorial,dailySummary:{...editorial.dailySummary,sectionDigests:sections}}), [sections[0]]);
  assert.deepEqual(editorialNewsSections({dailySummary:{summaryMode:'extractive',sectionDigests:sections}}), []);
});
