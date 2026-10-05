import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { getAchievements, getProgress, getProgressUserId } from "../../lib/progressStore";
import { getAllAchievements } from "../../components/achievements/achievementEngine";
import { useAuth } from "../../contexts/AuthContext";
import { useNavigate } from 'react-router-dom';
import { ArrowUpRight, Grid2X2, LockKeyhole, Check } from 'lucide-react';
import { QUIZ_SUBJECTS } from '../../data/quizSubjects.js';
import { getWrongQuestions } from '../../lib/progressStore';
import './GameProfile.css';
import '../QuizWorkspace.css';
import '../progress/QuizProgress.css';

function clearAIQuestionCache(userId) {
  const scopeSuffix = `:${encodeURIComponent(userId)}`;
  Object.keys(localStorage).forEach((key) => {
    if ((key.startsWith("smarty-ai-") || key.startsWith("smarty-active-quiz-")) && key.endsWith(scopeSuffix)) {
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

    const button = event.currentTarget;
    button.disabled = true;

    try {
      item.action();
    } finally {
      window.setTimeout(() => {
        if (button.isConnected) button.disabled = false;
      }, 500);
    }
  }, [item, unlocked]);

  return (
    <article
      className={unlocked ? "unlock-card unlocked" : "unlock-card locked"}
      style={{ "--unlock-progress": `${percent}%` }}
    >
      <div className="unlock-card-top">
        <span aria-hidden="true">{unlocked ? <ArrowUpRight size={18} /> : <LockKeyhole size={16} />}</span>
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
        <span aria-hidden="true">{unlocked ? <Check size={18} /> : <LockKeyhole size={16} />}</span>
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
  const navigate = useNavigate();
  const { user } = useAuth();
  const progressUserId = useMemo(() => getProgressUserId(user), [user]);
  const [progress, setProgress] = useState(() => getProgress(progressUserId));
  const [achievements, setAchievements] = useState(() => getAchievements(progressUserId));

  useEffect(() => {
    setProgress(getProgress(progressUserId));
    setAchievements(getAchievements(progressUserId));
  }, [progressUserId]);

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
    const xpToNextLevel = 250 - xpRemainder;
    const levelProgress = Math.min(100, Math.max(0, (xpRemainder / 250) * 100));

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
        clearAIQuestionCache(progressUserId);
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
  ], [progressUserId]);

  const unlockedCount = useMemo(
    () => unlocks.filter((item) => totalXP >= item.xp).length,
    [totalXP, unlocks]
  );

  const nextUnlock = useMemo(
    () => unlocks.find((item) => totalXP < item.xp),
    [totalXP, unlocks]
  );

  const achievementSet = useMemo(() => new Set(achievements.map(a => a.id)), [achievements]);

  const studiedSubjects = Object.entries(progress).filter(([, item]) => item && (item.attempts > 0 || item.totalXP > 0));
  const reviewCount = Object.values(getWrongQuestions(progressUserId)).reduce((sum, items) => sum + (Array.isArray(items) ? items.length : 0), 0);

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
    <main className="quiz-page quiz-workspace quiz-progress-workspace">
      <div className="quiz-masthead">
        <button type="button" className="quiz-text-control" onClick={() => navigate('/quiz')}><Grid2X2 size={16} aria-hidden="true" /> Quiz library</button>
        <span>Smarty <span aria-hidden="true">/</span> Your progress</span>
        <button type="button" className="quiz-text-control" onClick={() => navigate('/progress')}>Review notebook <ArrowUpRight size={16} aria-hidden="true" /></button>
      </div>
      <header className="quiz-progress-intro">
        <span className="quiz-eyebrow">Small steps, lasting knowledge.</span>
        <h1>Your practice,<br />taking shape.</h1>
        <p>A record of what you’ve explored, and where to go next.</p>
      </header>
      <section className="quiz-progress-summary" aria-label="Practice overview">
        <div className="quiz-level-summary">
          <span>Current level</span><strong>{levelStats.level.toString().padStart(2, '0')}</strong>
          <div className="quiz-level-meta"><span>{totalXP} XP earned</span><span>{levelStats.xpToNextLevel} to level {levelStats.level + 1}</span></div>
          <div className="profile-level-track" role="progressbar" aria-label="Progress toward next level" aria-valuenow={Math.round(levelStats.levelProgress)} aria-valuemin={0} aria-valuemax={100}><div className="profile-level-fill" style={{ width: `${levelStats.levelProgress}%` }} /></div>
        </div>
        <div className="quiz-progress-facts">
          <div><strong>{studiedSubjects.length}</strong><span>subjects practiced</span></div>
          <div><strong>{reviewCount}</strong><span>questions to revisit</span></div>
          <div><strong>{achievementSet.size}</strong><span>milestones earned</span></div>
        </div>
      </section>
      <section className="quiz-next-practice">
        <div><span className="quiz-eyebrow">Your next useful step</span><h2>{reviewCount ? 'Turn a tricky idea into a clear one.' : 'Follow your curiosity into a subject.'}</h2><p>{reviewCount ? 'Revisit missed and uncertain answers. Read the reasoning, then try recalling it without help.' : 'Start with a short question set. Every answer includes the reasoning to help you understand.'}</p></div>
        <button type="button" className="quiz-progress-primary" onClick={() => navigate(reviewCount ? '/progress' : '/quiz')}>{reviewCount ? 'Review questions' : 'Choose a subject'}<ArrowUpRight size={17} aria-hidden="true" /></button>
      </section>
      <section className="quiz-subject-records" aria-labelledby="practice-record-title">
        <div className="quiz-progress-section-head"><h2 id="practice-record-title">Your subject record</h2><span>Best practice scores, not exam readiness</span></div>
        {studiedSubjects.length ? studiedSubjects.map(([id, item]) => <div className="quiz-subject-record" key={id}>
          <div><strong>{QUIZ_SUBJECTS.find((subject) => subject.id === id)?.title || id.replaceAll('_', ' ').replaceAll('-', ' ')}</strong><span>{item.attempts || 0} practice sets · {item.totalXP || 0} XP</span></div>
          <div className="quiz-record-score"><span>{Math.min(100, Math.max(0, Number(item.bestPercent) || 0))}%</span><div className="quiz-record-track"><div style={{ width: `${Math.min(100, Math.max(0, Number(item.bestPercent) || 0))}%` }} /></div></div>
        </div>) : <div className="quiz-progress-empty"><h3>Your first subject starts here.</h3><p>Complete a practice set to build your record. There’s no rush.</p><button type="button" className="quiz-text-control" onClick={() => navigate('/quiz')}>Explore the library <ArrowUpRight size={16} aria-hidden="true" /></button></div>}
      </section>
      <details className="quiz-progress-details">
        <summary>Practice extras <span>{unlockedCount} / {unlocks.length} unlocked</span></summary>
        <p>{nextUnlock ? `Next: ${nextUnlock.title}, at ${nextUnlock.xp} XP.` : 'All practice extras are unlocked.'} Review and difficulty selection are always available in the quiz library.</p>
        <div className="unlock-grid">{renderedUnlocks}</div>
      </details>
      <details className="quiz-progress-details">
        <summary>Milestones <span>{achievementSet.size} / {allAchievements.length} earned</span></summary>
        <div className="unlock-grid">{renderedAchievements}</div>
      </details>
      <p className="quiz-progress-storage-note">Practice records shown here are saved on this device for your account.</p>
    </main>
  );
}
