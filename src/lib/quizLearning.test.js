import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeGeneratedQuestions, needsQuizReview, getQuizResult, getSavedReviewDeck } from './quizLearning.js';
import { getQuestionFingerprint, getQuizContextKey, clearActiveQuiz, loadActiveQuiz } from './quizQuestionStore.js';
import { getProgressUserId, saveWrongQuestion, getWrongQuestions, removeWrongQuestion } from './progressStore.js';
import { QUIZ_SUBJECTS, SUBJECT_QUESTIONS } from '../data/quizSubjects.js';
import { MAIN_TOPICS } from '../data/topicTaxonomy.js';

const row = { q: 'Which option answers this test question?', options: ['One', 'Two', 'Three', 'Four'], answer: 0,
  explanation: 'One is the specified correct option in this validation fixture.' };
test('answers support zero-based indexes, letters and text without shifting choices', () => {
  for (const [answer, expected] of [[0, 'One'], ['0', 'One'], ['B', 'Two'], ['three', 'Three'], ['D. Four', 'Four']]) {
    assert.equal(normalizeGeneratedQuestions([{ ...row, answer }], 'topic')[0].answer, expected);
  }
  assert.equal(normalizeGeneratedQuestions([{ ...row, options: ['A. One', 'B. Two', 'C. Three'], answer: 'B' }], 'topic')[0].answer, 'Two');
});
test('malformed or ambiguous questions are rejected, not scored with a shifted answer', () => {
  for (const change of [{ options: ['One', '', 'Three', 'Four'] }, { options: ['One', 'one', 'Three', 'Four'] },
    { answer: 9 }, { answer: 'Unknown' }, { explanation: '' }, { q: 'Hi' }, { options: ['One', 'Two'] }]) {
    assert.deepEqual(normalizeGeneratedQuestions([{ ...row, ...change }], 'topic'), []);
  }
  assert.deepEqual(normalizeGeneratedQuestions({ body: 'invalid' }, 'topic'), []);
});
test('wrapper parsing, history exclusion and deduplication preserve a fresh set', () => {
  const questions = normalizeGeneratedQuestions({ body: JSON.stringify({ questions: [row, row] }) }, 'topic');
  assert.equal(questions.length, 1);
  assert.equal(normalizeGeneratedQuestions([row], 'topic', { excludedFingerprints: [questions[0].fingerprint] }).length, 0);
  assert.equal(normalizeGeneratedQuestions([{...row,difficulty:'Easy'}], 'topic', {requiredDifficulty:'Hard'}).length,0);
});
test('uncertain correct answers and mistakes go to review; game results do not', () => {
  assert.ok(needsQuizReview({ ...row, isCorrect: true, confidence: 'unsure' }));
  assert.ok(needsQuizReview({ ...row, isCorrect: false }));
  assert.equal(needsQuizReview({ ...row, isCorrect: true }), false);
  assert.equal(needsQuizReview({ isCorrect: false }), false);
  assert.equal(getSavedReviewDeck([{ ...row, answer: 'One' }, { q: 'Old format', answer: 'Yes' }, { ...row, answer: 'Unknown' }]).length, 1);
});
test('results count completed activities; a boss cannot accidentally score 200%', () => {
  assert.deepEqual(getQuizResult([{ isCorrect: true }]), { correct: 1, total: 1, percent: 100 });
  assert.deepEqual(getQuizResult([{ isCorrect: true }, { isCorrect: false }]), { correct: 1, total: 2, percent: 50 });
  assert.deepEqual(getQuizResult([]), { correct: 0, total: 0, percent: 0 });
});
test('all main subjects have original questions across three levels with meaningful explanations', () => {
  const learningSubjects = MAIN_TOPICS.filter(subject => !subject.feedOnly);
  assert.deepEqual(QUIZ_SUBJECTS.slice(0, learningSubjects.length).map((item) => item.id), learningSubjects.map((item) => item.id));
  assert.equal(QUIZ_SUBJECTS.some(subject => subject.id === 'video'), false);
  const ids = new Set(), fingerprints = new Set();
  for (const subject of QUIZ_SUBJECTS) {
    const questions = SUBJECT_QUESTIONS[subject.id];
    assert.equal(questions.length, 6);
    for (const difficulty of ['Easy', 'Medium', 'Hard']) assert.equal(questions.filter((item) => item.difficulty === difficulty).length, 2);
    for (const question of questions) {
      assert.equal(question.options.length, 4); assert.equal(new Set(question.options).size, 4);
      assert.ok(question.options.includes(question.answer)); assert.ok(question.explanation.length >= 90);
      assert.equal(ids.has(question.id), false); ids.add(question.id);
      const fingerprint = getQuestionFingerprint(question); assert.equal(fingerprints.has(fingerprint), false); fingerprints.add(fingerprint);
    }
  }
  assert.equal(ids.size, QUIZ_SUBJECTS.length * 6);
});
test('question cache contexts distinguish study track and exam focus; non-English fingerprints work', () => {
  assert.notEqual(getQuizContextKey({ id: 'technology', studyTrack: 'college' }), getQuizContextKey({ id: 'technology', studyTrack: 'government exams' }));
  assert.notEqual(getQuizContextKey({ id: 'technology', examTarget: 'databases' }), getQuizContextKey({ id: 'technology', examTarget: 'networking' }));
  assert.notEqual(getQuizContextKey({ id: 'technology', examTarget: 'C++' }), getQuizContextKey({ id: 'technology', examTarget: 'C#' }));
  assert.ok(getQuestionFingerprint({ q: 'தமிழ் கேள்வி', answer: 'விடை' }));
});
test('saved review includes choices, is isolated by account, and clears corrected questions', () => {
  const entries = new Map(); globalThis.window = { localStorage: { getItem: (key) => entries.get(key) || null, setItem: (key, value) => entries.set(key, value) } };
  try {
    saveWrongQuestion('technology', { ...row, correctAnswer: 'One', answer: undefined, confidence: 'unsure', isCorrect: true }, 'learner-a');
    assert.equal(getSavedReviewDeck(getWrongQuestions('learner-a').technology).length, 1);
    assert.deepEqual(getWrongQuestions('learner-b'), {});
    saveWrongQuestion('technology', { ...row, answer: 'One' }, 'learner-a');
    assert.equal(getWrongQuestions('learner-a').technology.length, 1);
    removeWrongQuestion('technology', row, 'learner-a'); assert.deepEqual(getWrongQuestions('learner-a'), {});
  } finally { delete globalThis.window; }
});
test('blocked browser storage does not crash guest practice or cache cleanup', () => {
  globalThis.window = Object.defineProperty({}, 'localStorage', { get() { throw new Error('Storage blocked'); } });
  try {
    assert.equal(getProgressUserId(null), getProgressUserId(null));
    assert.doesNotThrow(() => clearActiveQuiz('test', 'topic'));
    assert.equal(loadActiveQuiz({ userId: 'test', topicId: 'topic' }), null);
    assert.doesNotThrow(() => saveWrongQuestion('topic', row, 'test'));
  } finally { delete globalThis.window; }
});
