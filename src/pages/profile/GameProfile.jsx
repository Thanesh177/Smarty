import { getAchievements } from "../../lib/progressStore";
import { getAllAchievements } from "../../components/achievements/achievementEngine";
import './GameProfile.css';
import { useMemo } from "react";
function getProgress() {
  return JSON.parse(localStorage.getItem("smarty-topic-progress") || "{}");
}

function clearAIQuestionCache() {
  Object.keys(localStorage).forEach((key) => {
    if (key.startsWith("smarty-ai-") || key.startsWith("smarty-active-quiz-")) {
      localStorage.removeItem(key);
    }
  });
}

function getUnlockPercent(totalXP, requiredXP) {
  return Math.min(100, Math.round((totalXP / requiredXP) * 100));
}

export default function GameProfile() {
  const progress = getProgress();
  const achievements = getAchievements();

  const totalXP = Object.values(progress).reduce(
    (sum, item) => sum + (item.totalXP || 0),
    0
  );

  const level = Math.max(1, Math.floor(totalXP / 250) + 1);
  const xpRemainder = totalXP % 250;
  const xpToNextLevel = 250 - (xpRemainder || 250);
  const levelProgress = Math.min(100, Math.max(0,
    totalXP > 0 && xpRemainder === 0 ? 100 : (xpRemainder / 250) * 100
  ));

  const allAchievements = getAllAchievements();

  const unlocks = useMemo(() => [
    {
      xp: 50,
      title: "Focus Sprint",
      desc: "Start a quick speed challenge.",
      reward: "Fast thinking mode",
      category: "Training",
      icon: "⚡",
      action: () => {
        localStorage.setItem("smarty-game-mode", "focus");
        window.location.href = "/quiz";
      },
    },
    {
      xp: 100,
      title: "Mistake Review",
      desc: "Review weak questions and fix knowledge gaps.",
      reward: "Weakness training",
      category: "Review",
      icon: "🎯",
      action: () => {
        window.location.href = "/progress";
      },
    },
    {
      xp: 150,
      title: "Survival Mode",
      desc: "Face multiple real-life decisions in a row.",
      reward: "Survival challenges",
      category: "Challenge",
      icon: "🛡️",
      action: () => {
        localStorage.setItem("smarty-game-mode", "survival");
        window.location.href = "/quiz";
      },
    },
    {
      xp: 250,
      title: "Boss Practice",
      desc: "Unlock boss levels anytime.",
      reward: "Boss levels",
      category: "Boss",
      icon: "👑",
      action: () => {
        localStorage.setItem("smarty-boss-practice", "true");
        window.location.href = "/quiz";
      },
    },
    {
      xp: 500,
      title: "Hard Mode",
      desc: "Force harder AI questions.",
      reward: "Hard questions",
      category: "Difficulty",
      icon: "🔥",
      action: () => {
        localStorage.setItem("smarty-force-hard", "true");
        window.location.href = "/quiz";
      },
    },
    {
      xp: 750,
      title: "Fresh AI Questions",
      desc: "Clear cached questions and generate new ones.",
      reward: "Fresh question pool",
      category: "AI",
      icon: "🤖",
      action: () => {
        clearAIQuestionCache();
        window.location.href = "/quiz";
      },
    },
    {
      xp: 1000,
      title: "Master Path",
      desc: "Enter a serious learner path.",
      reward: "Master path mode",
      category: "Mastery",
      icon: "🧠",
      action: () => {
        localStorage.setItem("smarty-master-path", "true");
        window.location.href = "/quiz";
      },
    },
    {
      xp: 1500,
      title: "Legend Mode",
      desc: "Unlock legendary visual mode.",
      reward: "Legend theme",
      category: "Visual",
      icon: "🌌",
      action: () => {
        localStorage.setItem("smarty-legend-mode", "true");
        document.body.classList.add("legend-mode");
      },
    },
    {
      xp: 2000,
      title: "Elite Learner",
      desc: "Unlock elite learner status.",
      reward: "Elite badge",
      category: "Status",
      icon: "💎",
      action: () => {
        localStorage.setItem("smarty-elite-learner", "true");
        window.location.href = "/quiz";
      },
    },
  ], []);

  const unlockedCount = useMemo(
    () => unlocks.filter((item) => totalXP >= item.xp).length,
    [totalXP]
  );

  const nextUnlock = useMemo(
    () => unlocks.find((item) => totalXP < item.xp),
    [totalXP]
  );

  const achievementSet = useMemo(() => new Set(achievements.map(a => a.id)), [achievements]);

  return (
    <main className="quiz-page">
      <button
        className="back-btn"
        onClick={() => window.history.back()}
      >
        <span className="arrow">←</span> Back
      </button>
      <section className="quiz-hero game-profile-hero">
        <div>
          <p className="quiz-kicker">GAME PROFILE</p>
          <h1>Level {level} Learner</h1>
          <p>
            {totalXP} total XP earned. Keep winning challenges to unlock harder
            modes, boss levels, review tools, and elite learner rewards.
          </p>
        </div>

        <div className="streak-card streak-game-card game-profile-stat-card">
          <h3>{totalXP} XP</h3>
          <p>{xpToNextLevel} XP to next level</p>

          <div className="profile-level-track">
            <div
              className="profile-level-fill"
              style={{ width: `${levelProgress}%` }}
            />
          </div>
        </div>
      </section>

      <section className="profile-overview-grid">
        <article className="profile-overview-card">
          <span>🏆</span>
          <strong>{unlockedCount}/{unlocks.length}</strong>
          <p>Unlocks opened</p>
        </article>

        <article className="profile-overview-card">
          <span>🎖️</span>
          <strong>{achievements.length}</strong>
          <p>Achievements earned</p>
        </article>

        <article className="profile-overview-card">
          <span>🚀</span>
          <strong>{nextUnlock ? nextUnlock.title : "All unlocked"}</strong>
          <p>{nextUnlock ? `${nextUnlock.xp - totalXP} XP needed` : "You reached elite status"}</p>
        </article>
      </section>

      <section className="unlock-section">
        <div className="section-heading-row">
          <div>
            <p className="quiz-kicker">UNLOCKS</p>
            <h2>New Things To Do</h2>
          </div>
        </div>

        <div className="unlock-grid">
          {unlocks.map((item) => {
            const unlocked = totalXP >= item.xp;
            const percent = Number.isFinite(getUnlockPercent(totalXP, item.xp))
              ? getUnlockPercent(totalXP, item.xp)
              : 0;

            return (
              <article
                key={item.title}
                className={unlocked ? "unlock-card unlocked" : "unlock-card locked"}
              >
                <div className="unlock-card-top">
                  <span>{item.icon}</span>
                  <small>{item.category}</small>
                </div>

                <h3>{item.title}</h3>
                <p>{item.desc}</p>




                <strong className="unlock-status">
                  {unlocked ? "Unlocked" : `${totalXP}/${item.xp} XP`}
                </strong>

                <button
                  className="unlock-action-btn"
                  disabled={!unlocked}
                  onClick={(e) => {
                    if (!unlocked) return;
                    e.currentTarget.disabled = true;
                    try {
                      item.action();
                    } finally {
                      setTimeout(() => {
                        if (e.currentTarget) e.currentTarget.disabled = false;
                      }, 500);
                    }
                  }}
                >
                  {unlocked ? "Use Now" : "Locked"}
                </button>
              </article>
            );
          })}
        </div>
      </section>

      <section className="unlock-section">
        <div className="section-heading-row">
          <div>
            <p className="quiz-kicker">BADGES</p>
            <h2>Achievements</h2>
          </div>
        </div>

        <div className="unlock-grid">
          {allAchievements.map((item) => {
            const unlocked = achievementSet.has(item.id);

            return (
              <article
                key={item.id}
                className={unlocked ? "unlock-card unlocked" : "unlock-card locked"}
              >
                <div className="unlock-card-top">
                  <span>{item.icon}</span>
                  <small>{unlocked ? "Earned" : "Locked"}</small>
                </div>

                <h3>{item.title}</h3>
                <p style={{ padding: 0 }}>{item.desc}</p>
                <strong className="unlock-status">
                  {unlocked ? "Unlocked" : "Locked"}
                </strong>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}