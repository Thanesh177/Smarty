import { memo, useCallback, useMemo } from "react";
import { getAchievements } from "../../lib/progressStore";
import { getAllAchievements } from "../../components/achievements/achievementEngine";
import './GameProfile.css';
function getProgress() {
  try {
    return JSON.parse(localStorage.getItem("smarty-topic-progress") || "{}");
  } catch {
    return {};
  }
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

const UnlockCard = memo(function UnlockCard({ item, totalXP }) {
  const unlocked = totalXP >= item.xp;
  const rawPercent = getUnlockPercent(totalXP, item.xp);
  const percent = Number.isFinite(rawPercent) ? rawPercent : 0;

  const handleUse = useCallback((event) => {
    if (!unlocked) return;

    event.currentTarget.disabled = true;

    try {
      item.action();
    } finally {
      window.setTimeout(() => {
        if (event.currentTarget) event.currentTarget.disabled = false;
      }, 500);
    }
  }, [item, unlocked]);

  return (
    <article
      className={unlocked ? "unlock-card unlocked" : "unlock-card locked"}
      style={{ "--unlock-progress": `${percent}%` }}
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
        type="button"
        className="unlock-action-btn"
        disabled={!unlocked}
        onClick={handleUse}
      >
        {unlocked ? "Use Now" : "Locked"}
      </button>
    </article>
  );
});

const AchievementCard = memo(function AchievementCard({ item, unlocked }) {
  return (
    <article
      className={unlocked ? "unlock-card unlocked" : "unlock-card locked"}
    >
      <div className="unlock-card-top">
        <span>{item.icon}</span>
        <small>{unlocked ? "Earned" : "Locked"}</small>
      </div>

      <h3>{item.title}</h3>
      <p className="achievement-desc">{item.desc}</p>
      <strong className="unlock-status">
        {unlocked ? "Unlocked" : "Locked"}
      </strong>
    </article>
  );
});

export default function GameProfile() {
  const progress = useMemo(() => getProgress(), []);
  const achievements = useMemo(() => getAchievements(), []);

  const totalXP = useMemo(
    () => Object.values(progress).reduce(
      (sum, item) => sum + (item.totalXP || 0),
      0
    ),
    [progress]
  );

  const levelStats = useMemo(() => {
    const level = Math.max(1, Math.floor(totalXP / 250) + 1);
    const xpRemainder = totalXP % 250;
    const xpToNextLevel = 250 - (xpRemainder || 250);
    const levelProgress = Math.min(100, Math.max(0,
      totalXP > 0 && xpRemainder === 0 ? 100 : (xpRemainder / 250) * 100
    ));

    return { level, xpToNextLevel, levelProgress };
  }, [totalXP]);

  const allAchievements = useMemo(() => getAllAchievements(), []);

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
    [totalXP, unlocks]
  );

  const nextUnlock = useMemo(
    () => unlocks.find((item) => totalXP < item.xp),
    [totalXP, unlocks]
  );

  const achievementSet = useMemo(() => new Set(achievements.map(a => a.id)), [achievements]);

  const goBack = useCallback(() => {
    window.history.back();
  }, []);

  const renderedUnlocks = useMemo(
    () => unlocks.map((item) => (
      <UnlockCard
        key={item.title}
        item={item}
        totalXP={totalXP}
      />
    )),
    [totalXP, unlocks]
  );

  const renderedAchievements = useMemo(
    () => allAchievements.map((item) => (
      <AchievementCard
        key={item.id}
        item={item}
        unlocked={achievementSet.has(item.id)}
      />
    )),
    [achievementSet, allAchievements]
  );

  return (
    <main className="quiz-page">
      <button
        type="button"
        className="back-btn"
        onClick={goBack}
      >
        <span className="arrow">←</span> Back
      </button>
      <section className="quiz-hero game-profile-hero">
        <div>
          <p className="quiz-kicker">GAME PROFILE</p>
          <h1>Level {levelStats.level} Learner</h1>
          <p>
            {totalXP} total XP earned. Keep winning challenges to unlock harder
            modes, boss levels, review tools, and elite learner rewards.
          </p>
        </div>

        <div className="streak-card streak-game-card game-profile-stat-card">
          <div className="game-profile-stat-main">
            <span>Total XP</span>
            <h3>{totalXP}</h3>
            <p>{levelStats.xpToNextLevel} XP to next level</p>
          </div>

          <div className="profile-level-track" aria-label="Level progress">
            <div
              className="profile-level-fill"
              style={{ width: `${levelStats.levelProgress}%` }}
            />
          </div>

          <div className="game-profile-stat-row">
            <small>Level {levelStats.level}</small>
            <small>{Math.round(levelStats.levelProgress)}%</small>
          </div>
        </div>
      </section>

      <section className="profile-overview-grid">
        <article className="profile-overview-card">
          <span>🏆</span>
          <strong>{unlockedCount}/{unlocks.length}</strong>
          <p>Rewards unlocked</p>
        </article>

        <article className="profile-overview-card">
          <span>🎖️</span>
          <strong>{achievements.length}</strong>
          <p>Achievements earned</p>
        </article>

        <article className="profile-overview-card wide-overview-card">
          <span>🚀</span>
          <strong>{nextUnlock ? nextUnlock.title : "All unlocked"}</strong>
          <p>{nextUnlock ? `${nextUnlock.xp - totalXP} XP needed` : "You reached elite status"}</p>
        </article>
      </section>

      <section className="unlock-section">
        <div className="section-heading-row">
          <div>
            <p className="quiz-kicker">UNLOCKS</p>
            <h2>Unlocked tools</h2>
          </div>
        </div>

        <div className="unlock-grid">
          {renderedUnlocks}
        </div>
      </section>

      <section className="unlock-section">
        <div className="section-heading-row">
          <div>
            <p className="quiz-kicker">BADGES</p>
            <h2>Achievement badges</h2>
          </div>
        </div>

        <div className="unlock-grid">
          {renderedAchievements}
        </div>
      </section>
    </main>
  );
}