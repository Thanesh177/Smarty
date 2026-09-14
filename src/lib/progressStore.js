import { getUserScopedStorageKey } from "./userScopedStorage.js";

const PROGRESS_KEY = "smarty-topic-progress-v2";
const WRONG_KEY = "smarty-wrong-questions-v2";
const ACHIEVEMENT_KEY = "smarty-achievements-v2";
const PLAYER_STATS_KEY = "smarty-player-stats-v2";
const VISIT_STREAK_KEY = "smarty-visit-streak-v2";
const GUEST_ID_KEY = "smarty-user-id";

function getStorage() {
  return typeof window !== "undefined" ? window.localStorage : null;
}

export function getProgressUserId(userOrId) {
  const supplied = typeof userOrId === "object"
    ? userOrId?.sub || userOrId?.userId || userOrId?.id || userOrId?.username
    : userOrId;
  const normalized = String(supplied || "").trim();

  if (normalized) return normalized;

  const storage = getStorage();
  const existing = storage?.getItem(GUEST_ID_KEY);
  if (existing) return existing;

  const randomId = globalThis.crypto?.randomUUID
    ? globalThis.crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const created = `guest-${randomId}`;

  try {
    storage?.setItem(GUEST_ID_KEY, created);
  } catch {
    // Storage is optional; the quiz still works without persistence.
  }

  return created;
}

function scopedKey(baseKey, userOrId) {
  return getUserScopedStorageKey(baseKey, getProgressUserId(userOrId));
}

function readJson(baseKey, fallback, userOrId) {
  try {
    const raw = getStorage()?.getItem(scopedKey(baseKey, userOrId));
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(baseKey, value, userOrId) {
  try {
    getStorage()?.setItem(scopedKey(baseKey, userOrId), JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function getProgress(userOrId) {
  return readJson(PROGRESS_KEY, {}, userOrId);
}

export function saveProgress(progress, userOrId) {
  writeJson(PROGRESS_KEY, progress && typeof progress === "object" ? progress : {}, userOrId);
}

export function getWrongQuestions(userOrId) {
  return readJson(WRONG_KEY, {}, userOrId);
}

export function getPlayerStats(userOrId) {
  return readJson(PLAYER_STATS_KEY, {}, userOrId);
}

export function savePlayerStats(stats, userOrId) {
  writeJson(PLAYER_STATS_KEY, stats && typeof stats === "object" ? stats : {}, userOrId);
}

export function updatePlayerStats(update, userOrId) {
  const current = getPlayerStats(userOrId);
  const next = {
    totalXP: 0,
    coins: 0,
    wins: 0,
    losses: 0,
    streak: 0,
    level: 1,
    ...current,
    ...update,
  };

  next.level = Math.max(1, Math.floor(next.totalXP / 100) + 1);
  savePlayerStats(next, userOrId);
  return next;
}

export function removeWrongQuestion(topicId, mistakeToRemove, userOrId) {
  const data = getWrongQuestions(userOrId);
  if (!Array.isArray(data[topicId])) return data;

  const removeText = mistakeToRemove?.q || mistakeToRemove?.question || mistakeToRemove?.id || "";
  const updatedTopicQuestions = data[topicId].filter((item) => {
    const itemText = item?.q || item?.question || item?.id || "";
    return itemText !== removeText;
  });
  const updated = { ...data, [topicId]: updatedTopicQuestions };

  if (updatedTopicQuestions.length === 0) delete updated[topicId];
  writeJson(WRONG_KEY, updated, userOrId);
  return updated;
}

export function saveWrongQuestion(topicId, question, userOrId) {
  const existing = getWrongQuestions(userOrId);
  const normalizedQuestion = String(question?.q || "").trim().toLowerCase();
  const withoutDuplicate = (existing[topicId] || []).filter(
    (item) => String(item?.q || "").trim().toLowerCase() !== normalizedQuestion,
  );
  const updated = {
    ...existing,
    [topicId]: [
      ...withoutDuplicate,
      {
        q: question.q,
        selected: question.selected,
        answer: question.answer || question.correctAnswer,
        explanation: question.explanation,
        difficulty: question.difficulty,
        savedAt: new Date().toISOString(),
      },
    ].slice(-20),
  };

  writeJson(WRONG_KEY, updated, userOrId);
  return updated;
}

export function getAchievements(userOrId) {
  const value = readJson(ACHIEVEMENT_KEY, [], userOrId);
  return Array.isArray(value) ? value : [];
}

export function saveAchievements(items, userOrId) {
  writeJson(ACHIEVEMENT_KEY, Array.isArray(items) ? items : [], userOrId);
}

export function getVisitStreak(userOrId) {
  const today = new Date().toISOString().split("T")[0];
  const saved = readJson(VISIT_STREAK_KEY, {}, userOrId);

  if (saved.lastVisit === today) {
    return { streak: Math.max(1, Number(saved.streak) || 1), lastVisit: today };
  }

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayText = yesterday.toISOString().split("T")[0];
  const data = {
    streak: saved.lastVisit === yesterdayText ? Math.max(1, Number(saved.streak) || 1) + 1 : 1,
    lastVisit: today,
  };

  try {
    writeJson(VISIT_STREAK_KEY, data, userOrId);
  } catch {
    // Persistence failure must not prevent a quiz session.
  }

  return data;
}
