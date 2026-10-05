import { filterUnseenQuestions, getQuestionFingerprint } from './quizQuestionStore.js';

const cleanOption = (value) => String(value?.text ?? value?.label ?? value ?? '')
  .replace(/^\s*[A-D][.):\-]\s*/i, '').trim();

export function readQuizFlag(key) {
  try { return globalThis.localStorage?.getItem(key) || ''; } catch { return ''; }
}

export function clearQuizFlag(key) {
  try { globalThis.localStorage?.removeItem(key); } catch { /* Storage is optional. */ }
}

// Numeric answer indexes are zero-based; letter answer keys are A–D.
export function normalizeGeneratedQuestions(payload, topicId, {
  excludedFingerprints = [], fallbackDifficulty = 'Adaptive', requiredDifficulty = '', limit = 5,
} = {}) {
  let parsed = payload;
  if (typeof parsed?.body === 'string') {
    try { parsed = JSON.parse(parsed.body); } catch { return []; }
  }
  const rows = Array.isArray(parsed) ? parsed : parsed?.questions ?? parsed?.items;
  const questions = (Array.isArray(rows) ? rows : []).flatMap((row, index) => {
    const q = String(row?.q ?? row?.question ?? row?.prompt ?? '').trim();
    const rawOptions = row?.options ?? row?.choices ?? row?.answers;
    if (!Array.isArray(rawOptions)) return [];
    const options = rawOptions.map(cleanOption);
    // Do not silently reorder/drop choices: an indexed answer could then point to the wrong choice.
    if (q.length < 12 || options.length < 3 || options.length > 4 || options.some((item) => !item)
      || new Set(options.map((item) => item.toLocaleLowerCase())).size !== options.length) return [];
    const rawAnswer = row?.answer ?? row?.correctAnswer ?? row?.correct ?? row?.correctOption;
    const answerText = cleanOption(rawAnswer);
    const exact = options.find((item) => item.toLocaleLowerCase() === answerText.toLocaleLowerCase());
    const marker = String(rawAnswer ?? '').trim();
    const answerIndex = Number.isInteger(rawAnswer) ? rawAnswer
      : /^\d+$/.test(marker) ? Number(marker)
        : /^[A-D]$/i.test(marker) ? marker.toUpperCase().charCodeAt(0) - 65 : -1;
    const answer = typeof rawAnswer === 'number' ? options[answerIndex] : exact ?? options[answerIndex];
    const explanation = String(row?.explanation ?? row?.reason ?? '').trim();
    if (!answer || explanation.length < 20) return [];
    const label = String(row?.difficulty ?? '').toLowerCase();
    const difficulty = { easy: 'Easy', medium: 'Medium', hard: 'Hard' }[label] ?? fallbackDifficulty;
    if (requiredDifficulty && difficulty !== requiredDifficulty) return [];
    const question = { id: row?.id || `generated-${topicId}-${index + 1}`, q, options, answer,
      explanation, difficulty, source: 'generated' };
    return [{ ...question, fingerprint: getQuestionFingerprint(question) }];
  });
  return filterUnseenQuestions(questions, excludedFingerprints).slice(0, limit);
}

export function needsQuizReview(answer) {
  return Array.isArray(answer?.options) && answer.options.length >= 3
    && (!answer.isCorrect || answer.confidence === 'unsure');
}

export function getQuizResult(answers = []) {
  const records = Array.isArray(answers) ? answers : [];
  const correct = records.filter((answer) => answer?.isCorrect).length;
  return { correct, total: records.length, percent: records.length ? Math.round(correct / records.length * 100) : 0 };
}

export function getSavedReviewDeck(records = []) {
  return (Array.isArray(records) ? records : []).filter((record) =>
    record?.q && Array.isArray(record.options) && record.options.length >= 3
    && record.options.includes(record.answer || record.correctAnswer));
}
