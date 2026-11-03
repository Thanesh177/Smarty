const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
test('large route screens load on demand inside the existing error boundary', () => {
  const app = read('App.jsx');
  for (const page of ['QuizPage', 'ChatPage', 'TopicRoomsPage', 'PostAiPage', 'BookReaderPage', 'AdminModerationPage']) assert.match(app, new RegExp(`const ${page} = lazy`));
  assert.match(app, /<Suspense fallback=\{<RouteSkeleton \/>\}>\s*<Routes>/);
  assert.match(app, /routePresentation/);
});
test('route placeholders are accessible, theme aware and respect reduced motion', () => {
  assert.match(read('components/RouteSkeleton.jsx'), /role="status" aria-label="Loading page" aria-busy="true"/);
  const css = read('components/RouteSkeleton.css');
  assert.match(css, /var\(--ui-surface\)/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.doesNotMatch(css, /filter:|backdrop-filter:|#[0-9a-f]{6}/i);
});
