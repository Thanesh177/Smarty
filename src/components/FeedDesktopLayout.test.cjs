const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const postcss = require('postcss');

const source = fs.readFileSync(__dirname + '/../pages/FeedPage.jsx', 'utf8');
const css = postcss.parse(fs.readFileSync(__dirname + '/../styles/feed-learning-home.css', 'utf8'));
const desktop = css.nodes.find(node => node.type === 'atrule' && node.params === '(min-width: 1100px)');
const desktopValue = (selector, property) => desktop.nodes.find(node => node.selector === selector)?.nodes.find(node => node.prop === property)?.value;

test('feed keeps heading, complete body, and reading actions in document order', () => {
  assert.ok(source.indexOf('className="post-story-heading"') < source.indexOf('className="post-story-body"'));
  const body = source.slice(source.indexOf('className="post-story-body"'), source.indexOf('export default function FeedPage'));
  assert.match(body, /isTranslated && translatedText \? translatedText : post.body/);
  assert.match(body, /className="post-actions"/);
  assert.match(body, /onSave\(postId, isSaved\)/);
  assert.match(body, /aria-label="Comments"/);
  assert.match(body, /aria-label="Translate this post"/);
  assert.match(body, /<span>Go deeper<\/span>/);
  assert.doesNotMatch(body, /Simplif(?:y|ying)|simple-explanation/);
  assert.doesNotMatch(source, /onExplain|postApi\.explainPost/);
  assert.doesNotMatch(body, /line-clamp|substring|slice\(/);
});

test('opening the feed does not call retired Simplify state setters', () => {
  assert.doesNotMatch(source, /\b(?:setSimpleExplanations|setExplaining)\b/);
});

test('desktop separates context and explanation without changing mobile document flow', () => {
  assert.ok(desktop);
  assert.match(desktopValue('.app-shell .content .has-inner-feed .snap-feed .snap-post .post-content', 'grid-template-columns'), /minmax\(250px/);
  assert.equal(desktopValue('.app-shell .content .has-inner-feed .snap-post .post-story-heading', 'grid-column'), '1');
  assert.equal(desktopValue('.app-shell .content .has-inner-feed .snap-post .post-story-body', 'grid-column'), '2');
  const groups = css.nodes.find(node => node.selector === '.post-story-heading, .post-story-meta, .post-story-body');
  assert.equal(groups.nodes.find(node => node.prop === 'display').value, 'contents');
});

test('desktop images remain full width but never taller than two hundred pixels', () => {
  assert.equal(desktopValue('.app-shell .content .has-inner-feed .snap-post.has-feed-image .mini-media', 'max-height'), '200px');
  assert.equal(desktopValue('.app-shell .content .has-inner-feed .snap-post.has-feed-image .mini-media img', 'transform'), 'none');
  assert.equal(desktopValue('.app-shell .content .has-inner-feed .snap-post .post-story-body > p', 'color'), 'var(--ui-secondary)');
});
