const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = name => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');

test('the briefing keeps section navigation but removes summary search and the extra learning promotion', () => {
  const news = read('pages/NewsPage.jsx');
  assert.doesNotMatch(news, /summarySearch|Search summaries|Understand the bigger picture|NewsLearningLink/);
  assert.match(news, /Search current news/);
  assert.match(news, /Daily news sections/);
  assert.match(news, /What this means and what comes next/);
  assert.doesNotMatch(news, /<dt>Why it matters|<dt>What to watch/);
  assert.match(news, /if \(forceRefresh \|\| !hasEditorialBriefing\(availableData\)/, 'Manual refresh must still update the briefing');
});

test('the deeper lesson retains its guide and next connection, without the follow-up chat panel', () => {
  const lesson = read('pages/PostAiPage.jsx');
  assert.doesNotMatch(lesson, /Ask what the post leaves open|post-ai-chat|askPostDoubt|suggestedQuestions/);
  assert.match(lesson, /LearningJourneyPanel/);
  assert.match(lesson, /getPostDetails/);
});

test('news uses the same lightweight loading animation for route, reports and briefing', () => {
  assert.match(read('components/NewsRoute.jsx'), /NewsLoading/);
  assert.match(read('pages/NewsPage.jsx'), /<NewsLoading kind="briefing"/);
  const loader = read('components/NewsLoading.jsx');
  assert.match(loader, /role="status" aria-live="polite"/);
  assert.match(loader, /aria-hidden="true"/);
  const css = read('components/NewsLoading.css');
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.doesNotMatch(css, /filter:|requestAnimationFrame/);
});

test('startup warms the selected public briefing after auth restoration, without blocking the app', () => {
  assert.match(read('App.jsx'), /useBriefingPreload\(String\(user\?\.sub/);
  const hook = read('hooks/useBriefingPreload.js');
  assert.match(hook, /if \(authLoading \|\| !enabled\) return/);
  assert.match(hook, /navigator.onLine === false/);
  assert.match(hook, /briefingPlace\(readNewsPreference\(account\)\)/);
  assert.match(hook, /void preloadBriefing/);
  assert.match(hook, /removeEventListener\('visibilitychange'/);
  assert.doesNotMatch(hook, /setInterval|setTimeout/);
});
