import test from 'node:test';
import assert from 'node:assert/strict';
import { QUIZ_SUBJECTS } from './quizSubjects.js';
import { QUIZ_LESSONS, getQuizLessons, getQuizLesson, getQuizConceptId, getLessonQuizId,
  makeLessonQuizTopic, getRelatedQuizLessons, getQuizLessonLabel } from './quizLessons.js';
import { LESSON_QUESTIONS, getLessonTopicQuestions } from './quizLessonQuestions.js';
import { getQuestionFingerprint } from '../lib/quizQuestionStore.js';

test('every subject has a book-like lesson catalog with distinct inner topics', () => {
  const ids = new Set();
  for (const subject of QUIZ_SUBJECTS) {
    const lessons = getQuizLessons(subject.id);
    assert.ok(lessons.length >= 3, subject.title);
    for (const lesson of lessons) {
      assert.ok(lesson.title && lesson.branch && lesson.outcome.length > 35);
      assert.equal(new Set(lesson.concepts).size, lesson.concepts.length);
      assert.ok(lesson.concepts.length >= 3);
      for (const concept of ['', ...lesson.concepts]) {
        const selected = makeLessonQuizTopic(subject, lesson, concept);
        assert.ok(selected.id.length <= 120);
        assert.equal(ids.has(selected.id), false); ids.add(selected.id);
        assert.equal(selected.baseTopicId, subject.id);
        assert.equal(selected.lessonId, lesson.id);
        assert.deepEqual(selected.subjects, concept ? [concept] : lesson.concepts);
        assert.equal(getQuizLessonLabel(selected.id), concept ? `${lesson.title} / ${concept}` : lesson.title);
      }
    }
  }
  assert.equal(Object.values(QUIZ_LESSONS).flat().length, 92);
  assert.deepEqual(getQuizLessons('unknown'), []);
  assert.equal(getQuizLesson('unknown', 'unknown'), null);
  assert.equal(getQuizLessonLabel('old-quiz-id'), '');
});

test('science offers physics, chemistry, mathematics and experimental reasoning', () => {
  const science = getQuizLessons('science-mathematics');
  assert.equal(science.length, 14);
  assert.deepEqual(new Set(science.map(item => item.branch)), new Set(['Physics', 'Chemistry', 'Mathematics', 'Scientific thinking']));
  const subject = QUIZ_SUBJECTS.find(item => item.id === 'science-mathematics');
  const circuits = getQuizLesson(subject.id, 'circuits');
  const selected = makeLessonQuizTopic(subject, circuits, 'Ohm’s law');
  assert.equal(selected.conceptId, 'ohm-s-law');
  assert.match(selected.focus, /Inside an electric circuit: Ohm’s law/);
  assert.notEqual(selected.id, makeLessonQuizTopic(subject, circuits).id);
  assert.throws(() => makeLessonQuizTopic(subject, circuits, 'Photosynthesis'), RangeError);
});

test('built-in questions are original, well formed, diverse and explicitly mapped to their lesson', () => {
  const fingerprints = new Set();
  let count = 0;
  for (const [id, questions] of Object.entries(LESSON_QUESTIONS)) {
    const [subjectId, lessonId] = id.split('--');
    const lesson = getQuizLesson(subjectId, lessonId);
    assert.ok(lesson, id);
    const validConcepts = new Set(lesson.concepts.map(getQuizConceptId));
    assert.equal(questions.length, 8);
    assert.ok(new Set(questions.map(item => item.kind)).size >= 5);
    for (const level of ['Easy', 'Medium', 'Hard']) assert.ok(questions.filter(item => item.difficulty === level).length >= 2);
    for (const question of questions) {
      count += 1;
      assert.equal(new Set(question.options).size, 4);
      assert.equal(question.options.length, 4);
      assert.ok(question.options.includes(question.answer));
      assert.ok(question.explanation.length >= 100, question.q);
      assert.ok(question.q.length >= 12);
      assert.ok(question.concepts.every(concept => validConcepts.has(concept)));
      const fingerprint = getQuestionFingerprint(question);
      assert.equal(fingerprints.has(fingerprint), false, question.q); fingerprints.add(fingerprint);
    }
  }
  assert.equal(count, 104);
});

test('a topic quiz never falls back to its whole lesson or another subject', () => {
  const subject = QUIZ_SUBJECTS.find(item => item.id === 'science-mathematics');
  const circuits = getQuizLesson(subject.id, 'circuits');
  const selected = makeLessonQuizTopic(subject, circuits, 'Parallel circuits');
  const questions = getLessonTopicQuestions(selected);
  assert.ok(questions.length > 0);
  assert.ok(questions.every(item => item.concepts.includes(selected.conceptId)));
  assert.ok(questions.length < getLessonTopicQuestions(makeLessonQuizTopic(subject, circuits)).length);
  const unsupported = makeLessonQuizTopic(subject, getQuizLesson(subject.id, 'calculus'), 'Integrals');
  assert.deepEqual(getLessonTopicQuestions(unsupported), []);
  assert.equal(getLessonQuizId(subject.id, 'circuits', 'Parallel circuits'), selected.id);
});

test('next lessons favor a related area and never suggest the completed lesson itself', () => {
  const next = getRelatedQuizLessons('science-mathematics', 'forces');
  assert.equal(next.length, 3);
  assert.ok(next.every(item => item.id !== 'forces' && item.branch === 'Physics'));
  assert.equal(new Set(next.map(item => item.id)).size, next.length);
  assert.deepEqual(getRelatedQuizLessons('science-mathematics', 'unknown'), []);
});
