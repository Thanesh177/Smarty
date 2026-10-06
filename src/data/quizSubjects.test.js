import test from 'node:test';
import assert from 'node:assert/strict';
import { QUIZ_SUBJECTS, SUBJECT_QUESTIONS } from './quizSubjects.js';

test('Every selectable subject has original questions with distinct choices and explanations', () => {
  assert.equal(new Set(QUIZ_SUBJECTS.map(subject => subject.id)).size, QUIZ_SUBJECTS.length);
  const ids = new Set();
  for (const subject of QUIZ_SUBJECTS) {
    const questions = SUBJECT_QUESTIONS[subject.id];
    assert.ok(questions?.length >= 6, subject.title);
    assert.equal(new Set(questions.map(question => question.q)).size, questions.length);
    for (const question of questions) {
      assert.ok(!ids.has(question.id)); ids.add(question.id);
      assert.equal(question.options.length, 4);
      assert.equal(new Set(question.options).size, 4);
      assert.ok(question.options.includes(question.answer));
      assert.ok(question.explanation.length > 60);
    }
    assert.deepEqual([...new Set(questions.map(question => question.difficulty))].sort(), ['Easy', 'Hard', 'Medium']);
  }
});

test('Specialist subjects supply focused areas and a library filter group', () => {
  for (const id of ['trading-markets', 'psychology', 'neuroscience', 'game-theory']) {
    const subject = QUIZ_SUBJECTS.find(subject => subject.id === id);
    assert.ok(subject);
    assert.ok(subject.subjects.length >= 4);
    assert.ok(['stem', 'people', 'everyday'].includes(subject.group));
  }
  assert.match(QUIZ_SUBJECTS.find(subject => subject.id === 'trading-markets').desc, /not investment advice/);
});
