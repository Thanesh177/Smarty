import { getLessonTopicQuestions } from '../data/quizLessonQuestions.js';
import { filterUnseenQuestions, getQuestionFingerprint } from './quizQuestionStore.js';

export function selectLessonQuestions(topic, { seen = [], difficulty = 'Easy', review = false, limit = 5, random = Math.random } = {}) {
  const pool = getLessonTopicQuestions(topic);
  const available = review ? filterUnseenQuestions(pool) : filterUnseenQuestions(pool, seen);
  const selected = available.filter(question => review || question.difficulty === difficulty);
  for (let index = selected.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [selected[index], selected[swap]] = [selected[swap], selected[index]];
  }
  return selected.slice(0, limit).map(question => ({ ...question,
    options: [...question.options], source: review ? 'review' : 'local', fingerprint: getQuestionFingerprint(question) }));
}

export function getLessonQuestionStyle(topic) {
  if (!topic?.lessonId) return '';
  return `Stay strictly inside the lesson "${topic.lessonTitle || topic.title}". ${topic.focusTitle ? `Test only its topic "${topic.focusTitle}", not sibling topics. ` : ''}Learning objective: ${(topic.objectives || []).join(' ')}. `
    + `Cover distinct ideas among: ${(topic.subjects || []).join(', ')}. `
    + 'Vary the reasoning across concept identification, how a mechanism works, an unfamiliar scenario, '
    + 'a comparison, a common misconception, and a worked calculation or interpretation of evidence where suitable. '
    + 'Do not ask the same fact with different wording. Define unfamiliar terms in the explanation; '
    + 'explain the reasoning step by step and why a tempting alternative is wrong. '
    + 'Do not ask general questions from a different lesson or claim official exam coverage.';
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
