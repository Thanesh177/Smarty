import test from 'node:test';
import assert from 'node:assert/strict';
import { selectLessonQuestions, getLessonQuestionStyle, summarizeLessonSkills } from './quizLessonPractice.js';
import { getQuizLesson, makeLessonQuizTopic } from '../data/quizLessons.js';
import { QUIZ_SUBJECTS } from '../data/quizSubjects.js';
import { getLessonTopicQuestions } from '../data/quizLessonQuestions.js';
import { getQuizContextKey, getQuestionFingerprint, filterUnseenQuestions } from './quizQuestionStore.js';
import { normalizeGeneratedQuestions } from './quizLearning.js';
import { saveWrongQuestion, getWrongQuestions } from './progressStore.js';

const subject = QUIZ_SUBJECTS.find(item => item.id === 'science-mathematics');
const forces = getQuizLesson(subject.id, 'forces');
const topic = makeLessonQuizTopic(subject, forces);

test('built-in selection respects difficulty, excludes history, shuffles without mutating the bank', () => {
  const original = JSON.stringify(getLessonTopicQuestions(topic));
  const first = selectLessonQuestions(topic, { difficulty: 'Easy', random: () => .4 });
  assert.equal(first.length, 3);
  assert.ok(first.every(item => item.difficulty === 'Easy'));
  assert.deepEqual(selectLessonQuestions(topic, { seen: first.map(item => item.fingerprint), difficulty: 'Easy' }), []);
  assert.equal(selectLessonQuestions(topic, { difficulty: 'Hard' }).length, 2);
  first[0].options.reverse();
  assert.equal(JSON.stringify(getLessonTopicQuestions(topic)), original);
});

test('topic-only selection is narrow; explicit review can revisit known questions without new XP', () => {
  const selected = makeLessonQuizTopic(subject, forces, 'Friction');
  const pool = getLessonTopicQuestions(selected);
  const seen = pool.map(getQuestionFingerprint);
  assert.deepEqual(selectLessonQuestions(selected, { seen }), []);
  const review = selectLessonQuestions(selected, { seen, review: true });
  assert.ok(review.length > 0);
  assert.ok(review.every(item => item.source === 'review' && item.concepts.includes(selected.conceptId)));
});

test('quiz cache contexts distinguish whole lessons, inner topics, exam targets and lesson revisions', () => {
  const topicOnly = makeLessonQuizTopic(subject, forces, 'Friction');
  assert.notEqual(getQuizContextKey(topic), getQuizContextKey(topicOnly));
  assert.notEqual(getQuizContextKey(topicOnly), getQuizContextKey({ ...topicOnly, lessonVersion: 2 }));
  assert.notEqual(getQuizContextKey(topicOnly), getQuizContextKey({ ...topicOnly, examTarget: 'Mechanics' }));
  assert.equal(getQuizContextKey({ id: 'technology', topic: 'Technology', studyTrack: 'college' }), 'ctx-hjphyy',
    'Existing non-lesson question caches retain their original context keys');
});

test('AI instructions name the selected topic and require varied worked explanations', () => {
  const selected = makeLessonQuizTopic(subject, forces, 'Friction');
  const style = getLessonQuestionStyle(selected);
  assert.match(style, /Test only its topic "Friction", not sibling topics/);
  assert.match(style, /misconception/); assert.match(style, /calculation/);
  assert.match(style, /step by step/); assert.match(style, /unfamiliar terms/);
  assert.equal(getLessonQuestionStyle({}), '');
});

test('the same question with a changed answer cannot bypass seen-prompt or within-set deduplication', () => {
  const row = getLessonTopicQuestions(topic)[0];
  const changedAnswer = { ...row, answer: row.options[1] };
  assert.equal(filterUnseenQuestions([row, changedAnswer]).length, 1);
  assert.deepEqual(normalizeGeneratedQuestions([changedAnswer], topic.id, { excludedPrompts: ['  ' + row.q.toUpperCase() + '  '] }), []);
});

test('reasoning summary separates uncertainty from correctness and excludes games', () => {
  const options = ['a', 'b', 'c'];
  assert.deepEqual(summarizeLessonSkills([{ kind: 'Scenario', options, isCorrect: true, confidence: 'unsure' },
    { kind: 'Scenario', options, isCorrect: false }, { kind: 'Game', isCorrect: true }]),
  [{ kind: 'Scenario', total: 2, correct: 1, unsure: 1 }]);
});

test('mistake review retains the topic hierarchy and remains account-specific', () => {
  const items = new Map();
  globalThis.window = { localStorage: { getItem: key => items.get(key) || null, setItem: (key, value) => items.set(key, value) } };
  try {
    const selected = makeLessonQuizTopic(subject, forces, 'Friction');
    const question = getLessonTopicQuestions(selected)[0];
    saveWrongQuestion(selected.id, { ...question, correctAnswer: question.answer, baseTopicId: subject.id,
      lessonId: forces.id, conceptId: selected.conceptId }, 'one');
    const saved = getWrongQuestions('one')[selected.id][0];
    assert.equal(saved.conceptId, selected.conceptId);
    assert.equal(saved.lessonId, forces.id); assert.equal(saved.kind, question.kind);
    assert.deepEqual(getWrongQuestions('two'), {});
  } finally { delete globalThis.window; }
});
