import test from 'node:test';
import assert from 'node:assert/strict';
import { QUIZ_SUBJECTS } from './quizSubjects.js';
import { QUIZ_LESSONS, getQuizChapters, getQuizLessons, getQuizLesson, getQuizConceptId, getLessonQuizId,
  makeLessonQuizTopic, getRelatedQuizLessons, getQuizLessonLabel, getLessonStudyReference } from './quizLessons.js';
import { EXPANDED_QUIZ_LESSONS } from './quizLessonExpansion.js';
import { LESSON_QUESTIONS, getLessonTopicQuestions } from './quizLessonQuestions.js';
import { getQuestionFingerprint } from '../lib/quizQuestionStore.js';
import focusedStudy from '../../infrastructure/ai-content/focused_study.json' with { type: 'json' };

test('all subjects have an expanded lesson catalog and historical review IDs remain valid', () => {
  const ids = new Set();
  for (const subject of QUIZ_SUBJECTS) {
    const lessons = getQuizLessons(subject.id);
    assert.ok(lessons.length >= 6, subject.title);
    assert.equal(EXPANDED_QUIZ_LESSONS[subject.id].length, 3);
    assert.ok(EXPANDED_QUIZ_LESSONS[subject.id].every(lesson => lesson.concepts.length >= 4 && lesson.studyNote.length >= 100));
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
  assert.equal(Object.values(QUIZ_LESSONS).flat().length, 143 + focusedStudy.length);
  assert.deepEqual(getQuizLessons('unknown'), []);
  assert.equal(getQuizLesson('unknown', 'unknown'), null);
  assert.equal(getQuizLessonLabel('old-quiz-id'), '');
});

test('science offers physics, chemistry, mathematics and experimental reasoning', () => {
  const science = getQuizLessons('science-mathematics');
  assert.equal(science.length, 20);
  assert.deepEqual(new Set(science.map(item => item.branch)), new Set(['Physics', 'Chemistry', 'Mathematics', 'Scientific thinking', 'Thermodynamics', 'Organic Chemistry', 'Linear Algebra']));
  const subject = QUIZ_SUBJECTS.find(item => item.id === 'science-mathematics');
  const circuits = getQuizLesson(subject.id, 'circuits');
  const selected = makeLessonQuizTopic(subject, circuits, 'Ohm’s law');
  assert.equal(selected.conceptId, 'ohm-s-law');
  assert.match(selected.focus, /Inside an electric circuit: Ohm’s law/);
  assert.notEqual(selected.id, makeLessonQuizTopic(subject, circuits).id);
  assert.throws(() => makeLessonQuizTopic(subject, circuits, 'Photosynthesis'), RangeError);
});

test('every subject has more lessons to load and the new quizzes use concrete examples', () => {
  assert.equal(focusedStudy.length, 35);
  for (const subject of QUIZ_SUBJECTS) assert.ok(getQuizChapters(subject.id).length > 3, subject.id);
  for (const row of focusedStudy) {
    const subject = QUIZ_SUBJECTS.find(item => item.id === row.subject);
    const chapter = getQuizChapters(row.subject).find(item => item.title === row.chapter);
    const topic = makeLessonQuizTopic(subject, chapter);
    assert.deepEqual(topic.subjects, row.concepts);
    assert.ok(getLessonStudyReference(topic).sourceBody.includes(row.feedAngle));
  }
});

test('every subject exposes real named lessons and preserves all existing practice IDs', () => {
  for (const subject of QUIZ_SUBJECTS) {
    const chapters = getQuizChapters(subject.id);
    assert.ok(chapters.length >= 2, subject.id);
    assert.deepEqual(chapters.flatMap(chapter => chapter.practiceSets.map(set => set.id)).sort(),
      getQuizLessons(subject.id).map(set => set.id).sort());
    for (const chapter of chapters) {
      const topic = makeLessonQuizTopic(subject, chapter);
      assert.equal(getQuizLessonLabel(topic.id), chapter.title);
      assert.equal(getLessonStudyReference(topic).sourceTitle, chapter.title);
      for (const set of chapter.practiceSets) assert.ok(getLessonStudyReference(topic).sourceBody.includes(set.title));
    }
  }
});

test('the Physics quiz uses only physics questions and balances across its practice sets', () => {
  const subject = QUIZ_SUBJECTS.find(item => item.id === 'science-mathematics');
  const physics = getQuizChapters(subject.id).find(item => item.title === 'Physics');
  const questions = getLessonTopicQuestions(makeLessonQuizTopic(subject, physics));
  const pool = new Set(physics.practiceSets.flatMap(set => (LESSON_QUESTIONS[getLessonQuizId(subject.id, set.id)] || []).map(question => question.id)));
  assert.ok(questions.length >= 8);
  assert.equal(questions.length, pool.size);
  assert.ok(questions.every(question => pool.has(question.id)));
  assert.ok(new Set(questions.flatMap(question => question.concepts)).size >= 3);
});

test('built-in questions are original, well formed, diverse and explicitly mapped to their lesson', () => {
  const fingerprints = new Set();
  let count = 0;
  for (const [id, questions] of Object.entries(LESSON_QUESTIONS)) {
    const [subjectId, lessonId] = id.split('--');
    const lesson = getQuizLesson(subjectId, lessonId);
    assert.ok(lesson, id);
    const validConcepts = new Set(lesson.concepts.map(getQuizConceptId));
    const expanded = EXPANDED_QUIZ_LESSONS[subjectId].includes(lesson);
    const chemistry = subjectId === 'science-mathematics' && ['bonds', 'reactions', 'acids'].includes(lessonId);
    assert.equal(questions.length, chemistry ? 3 : expanded ? 5 : 8);
    assert.ok(new Set(questions.map(item => item.kind)).size >= (chemistry ? 3 : expanded ? 4 : 5));
    for (const level of expanded ? ['Easy', 'Medium'] : ['Easy', 'Medium', 'Hard']) assert.ok(questions.filter(item => item.difficulty === level).length >= (chemistry ? 1 : 2));
    if (expanded) assert.deepEqual(new Set(questions.flatMap(question => question.concepts)), validConcepts);
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
  assert.equal(count, 198);
  for (const subject of QUIZ_SUBJECTS) assert.ok(EXPANDED_QUIZ_LESSONS[subject.id].some(lesson => LESSON_QUESTIONS[getLessonQuizId(subject.id, lesson.id)]?.length === 5));
});

test('online lesson references include the teaching note and every connected idea', () => {
  const subject = QUIZ_SUBJECTS.find(item => item.id === 'technology');
  const lesson = getQuizLesson(subject.id, 'web-request-journey');
  const topic = makeLessonQuizTopic(subject, lesson);
  const reference = getLessonStudyReference(topic);
  assert.equal(reference.sourceTitle, lesson.title);
  assert.ok(reference.sourceBody.includes(lesson.studyNote));
  for (const idea of lesson.concepts) assert.ok(reference.sourceBody.includes(idea));
  assert.deepEqual(getLessonStudyReference(makeLessonQuizTopic(subject, lesson, 'DNS')), {});
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
