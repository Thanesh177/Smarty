import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { getLearningLibrary, getLearningProgressKey, readLearningProgress, rememberLearningLesson,
  markLearningProgress, saveLearningReflection, recordLearningQuiz, selectNextLessons,
  getLearningContext, getLearningLevelLabel } from './learningJourney.js';
import { LEARNING_GUIDES } from '../data/learningGuides.js';

const storage = new Map();
globalThis.localStorage = { getItem: (key) => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, value), removeItem: (key) => storage.delete(key) };
const lesson = { postId: 'one', topic: 'Physics', focus: 'Scattering', title: 'Why the sky changes color' };
beforeEach(() => storage.clear());

test('opening a lesson does not complete it; explicit steps do not complete other steps', () => {
  rememberLearningLesson(lesson, 'a');
  assert.equal(readLearningProgress('one', 'a').read, false);
  markLearningProgress('one', 'a', 'understand', lesson);
  assert.equal(readLearningProgress('one', 'a').understand, true);
  assert.equal(readLearningProgress('one', 'a').read, false);
  markLearningProgress('one', 'a', 'challenge', lesson);
  assert.equal(readLearningProgress('one', 'a').challenge, false);
});
test('accounts have separate history and reflections', () => {
  saveLearningReflection('one', 'a', { note: 'My explanation', confidence: 'confident' }, lesson);
  assert.equal(getLearningLibrary('a')[0].note, 'My explanation');
  assert.deepEqual(getLearningLibrary('b'), []);
  assert.equal(readLearningProgress('one', '').note, '');
});
test('legacy navigation flags cannot claim a passed quiz', () => {
  storage.set(getLearningProgressKey('one', 'a'), JSON.stringify({ read: true, understand: true, challenge: true }));
  assert.equal(readLearningProgress('one', 'a').challenge, false);
});
test('a low score and a one-question retry cannot complete the challenge', () => {
  recordLearningQuiz('one', 'a', { correct: 1, total: 3, attemptId: '1' }, lesson);
  assert.equal(readLearningProgress('one', 'a').challenge, false);
  recordLearningQuiz('one', 'a', { correct: 1, total: 1, attemptId: '2' }, lesson);
  assert.equal(readLearningProgress('one', 'a').challenge, false);
});
test('quiz callbacks are idempotent; same-day retries do not postpone review', () => {
  const now = Date.parse('2026-09-11T12:00:00Z');
  const first = recordLearningQuiz('one', 'a', { correct: 3, total: 3, attemptId: '1', now }, lesson);
  assert.equal(first.challenge, true);
  recordLearningQuiz('one', 'a', { correct: 3, total: 3, attemptId: '1', now }, lesson);
  assert.equal(readLearningProgress('one', 'a').attempts, 1);
  const retry = recordLearningQuiz('one', 'a', { correct: 3, total: 3, attemptId: '2', now: now + 3600000 }, lesson);
  assert.equal(retry.nextReviewAt, first.nextReviewAt);
  const reviewTime = Date.parse(first.nextReviewAt);
  const review = recordLearningQuiz('one', 'a', { correct: 3, total: 3, attemptId: '3', now: reviewTime }, lesson);
  assert.equal(Date.parse(review.nextReviewAt) - reviewTime, 3 * 86400000);
});
test('recommendations exclude the current lesson, duplicates, unrelated and passed lessons', () => {
  const posts = [{ id: 'one', topic: 'Physics' }, { id: 'two', topic: 'Physics', focus: 'Particle scattering', body: 'Particle size changes how light is redirected.' }, { id: 'two', topic: 'Physics' }, { id: 'three', topic: 'Physics' }, { id: 'four', topic: 'Cooking' }];
  const recommendations = selectNextLessons(posts, lesson, [{ postId: 'three', challenge: true }]);
  assert.deepEqual(recommendations.map((item) => item.post.id), ['two']);
  assert.match(recommendations[0].connection, /Scattering|scattering/);
  assert.match(recommendations[0].connection, /Particle scattering/);
  assert.equal(recommendations[0].preview, 'Particle size changes how light is redirected.');
  assert.match(recommendations[0].question, /behave differently/i);
  assert.doesNotMatch(recommendations[0].question, /changes changes|changes changed/i);
});
test('corrupt storage and exhausted quotas do not break learning', () => {
  storage.set(getLearningProgressKey('one', 'a'), 'not json');
  assert.equal(readLearningProgress('one', 'a').read, false);
  const original = localStorage.setItem;
  localStorage.setItem = () => { throw new Error('QuotaExceededError'); };
  try { assert.equal(rememberLearningLesson(lesson, 'a').persisted, false); }
  finally { localStorage.setItem = original; }
});
test('starter guides have complete readings, unique IDs, references, and answerable quizzes', () => {
  assert.equal(new Set(LEARNING_GUIDES.map((guide) => guide.id)).size, LEARNING_GUIDES.length);
  for (const guide of LEARNING_GUIDES) {
    assert.ok(guide.aiDetailedExplanation.split(/\s+/).length >= 60);
    assert.ok(guide.sources.every((source) => source.url.startsWith('https://')));
    assert.equal(guide.questions.length, 3);
    for (const item of guide.questions) {
      assert.equal(item.options.length, 4);
      assert.equal(new Set(item.options).size, 4);
      assert.ok(item.options.includes(item.answer));
      assert.ok(item.explanation.length > 10);
    }
  }
});

test('valid JSON with corrupt field types is normalized before rendering', () => {
  storage.set(getLearningProgressKey('one', 'a'), JSON.stringify({ version: 2, note: {}, attempts: 'oops', lastScore: {}, context: ['bad'], nextReviewAt: 'never' }));
  const progress = readLearningProgress('one', 'a');
  assert.equal(progress.note, '');
  assert.equal(progress.attempts, 0);
  assert.equal(progress.lastScore, null);
  assert.equal(progress.context, null);
  assert.equal(progress.nextReviewAt, '');
});

test('ordered curriculum recommends the adjacent lesson, not a distant advanced match', () => {
  const current = getLearningContext({ id: 'step-1', topic: 'Artificial Intelligence', subTopic: 'model tokens',
    learningPathId: 'ai-v1', learningOrder: 1, learningLevel: 'foundation', nextLearningPostId: 'step-2' });
  const posts = [
    { id: 'step-5', topic: current.topic, subTopic: 'advanced model token optimization', learningPathId: 'ai-v1', learningOrder: 5 },
    { id: 'step-2', topic: current.topic, subTopic: 'embedding vectors', learningPathId: 'ai-v1', learningOrder: 2 },
    { id: 'old', topic: current.topic, subTopic: 'before tokens', learningPathId: 'ai-v1', learningOrder: 0 },
  ];
  const selected = selectNextLessons(posts, current);
  assert.deepEqual(selected.map((item) => item.post.id), ['step-2']);
  assert.equal(selected[0].pathType, 'sequence');
  assert.equal(getLearningLevelLabel(current), 'Foundations');
});

test('curriculum stage and continuation survive saved history, separated by account', () => {
  const context = getLearningContext({ id: 'step-2', topic: 'Physics', title: 'Energy and motion',
    learningPathId: 'physics-v1', learningOrder: 2, learningTotalSteps: 7, learningLevel: 'intermediate',
    previousLearningPostId: 'step-1', nextLearningPostId: 'step-3', prerequisiteSubject: 'net force' });
  rememberLearningLesson(context, 'learner');
  assert.equal(getLearningLibrary('learner')[0].context.learningOrder, 2);
  assert.equal(getLearningLibrary('learner')[0].context.nextLearningPostId, 'step-3');
  assert.deepEqual(getLearningLibrary('another'), []);
  assert.equal(getLearningLevelLabel(context), 'In depth');
});

test('older posts get no invented difficulty and malformed order stays safe', () => {
  assert.equal(getLearningLevelLabel(getLearningContext({ id: 'old' })), '');
  assert.equal(getLearningContext({ learningLevel: 'expert-certified', learningOrder: 'invalid' }).learningOrder, 0);
  assert.equal(getLearningContext({ learningOrder: -2 }).learningOrder, 0);
  assert.equal(getLearningContext({ learningOrder: 2.5 }).learningOrder, 0);
});

test('unpublished next step cannot create a broken recommendation', () => {
  const current = getLearningContext({ id: 'step-1', topic: 'Physics', learningPathId: 'physics-v1', learningOrder: 1, nextLearningPostId: 'not-published' });
  assert.deepEqual(selectNextLessons([{ id: 'step-4', topic: 'Physics', subTopic: 'more physics', learningPathId: 'physics-v1', learningOrder: 4 }], current), []);
});
