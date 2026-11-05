import { getLessonTopicQuestions } from '../data/quizLessonQuestions.js';
import { getQuizConceptId } from '../data/quizLessons.js';
import { filterUnseenQuestions, getQuestionFingerprint } from './quizQuestionStore.js';

const conceptsFor = topic => (topic?.subjects || []).map(label => ({ label, id: getQuizConceptId(label) }));

export function selectBalancedLessonSet(topic, questions, limit = 6) {
  const areas = conceptsFor(topic).map(area => area.id);
  const pool = filterUnseenQuestions(questions).map(question => {
    const label = getQuizConceptId(question.concept || '');
    const wording = `-${getQuizConceptId(`${question.q} ${question.answer}`)}-`;
    const tags = Array.isArray(question.concepts) ? question.concepts : [];
    const concepts = areas.filter(area => tags.includes(area) || label === area
      || (!tags.length && (`-${label}-`.includes(`-${area}-`) || wording.includes(`-${area}-`))));
    return { ...question, concepts };
  });
  const covered = new Map(), kinds = new Set(), selected = [];
  const score = question => question.concepts.reduce((sum, concept) => sum + 4 / (1 + (covered.get(concept) || 0)), 0)
    + (question.kind && !kinds.has(question.kind) ? 1 : 0);
  while (pool.length && selected.length < limit) {
    let best = 0, bestScore = score(pool[0]);
    for (let index = 1; index < pool.length; index += 1) {
      const points = score(pool[index]);
      if (points > bestScore) { best = index; bestScore = points; }
    }
    const [question] = pool.splice(best, 1);
    selected.push(question);
    for (const concept of question.concepts) covered.set(concept, (covered.get(concept) || 0) + 1);
    if (question.kind) kinds.add(question.kind);
  }
  return selected;
}

export function hasBroadLessonCoverage(topic, questions) {
  const known = new Set(conceptsFor(topic).map(area => area.id));
  const covered = new Set(questions.flatMap(question => question.concepts || []).filter(area => known.has(area)));
  return questions.length >= 3 && covered.size >= Math.min(3, known.size);
}

export function selectLessonQuestions(topic, { seen = [], difficulty = 'Easy', includeApplication = false, review = false, limit = 5, random = Math.random } = {}) {
  const pool = getLessonTopicQuestions(topic);
  const available = review ? filterUnseenQuestions(pool) : filterUnseenQuestions(pool, seen);
  const selected = available.filter(question => review || question.difficulty === difficulty
    || (includeApplication && difficulty === 'Easy' && question.difficulty === 'Medium'));
  for (let index = selected.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [selected[index], selected[swap]] = [selected[swap], selected[index]];
  }
  const set = selectBalancedLessonSet(topic, selected, limit);
  if (includeApplication && !review) set.sort((a, b) => Number(a.difficulty !== 'Easy') - Number(b.difficulty !== 'Easy'));
  return set.map(question => ({ ...question,
    options: [...question.options], source: review ? 'review' : 'local', fingerprint: getQuestionFingerprint(question) }));
}

export function getLessonQuestionStyle(topic) {
  if (!topic?.lessonId) return '';
  return `Stay strictly inside the lesson "${topic.lessonTitle || topic.title}". ${topic.focusTitle ? `Test only its topic "${topic.focusTitle}", not sibling topics. ` : ''}Learning objective: ${(topic.objectives || []).join(' ')}. `
    + `Spread questions across these connected ideas: ${(topic.subjects || []).join(', ')}. Cover different ideas before repeating one, then connect two ideas in a new situation. `
    + 'Vary the reasoning across concept identification, how a mechanism works, an unfamiliar scenario, '
    + 'a comparison, a common misconception, and a worked calculation or interpretation of evidence where suitable. '
    + 'Do not ask the same fact with different wording. Define unfamiliar terms in the explanation; '
    + 'explain the reasoning step by step and why a tempting alternative is wrong. '
    + 'Do not ask general questions from a different lesson or claim official exam coverage.';
}

export function summarizeLessonCoverage(topic, answers) {
  if (!topic?.lessonId || topic.conceptId) return [];
  return conceptsFor(topic).flatMap(({ id, label }) => {
    const tested = answers.filter(answer => answer.concepts?.includes(id));
    if (!tested.length) return [];
    return [{ id, label, total: tested.length, correct: tested.filter(answer => answer.isCorrect).length,
      needsReview: tested.some(answer => !answer.isCorrect || answer.confidence === 'unsure') }];
  });
}

export function summarizeLessonSkills(answers) {
  const skills = new Map();
  for (const answer of Array.isArray(answers) ? answers : []) {
    if (!answer?.kind || !Array.isArray(answer.options)) continue;
    const skill = skills.get(answer.kind) || { kind: answer.kind, correct: 0, total: 0, unsure: 0 };
    skill.total += 1;
    if (answer.isCorrect) skill.correct += 1;
    if (answer.confidence === 'unsure') skill.unsure += 1;
    skills.set(answer.kind, skill);
  }
  return [...skills.values()];
}
