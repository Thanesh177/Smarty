const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const postcss = require('postcss');

const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const rules = file => postcss.parse(read(file)).nodes.filter(node => node.type === 'rule');
const value = (css, selector, property) => css.find(node => node.selector === selector)
  ?.nodes.find(node => node.prop === property)?.value;

test('Deep Think shares the app palette and keeps a readable line length and unclipped preview', () => {
  const css = rules('pages/PostAiReading.css');
  const page = '.app-shell .content .post-ai-page.is-reading-layout';
  assert.equal(value(css, page, '--post-ai-ink'), 'var(--ui-text)');
  assert.equal(value(css, page, 'background'), 'var(--ui-bg)');
  assert.equal(value(css, page, '--lesson-measure'), '76ch');
  assert.equal(value(css, '.is-reading-layout .post-ai-deeper.is-open .post-ai-deeper-preview', 'max-height'), 'none');
  const button = ':is(.is-reading-layout .post-ai-premium-gate button, .post-ai-premium-dialog .post-ai-premium-done)';
  assert.equal(value(css, button, 'color'), 'var(--ui-primary-ink)');
  assert.equal(value(css, button, 'background'), 'var(--ui-primary)');
});

test('Quiz cards fill their page without reserving a separate rail column', () => {
  const css = rules('pages/QuizWorkspace.css');
  const page = '.app-shell .content .quiz-workspace';
  for (const selector of [page, page + ' :is(.question-card, .result-card, .quiz-loading-card)']) {
    assert.equal(value(css, selector, 'width'), '100%');
    assert.equal(value(css, selector, 'max-width'), 'none');
  }
  assert.doesNotMatch(read('pages/QuizLessons.css'), /--app-rail-width/);
});

test('Feed text and topic badges use theme colors without applying filters to media', () => {
  const css = rules('styles/feed-learning-home.css');
  const post = '.app-shell .content .has-inner-feed .snap-post';
  assert.equal(value(css, post + ' .post-story-body > p', 'color'), 'var(--ui-secondary)');
  assert.equal(value(css, post + ' .post-topic', 'color'), 'var(--ui-accent-strong)');
  assert.equal(value(css, post + ' .mini-media', 'background-color'), 'var(--ui-surface)');
  assert.doesNotMatch(read('styles/feed-learning-home.css'), /(?:^|[;{])\s*filter\s*:/m);
});
