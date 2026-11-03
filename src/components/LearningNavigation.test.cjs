const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = file => fs.readFileSync(path.join(__dirname, file), 'utf8');

test('My learning is removed from menu, search, feed tabs and lesson shortcuts', () => {
  for (const file of ['NavbarMenu.jsx', 'UniversalSearch.jsx', 'FeedLearningHome.jsx', 'learning/LearningJourneyPanel.jsx']) {
    assert.doesNotMatch(source(file), /My learning/i, file);
  }
  assert.doesNotMatch(source('NavbarMenu.jsx'), /to="\/learn"/);
  assert.doesNotMatch(source('UniversalSearch.jsx'), /key: 'quick-learning'/);
  assert.doesNotMatch(source('FeedLearningHome.jsx'), /to="\/learn"/);
});

test('existing lessons and progress remain accessible without the removed navigation item', () => {
  assert.match(source('../App.jsx'), /<Route path="\/learn" element=\{<LearningPage \/>\}/);
  const journey = source('learning/LearningJourneyPanel.jsx');
  assert.match(journey, /Continue to knowledge check/);
  assert.match(journey, /readLearningProgress/);
  assert.match(journey, /learning-journey-head/);
});
