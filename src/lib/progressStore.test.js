import test from "node:test";
import assert from "node:assert/strict";
import {
  getProgress,
  getVisitStreak,
  getWrongQuestions,
  saveProgress,
  saveWrongQuestion,
} from "./progressStore.js";

class MemoryStorage {
  constructor() {
    this.values = new Map();
  }

  getItem(key) {
    return this.values.has(key) ? this.values.get(key) : null;
  }

  setItem(key, value) {
    this.values.set(key, String(value));
  }

  removeItem(key) {
    this.values.delete(key);
  }
}

function withStorage(run) {
  const previousWindow = globalThis.window;
  globalThis.window = { localStorage: new MemoryStorage() };

  try {
    run(globalThis.window.localStorage);
  } finally {
    globalThis.window = previousWindow;
  }
}

test("quiz progress, mistakes, and streaks stay isolated by account", () => {
  withStorage((storage) => {
    saveProgress({ physics: { totalXP: 40 } }, "learner-a");
    saveProgress({ memory: { totalXP: 12 } }, "learner-b");
    saveWrongQuestion("physics", {
      q: "Why does acceleration change?",
      selected: "Speed alone",
      correctAnswer: "A net force acts",
      explanation: "A net force changes velocity.",
      difficulty: "Medium",
    }, "learner-a");

    assert.deepEqual(getProgress("learner-a"), { physics: { totalXP: 40 } });
    assert.deepEqual(getProgress("learner-b"), { memory: { totalXP: 12 } });
    assert.equal(getWrongQuestions("learner-a").physics[0].selected, "Speed alone");
    assert.deepEqual(getWrongQuestions("learner-b"), {});
    getVisitStreak("learner-a");
    getVisitStreak("learner-b");
    assert.ok(storage.getItem("smarty-visit-streak-v2:learner-a"));
    assert.ok(storage.getItem("smarty-visit-streak-v2:learner-b"));
  });
});

test("corrupt account progress falls back safely without affecting another account", () => {
  withStorage((storage) => {
    storage.setItem("smarty-topic-progress-v2:learner-a", "{broken");
    saveProgress({ ai_technology: { totalXP: 80 } }, "learner-b");

    assert.deepEqual(getProgress("learner-a"), {});
    assert.deepEqual(getProgress("learner-b"), { ai_technology: { totalXP: 80 } });
  });
});
