const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
test('Settings includes review/share actions without collecting star ratings or exposing account URLs', () => {
  const settings = read('components/AppSettingsEngagement.jsx');
  assert.match(read('pages/SettingsPage.jsx'), /<AppSettingsEngagement user=\{user\}/);
  assert.match(settings, /Rate your app/); assert.match(settings, /Share app/);
  assert.match(settings, /Don’t|clipboard/);
  assert.match(settings, /if \(pending.current\) return/);
  assert.doesNotMatch(settings, /location\.href|user\.email|5.star|starRating|fetch\(/);
  assert.match(read('components/NavbarMenu.jsx'), /select:not\(:disabled\).*summary/);
});
test('prompts are delayed, non-modal, dismissible and do not interrupt quiz/chat/media routes', () => {
  const prompt = read('components/EngagementNudge.jsx');
  assert.match(prompt, /8000/); assert.match(prompt, /Not now/); assert.match(prompt, /Don’t ask again/);
  assert.match(prompt, /Dismiss rating prompt/); assert.match(prompt, /visibilityState === 'hidden'/);
  assert.match(prompt, /setPending\(count => count \+ 1\)/, 'Every fresh task rechecks eligibility');
  assert.match(prompt, /\['\/learn', '\/progress'\]/);
  assert.doesNotMatch(prompt, /autoFocus|role="dialog"|percentage|score|Notification\.requestPermission|requestReview/);
  const quiz = read('pages/QuizPage.jsx');
  assert.match(quiz, /result.total >= 3\) recordMeaningfulEngagement/);
});
test('activity obeys category/master preferences and excludes private messages', () => {
  const app = read('App.jsx');
  assert.match(app, /preferences.enabled && preferences.categories.product/);
  assert.match(app, /preferences.enabled && preferences.categories\[category\]/);
  assert.match(app, /\['learning', 'news', 'product'\]\.includes\(category\)/);
  assert.match(app, /if \(!preferences.enabled \|\| !preferences.categories.learning\) return/);
  assert.match(read('pages/NotificationSettingsPage.jsx'), /<AppActivityInbox key=\{userId\} userId=\{userId\}/);
});
