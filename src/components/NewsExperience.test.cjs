const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = name => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');

test('the briefing keeps section navigation but removes summary search and the extra learning promotion', () => {
  const news = read('pages/NewsPage.jsx');
  assert.doesNotMatch(news, /summarySearch|Search summaries|Understand the bigger picture|NewsLearningLink/);
  const [briefing, newsroom] = news.split('className="news-page news-compact news-newsroom"');
  assert.doesNotMatch(briefing, /type="search"/);
  assert.doesNotMatch(briefing, /news-edition-footer|news-summary-sources|news-briefing-takeaways/);
  assert.match(briefing, /to="\/news">All reports/);
  assert.match(newsroom, /type="search"[\s\S]+?'Search reports'/);
  assert.match(news, /Daily news sections/);
  assert.match(news, /What this means and what comes next/);
  assert.doesNotMatch(news, /<dt>Why it matters|<dt>What to watch/);
  assert.match(news, /cached\.isFresh && hasCurrentBriefing\(cached\.news\) && !forceRefresh/);
  assert.match(news, /getLatestNews\(\{[\s\S]+?forceRefresh, view/);
  assert.match(news, /Retry briefing/);
  assert.match(news, /Last available briefing · <time dateTime=\{summary\.editionDate\}/);
});

test('both News views show the entire briefing without an expander', () => {
  const news = read('pages/NewsPage.jsx');
  assert.doesNotMatch(news, /Read the full briefing|news-brief-more/);
  assert.match(news, /const paragraphs = briefingParagraphs\(summary\);[\s\S]+?paragraphs\.map/);
  assert.match(news, /const overviewParagraphs = briefingParagraphs\(dailyBriefing\);[\s\S]+?overviewParagraphs\.map/);
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
