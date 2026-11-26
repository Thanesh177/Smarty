export const QUESTION_QUALITY_VERSION = 2;
export const REASONING_BY_LEVEL = {
  Easy: ['foundation', 'mechanism'],
  Medium: ['application', 'comparison'],
  Hard: ['multi-step', 'evidence', 'trade-off'],
};
const text = (value, max) => typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : '';
const optionKey = value => text(value, 220).replace(/^[A-D][.):\-]\s*/i, '').toLocaleLowerCase();
export function hasPlaceholderChoices(options) {
  return Array.isArray(options) && options.length > 0 && options.every(option =>
    /^(?:[a-z]|(?:option|choice|answer)\s*[a-z0-9]+)$/i.test(String(option).trim()));
}

export function normalizeRepairQuestion(value, originalPrompt = '') {
  if (!value || typeof value !== 'object') return null;
  const q = text(value.q, 420), explanation = text(value.explanation, 1200);
  const options = Array.isArray(value.options) ? value.options.map(option => text(option, 220)) : [];
  const answer = text(value.answer, 220);
  if (Array.isArray(value.options) && value.options.some(option => typeof option === 'string' && option.replace(/\s+/g,' ').trim().length > 220)) return null;
  if (q.length < 12 || optionKey(q) === optionKey(originalPrompt) || explanation.length < 50
    || options.length !== 4 || options.some(option => !option) || hasPlaceholderChoices(options)
    || new Set(options.map(optionKey)).size !== 4 || !options.includes(answer)) return null;
  return { q, options, answer, explanation, source: 'repair' };
}

// Structural teaching-quality checks, not a claim of external fact checking.
export function normalizeTeachingQuality(raw, { options, answer, difficulty, required = false, passageRequired = false, repairRequired = false, referenceText = '' }) {
  if (hasPlaceholderChoices(options)) return null;
  const reasoningKind = text(raw.reasoningKind || raw.kind, 40);
  const steps = (Array.isArray(raw.explanationSteps) ? raw.explanationSteps : [])
    .filter(value => typeof value === 'string').map(value => text(value, 400)).filter(value => value.length >= 16).slice(0, 5);
  const misconception = text(raw.misconception, 360);
  const pairs = raw.distractorExplanations && typeof raw.distractorExplanations === 'object' && !Array.isArray(raw.distractorExplanations)
    ? new Map(Object.entries(raw.distractorExplanations).map(([key, value]) => [optionKey(key), text(value, 320)])) : new Map();
  const distractorExplanations = Object.fromEntries(options.filter(option => option !== answer)
    .map(option => [option, pairs.get(optionKey(option)) || '']).filter(([, explanation]) => explanation.length >= 15));
  const passage = text(raw.passage, 3200), evidence = text(raw.evidence, 500);
  const referenceEvidence = text(raw.referenceEvidence, 700);
  const repairQuestion = normalizeRepairQuestion(raw.repairQuestion, raw.q || raw.question);
  if (required && (!REASONING_BY_LEVEL[difficulty]?.includes(reasoningKind)
    || steps.length < (difficulty === 'Hard' ? 2 : 1)
    || new Set(steps.map(value => value.toLocaleLowerCase())).size !== steps.length
    || misconception.length < 20
    || Object.keys(distractorExplanations).length !== options.length - 1)) return null;
  if (repairRequired && !repairQuestion) return null;
  if (passageRequired && (passage.split(/\s+/).length < 100 || evidence.length < 12
    || !passage.toLocaleLowerCase().includes(evidence.toLocaleLowerCase()))) return null;
  if (referenceText && (referenceEvidence.length < 20 || !text(referenceText, 10000).toLocaleLowerCase().includes(referenceEvidence.toLocaleLowerCase()))) return null;
  return { qualityVersion: required ? QUESTION_QUALITY_VERSION : Number(raw.qualityVersion) === QUESTION_QUALITY_VERSION ? QUESTION_QUALITY_VERSION : 0,
    reasoningKind, explanationSteps: steps, misconception, distractorExplanations,
    ...(repairQuestion ? { repairQuestion } : {}),
    ...(referenceEvidence ? { referenceEvidence } : {}),
    ...(passage ? { passage, evidence } : {}) };
}

export function answerRepair(question, selected) {
  if (!question || selected === question.answer) return null;
  const specific = question.distractorExplanations?.[selected];
  return { reason: typeof specific === 'string' ? specific : '',
    misconception: typeof question.misconception === 'string' ? question.misconception : '',
    steps: Array.isArray(question.explanationSteps) ? question.explanationSteps : [],
    concept: question.concept || question.concepts?.[0] || '' };
}
