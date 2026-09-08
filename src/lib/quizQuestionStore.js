import { getUserScopedStorageKey } from "./userScopedStorage.js";

const STORE_VERSION = 2;
const ACTIVE_QUIZ_TTL_MS = 30 * 60 * 1000;
const QUESTION_HISTORY_TTL_MS = 365 * 24 * 60 * 60 * 1000;
const MAX_HISTORY_PER_TOPIC = 500;
const ACTIVE_QUIZ_PREFIX = "smarty-active-quiz-v2";
const QUESTION_HISTORY_PREFIX = "smarty-quiz-question-history-v2";

function getStorage() {
  return typeof window !== "undefined" ? window.localStorage : null;
}

function normalizeFingerprintText(value) {
  return String(value || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function hashText(value) {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(36);
}

export function getQuestionFingerprint(question) {
  const prompt = normalizeFingerprintText(question?.q || question?.question || question?.prompt);
  const answer = normalizeFingerprintText(
    question?.answer || question?.correctAnswer || question?.correct || "",
  );

  return prompt ? `q-${hashText(`${prompt}|${answer}`)}` : "";
}

export function getQuizContextKey(topic = {}) {
  const context = [
    topic.id,
    topic.topic,
    topic.focus,
    topic.postId,
    topic.sourceTitle,
  ].map(normalizeFingerprintText).join("|");

  return `ctx-${hashText(context || "general")}`;
}

function getActiveQuizStorageKey(userId, topicId) {
  return getUserScopedStorageKey(
    `${ACTIVE_QUIZ_PREFIX}:${encodeURIComponent(String(topicId || "general"))}`,
    userId,
  );
}

function getHistoryStorageKey(userId, topicId) {
  return getUserScopedStorageKey(
    `${QUESTION_HISTORY_PREFIX}:${encodeURIComponent(String(topicId || "general"))}`,
    userId,
  );
}

function readJson(key) {
  const storage = getStorage();
  if (!storage) return null;

  try {
    return JSON.parse(storage.getItem(key) || "null");
  } catch {
    storage.removeItem(key);
    return null;
  }
}

export function loadActiveQuiz({ userId, topicId, difficulty, contextKey }) {
  const key = getActiveQuizStorageKey(userId, topicId);
  const entry = readJson(key);
  const isValid = entry?.version === STORE_VERSION
    && entry.userId === String(userId || "anonymous")
    && entry.topicId === String(topicId || "general")
    && entry.difficulty === difficulty
    && entry.contextKey === contextKey
    && Number(entry.expiresAt) > Date.now()
    && Array.isArray(entry.questions)
    && entry.questions.length > 0;

  if (!isValid) {
    getStorage()?.removeItem(key);
    return null;
  }

  return entry.questions;
}

export function saveActiveQuiz({ userId, topicId, difficulty, contextKey, questions }) {
  const storage = getStorage();
  if (!storage || !Array.isArray(questions) || questions.length === 0) return;

  const now = Date.now();
  const entry = {
    version: STORE_VERSION,
    userId: String(userId || "anonymous"),
    topicId: String(topicId || "general"),
    difficulty,
    contextKey,
    createdAt: now,
    expiresAt: now + ACTIVE_QUIZ_TTL_MS,
    questions,
  };

  storage.setItem(getActiveQuizStorageKey(userId, topicId), JSON.stringify(entry));
}

export function clearActiveQuiz(userId, topicId) {
  getStorage()?.removeItem(getActiveQuizStorageKey(userId, topicId));

  // Remove the pre-v2 cache so an old shared quiz cannot leak across accounts.
  getStorage()?.removeItem(`smarty-active-quiz-${topicId}`);
}

export function getQuestionHistory(userId, topicId) {
  const key = getHistoryStorageKey(userId, topicId);
  const entry = readJson(key);

  if (entry?.version !== STORE_VERSION || !Array.isArray(entry.records)) {
    return [];
  }

  const cutoff = Date.now() - QUESTION_HISTORY_TTL_MS;
  const records = entry.records
    .filter((record) => record?.fingerprint && Number(record.answeredAt) >= cutoff)
    .slice(-MAX_HISTORY_PER_TOPIC);

  if (records.length !== entry.records.length) {
    getStorage()?.setItem(key, JSON.stringify({ version: STORE_VERSION, records }));
  }

  return records;
}

export function getRecentQuestionFingerprints(userId, topicId, limit = 80) {
  return getQuestionHistory(userId, topicId)
    .slice(-Math.max(1, limit))
    .map((record) => record.fingerprint);
}

export function getRecentQuestionPrompts(userId, topicId, limit = 20) {
  return getQuestionHistory(userId, topicId)
    .slice(-Math.max(1, limit))
    .map((record) => record.question)
    .filter(Boolean);
}

export function filterUnseenQuestions(questions, seenFingerprints = []) {
  const seen = new Set(seenFingerprints);
  const included = new Set();

  return (Array.isArray(questions) ? questions : []).filter((question) => {
    const fingerprint = question?.fingerprint || getQuestionFingerprint(question);
    if (!fingerprint || seen.has(fingerprint) || included.has(fingerprint)) return false;
    included.add(fingerprint);
    return true;
  });
}

export function recordQuestionHistory(userId, topicId, answers) {
  const storage = getStorage();
  if (!storage) return [];

  const existing = getQuestionHistory(userId, topicId);
  const byFingerprint = new Map(existing.map((record) => [record.fingerprint, record]));
  const answeredAt = Date.now();

  for (const answer of Array.isArray(answers) ? answers : []) {
    if (answer?.source === "review" || !Array.isArray(answer?.options)) continue;

    const fingerprint = answer?.fingerprint || getQuestionFingerprint({
      q: answer?.q,
      answer: answer?.correctAnswer,
    });
    if (!fingerprint) continue;

    byFingerprint.set(fingerprint, {
      fingerprint,
      question: String(answer?.q || "").trim(),
      difficulty: String(answer?.difficulty || "Adaptive"),
      isCorrect: Boolean(answer?.isCorrect),
      answeredAt,
    });
  }

  const records = [...byFingerprint.values()]
    .sort((left, right) => left.answeredAt - right.answeredAt)
    .slice(-MAX_HISTORY_PER_TOPIC);

  storage.setItem(
    getHistoryStorageKey(userId, topicId),
    JSON.stringify({ version: STORE_VERSION, records }),
  );

  return records;
}
