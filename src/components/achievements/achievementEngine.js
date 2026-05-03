import { getAchievements, saveAchievements } from "../../lib/progressStore";

const ALL_ACHIEVEMENTS = [
  {
    id: "first_win",
    title: "First Win",
    desc: "Complete your first successful challenge.",
    icon: "🏆",
  },
  {
    id: "memory_master",
    title: "Memory Master",
    desc: "Score 90% or more in Memory Boost.",
    icon: "🧠",
  },
  {
    id: "perfect_run",
    title: "Perfect Run",
    desc: "Score 100% in any topic.",
    icon: "🎯",
  },
  {
    id: "seven_day_flame",
    title: "Seven Day Flame",
    desc: "Reach a 7-day visit streak.",
    icon: "🔥",
  },
  {
    id: "level_5",
    title: "Level 5",
    desc: "Reach overall level 5.",
    icon: "⚡",
  },
];

export function checkAchievements({ topicId, percentage, streak, overallLevel }) {
  const unlocked = getAchievements();
  const unlockedIds = unlocked.map((item) => item.id);

  const newlyUnlocked = [];

  const add = (id) => {
    if (!unlockedIds.includes(id)) {
      const achievement = ALL_ACHIEVEMENTS.find((item) => item.id === id);
      if (achievement) newlyUnlocked.push({ ...achievement, unlockedAt: new Date().toISOString() });
    }
  };

  if (percentage >= 60) add("first_win");
  if (topicId === "memory" && percentage >= 90) add("memory_master");
  if (percentage === 100) add("perfect_run");
  if (streak >= 7) add("seven_day_flame");
  if (overallLevel >= 5) add("level_5");

  const updated = [...unlocked, ...newlyUnlocked];
  saveAchievements(updated);

  return newlyUnlocked;
}

export function getAllAchievements() {
  return ALL_ACHIEVEMENTS;
}