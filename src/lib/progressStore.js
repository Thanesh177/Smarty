const PROGRESS_KEY = "smarty-topic-progress";
const WRONG_KEY = "smarty-wrong-questions";
const ACHIEVEMENT_KEY = "smarty-achievements";

export function getProgress() {
  return JSON.parse(localStorage.getItem(PROGRESS_KEY) || "{}");
}

export function saveProgress(progress) {
  localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
}

export function getWrongQuestions() {
  return JSON.parse(localStorage.getItem(WRONG_KEY) || "{}");
}

export function getPlayerStats() {
  return JSON.parse(localStorage.getItem("smarty-player-stats") || "{}");
}

export function savePlayerStats(stats) {
  localStorage.setItem("smarty-player-stats", JSON.stringify(stats));
}

export function updatePlayerStats(update) {
  const current = getPlayerStats();

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

  savePlayerStats(next);
  return next;
}

export function removeWrongQuestion(topicId, mistakeToRemove) {
  const data = getWrongQuestions();

  if (!Array.isArray(data[topicId])) return data;

  const removeText =
    mistakeToRemove?.q ||
    mistakeToRemove?.question ||
    mistakeToRemove?.id ||
    "";

  const updatedTopicQuestions = data[topicId].filter((item) => {
    const itemText = item?.q || item?.question || item?.id || "";
    return itemText !== removeText;
  });

  const updated = {
    ...data,
    [topicId]: updatedTopicQuestions,
  };

  if (updatedTopicQuestions.length === 0) {
    delete updated[topicId];
  }

  localStorage.setItem("smarty-wrong-questions", JSON.stringify(updated));
  return updated;
}

export function saveWrongQuestion(topicId, question) {
  const existing = getWrongQuestions();

  const updated = {
    ...existing,
    [topicId]: [
      ...(existing[topicId] || []),
      {
        q: question.q,
        answer: question.answer,
        explanation: question.explanation,
        savedAt: new Date().toISOString(),
      },
    ].slice(-20),
  };

  localStorage.setItem(WRONG_KEY, JSON.stringify(updated));
}

export function getAchievements() {
  return JSON.parse(localStorage.getItem(ACHIEVEMENT_KEY) || "[]");
}

export function saveAchievements(items) {
  localStorage.setItem(ACHIEVEMENT_KEY, JSON.stringify(items));
}