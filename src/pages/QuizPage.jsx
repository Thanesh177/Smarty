import { lazy, memo, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import confetti from "canvas-confetti";
import { saveWrongQuestion, getWrongQuestions } from "../lib/progressStore";
import "./QuizPage.css";
import { checkAchievements } from "../components/achievements/achievementEngine";
import AchievementToast from "../components/achievements/AchievementToast";
import useSoundFeedback from "../components/audio/useSoundFeedback";
import XPOrb from "../components/ui/XPOrb";


const BrainGameEngine = lazy(() => import("../components/games/BrainGameEngine"));
const BossChallenge = lazy(() => import("../components/boss/BossChallenge"));

const API_BASE_URL = String(import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

const buildApiUrl = (path) => {
  if (!API_BASE_URL) return '';
  return `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
};

const TOPICS = [

  {

    id: "memory",

    title: "Memory Boost",

    emoji: "🧠",

    desc: "Train recall, attention, learning speed, and long-term memory.",

    color: "blue",

  },

  {

    id: "politics",

    title: "Political Knowledge",

    emoji: "🏛️",

    desc: "Understand democracy, power, elections, rights, and world affairs.",

    color: "purple",

  },

  {

    id: "animals",

    title: "Animal Intelligence",

    emoji: "🐾",

    desc: "Explore wildlife, habitats, survival, evolution, and animal behaviour.",

    color: "green",

  },

  {

    id: "physics",

    title: "Physics Lab",

    emoji: "⚛️",

    desc: "Master forces, motion, energy, electricity, space, and real-world physics.",

    color: "cyan",

  },



  {

    id: "trading",

    title: "Trading & Markets",

    emoji: "📈",

    desc: "Learn market psychology, risk, charts, investing, and trading discipline.",

    color: "pink",

  },

  {
  id: "critical_thinking",
  title: "Critical Thinking",
  emoji: "🧩",
  desc: "Spot bias, weak arguments, logical fallacies, and bad reasoning.",
  color: "cyan",
},
{
  id: "personal_finance",
  title: "Personal Finance",
  emoji: "💰",
  desc: "Learn budgeting, saving, debt, investing, taxes, and money decisions.",
  color: "green",
},
{
  id: "health_fitness",
  title: "Health & Fitness",
  emoji: "🏋️",
  desc: "Understand nutrition, sleep, exercise, heart health, and habits.",
  color: "orange",
},
{
  id: "psychology",
  title: "Psychology",
  emoji: "🧠",
  desc: "Learn behaviour, emotions, habits, memory, motivation, and thinking.",
  color: "purple",
},
{
  id: "law_rights",
  title: "Law & Rights",
  emoji: "⚖️",
  desc: "Understand contracts, rights, duties, evidence, and legal reasoning.",
  color: "blue",
},
{
  id: "ai_technology",
  title: "AI & Technology",
  emoji: "🤖",
  desc: "Learn AI, automation, data, algorithms, privacy, and future tech.",
  color: "pink",
},
{
  id: "cybersecurity",
  title: "Cybersecurity",
  emoji: "🛡️",
  desc: "Protect yourself from scams, phishing, hacking, and privacy risks.",
  color: "cyan",
},
{
  id: "world_history",
  title: "World History",
  emoji: "🏺",
  desc: "Learn civilizations, wars, revolutions, empires, and major turning points.",
  color: "orange",
},
{
  id: "geography_world",
  title: "World Geography",
  emoji: "🌍",
  desc: "Master countries, climate, resources, maps, borders, and global systems.",
  color: "green",
},
{
  id: "communication",
  title: "Communication",
  emoji: "🗣️",
  desc: "Improve persuasion, listening, negotiation, confidence, and clarity.",
  color: "purple",
},
{
  id: "media_literacy",
  title: "Media Literacy",
  emoji: "📰",
  desc: "Detect misinformation, propaganda, fake news, and misleading statistics.",
  color: "blue",
},
{
  id: "career_skills",
  title: "Career Skills",
  emoji: "💼",
  desc: "Build interview skills, workplace judgment, leadership, and professionalism.",
  color: "pink",
},

];

const QUESTIONS = {};

const TopicCard = memo(function TopicCard({ item, progress, onStart }) {
  return (
    <button
      type="button"
      className={`topic-card ${item.color}`}
      onClick={() => onStart(item)}
      aria-label={`Start ${item.title} quiz`}
    >
      <div className="topic-card-top">
        <span className="topic-emoji">{item.emoji}</span>

        <div className="topic-mini-stats">
          <span className="level-badge">LVL {progress.level}</span>

          <div className="mini-bar-group">
            <div className="mini-bar-row">
              <span>Mastery</span>
              <strong>{progress.bestPercent}%</strong>
            </div>
            <div className="mini-progress-track">
              <div
                className="mini-progress-fill"
                style={{ width: `${progress.bestPercent}%` }}
              />
            </div>
          </div>

          <div className="mini-bar-group">
            <div className="mini-bar-row">
              <span>XP</span>
              <strong>{progress.xpInLevel}/100</strong>
            </div>
            <div className="mini-progress-track">
              <div
                className="mini-progress-fill xp-fill"
                style={{ width: `${progress.xpInLevel}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      <h3>{item.title}</h3>
      <p>{item.desc}</p>
      <strong>Start challenge →</strong>
    </button>
  );
});

const ReviewItem = memo(function ReviewItem({ answer, answerIndex }) {
  return (
    <article className={answer.isCorrect ? "review-item correct" : "review-item wrong"}>
      <div>
        <strong>Q{answerIndex + 1}. {answer.q}</strong>
        <p>Your answer: {answer.selected}</p>
        {!answer.isCorrect && <p>Correct answer: {answer.correctAnswer}</p>}
        <small>{answer.explanation}</small>
      </div>
      <span>{answer.isCorrect ? "✅" : "❌"}</span>
    </article>
  );
});

const QuizLoadingCard = memo(function QuizLoadingCard({ label = "Loading challenge..." }) {
  return (
    <div className="ai-loading-card compact-loading-card">
      <div className="result-animation" />
      <h2>{label}</h2>
      <p>Preparing your next Smarty challenge.</p>
    </div>
  );
});

const GAME_STEPS = {
  memory: [
    { type: "game", gameType: "sequence" },
      { type: "game", gameType: "memoryPalace" },
    { type: "game", gameType: "wordRecall" },
  ],
  politics: [
    { type: "game", gameType: "decision" },
    { type: "game", gameType: "patternMatch" },
  ],
  animals: [
    { type: "game", gameType: "patternMatch" },
    { type: "game", gameType: "wordRecall" },
  ],
  physics: [
    { type: "game", gameType: "patternMatch" },
      { type: "game", gameType: "scienceLab" },
    { type: "game", gameType: "sequence" },
  ],
  daily: [
    { type: "game", gameType: "wordRecall" },
    { type: "game", gameType: "sequence" },
  ],
  trading: [
    { type: "game", gameType: "tradingCandle" },
    { type: "game", gameType: "decision" },
    { type: "game", gameType: "marketSurvival" },
  ],
  health_fitness: [

  { type: "game", gameType: "lifeCrisis" },

  { type: "game", gameType: "decision" },

],

ai_technology: [

  { type: "game", gameType: "scienceLab" },

  { type: "game", gameType: "patternMatch" },

],
};

function getDifficultyForTopic(topicId, progressMap) {
  const forceHard = localStorage.getItem("smarty-force-hard") === "true";
  if (forceHard) return "Hard";

  const item = progressMap[topicId] || {};
  const bestPercent = item.bestPercent || 0;

  if (bestPercent >= 80) return "Hard";
  if (bestPercent >= 50) return "Medium";
  return "Easy";
}

function getAdaptiveQuestions(topicId, progressMap) {
  const all = QUESTIONS[topicId] || [];
  const level = getDifficultyForTopic(topicId, progressMap);

  const filtered = all.filter((q) => {
    if (level === "Hard") return q.difficulty !== "Easy";
    if (level === "Medium") return q.difficulty !== "Hard";
    return q.difficulty !== "Hard";
  });

  return filtered.length >= 5 ? filtered.slice(0, 5) : all.slice(0, 5);
}

function getStoredGuestId() {
  const existing = localStorage.getItem("smarty-user-id");

  if (existing) return existing;

  const randomId = globalThis.crypto?.randomUUID
    ? globalThis.crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  const created = `guest-${randomId}`;

  localStorage.setItem("smarty-user-id", created);

  return created;
}

function getActiveQuizKey(topicId) {
  return `smarty-active-quiz-${topicId}`;
}

function getStoredActiveQuiz(topicId) {
  try {
    const saved = localStorage.getItem(getActiveQuizKey(topicId));
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
}

function saveActiveQuiz(topicId, questions) {
  localStorage.setItem(getActiveQuizKey(topicId), JSON.stringify(questions));
}

function clearActiveQuiz(topicId) {
  localStorage.removeItem(getActiveQuizKey(topicId));
}


function getGradeMessage(percent) {

  if (percent >= 90) return "Elite performance. You are mastering this topic.";

  if (percent >= 70) return "Strong work. You are clearly improving.";

  if (percent >= 50) return "Good effort. Review the explanations and try again.";

  return "This is your training round. Come back stronger next attempt.";

}

function getVisitStreak() {
  const today = new Date().toISOString().split("T")[0];

  const saved = JSON.parse(localStorage.getItem("smarty-visit-streak") || "{}");

  if (!saved.lastVisit) {
    const data = { streak: 1, lastVisit: today };
    localStorage.setItem("smarty-visit-streak", JSON.stringify(data));
    return data;
  }

  if (saved.lastVisit === today) return saved;

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayText = yesterday.toISOString().split("T")[0];

  const newStreak = saved.lastVisit === yesterdayText ? saved.streak + 1 : 0;

  const data = {
    streak: newStreak === 0 ? 1 : newStreak,
    lastVisit: today,
  };

  localStorage.setItem("smarty-visit-streak", JSON.stringify(data));
  return data;
}

function getStoredTopicProgress() {
  try {
    return JSON.parse(localStorage.getItem("smarty-topic-progress") || "{}");
  } catch {
    return {};
  }
}

function saveStoredTopicProgress(topicId, data) {
  const existing = getStoredTopicProgress();
  const updated = {
    ...existing,
    [topicId]: {
      ...(existing[topicId] || {}),
      ...data,
    },
  };

  localStorage.setItem("smarty-topic-progress", JSON.stringify(updated));
  return updated;
}

function getTopicProgressDetails(topicId, progressMap) {
  const item = progressMap[topicId] || {};
  const bestPercent = item.bestPercent || 0;
  const totalXP = item.totalXP || 0;

  return {
    bestPercent,
    level: Math.max(1, Math.floor(totalXP / 100) + 1),
    xpInLevel: totalXP % 100,
    attempts: item.attempts || 0,
    label:
      bestPercent >= 90
        ? "Master"
        : bestPercent >= 70
        ? "Advanced"
        : bestPercent >= 40
        ? "Improving"
        : bestPercent > 0
        ? "Started"
        : "New Quest",
  };
}

function getTotalXP(progressMap) {
  return Object.values(progressMap).reduce(
    (total, item) => total + (item.totalXP || 0),
    0
  );
}



export default function QuizPage() {
const [comboCount, setComboCount] = useState(1);
const SURVIVAL_TIME = 12;
const [survivalTimeLeft, setSurvivalTimeLeft] = useState(SURVIVAL_TIME);
const [newAchievements, setNewAchievements] = useState([]);
const sounds = useSoundFeedback();
const survivalMode = useMemo(() => localStorage.getItem("smarty-game-mode") === "survival", []);
const [bossMode, setBossMode] = useState(false);
const [xpGained, setXpGained] = useState(0);

const showXPGain = useCallback((xp) => {
  setXpGained(0);
  requestAnimationFrame(() => {
    setXpGained(xp);
  });
}, []);

  const [topic, setTopic] = useState(null);

  const [index, setIndex] = useState(0);

  const [selected, setSelected] = useState("");

  const [score, setScore] = useState(0);

  const [answers, setAnswers] = useState([]);

  const [finished, setFinished] = useState(false);

  const [progress, setProgress] = useState(null);

  const [saving, setSaving] = useState(false);

  const [saveError, setSaveError] = useState("");
  const [locked, setLocked] = useState(false);
  const [aiQuestions, setAiQuestions] = useState({});
  const [loadingAI, setLoadingAI] = useState(false);
  const [topicProgressMap, setTopicProgressMap] = useState(() => getStoredTopicProgress());

const visitProgress = useMemo(() => getVisitStreak(), []);
const totalXP = useMemo(() => getTotalXP(topicProgressMap), [topicProgressMap]);
const overallLevel = Math.max(1, Math.floor(totalXP / 250) + 1);
const overallXpPercent = totalXP % 250 ? ((totalXP % 250) / 250) * 100 : totalXP > 0 ? 100 : 0;
    const mixedSteps = useMemo(() => {
  if (!topic) return [];

const quizQuestions = aiQuestions[topic.id] || [];
const games = GAME_STEPS[topic.id] || [];
  return [
    quizQuestions[0] && { type: "mcq", ...quizQuestions[0] },
    games[0],
    quizQuestions[1] && { type: "mcq", ...quizQuestions[1] },
    quizQuestions[2] && { type: "mcq", ...quizQuestions[2] },
    games[1],
    quizQuestions[3] && { type: "mcq", ...quizQuestions[3] },
    quizQuestions[4] && { type: "mcq", ...quizQuestions[4] },
  ].filter(Boolean);
}, [topic, aiQuestions]);
const streakGoal = 7;
const streakPercent = Math.min((visitProgress.streak / streakGoal) * 100, 100);

const topicProgressDetails = useMemo(() => {
  const details = {};

  for (const item of TOPICS) {
    details[item.id] = getTopicProgressDetails(item.id, topicProgressMap);
  }

  return details;
}, [topicProgressMap]);


const renderedReviewItems = useMemo(
  () => answers.map((answer, answerIndex) => (
    <ReviewItem
      key={answer.id || `${answer.q}-${answerIndex}`}
      answer={answer}
      answerIndex={answerIndex}
    />
  )),
  [answers]
);


  const current = mixedSteps[index];
  const currentTopicHasAIQuestions = topic ? Array.isArray(aiQuestions[topic.id]) && aiQuestions[topic.id].length > 0 : false;

  const currentOptions = useMemo(() => (
    Array.isArray(current?.options) ? current.options : []
  ), [current]);

  const quizShellExtras = useMemo(() => (
    <>
      <AchievementToast achievements={newAchievements} />
      <XPOrb xp={xpGained} combo={comboCount} />
    </>
  ), [comboCount, newAchievements, xpGained]);

  const loadAIQuestions = useCallback(async (topicId) => {
  if (!API_BASE_URL) {
    setLoadingAI(false);
    setSaveError("AI API is not configured. Add VITE_API_BASE_URL to your .env file.");
    return;
  }
  const activeQuiz = getStoredActiveQuiz(topicId);

if (Array.isArray(activeQuiz) && activeQuiz.length > 0) {
  setAiQuestions((prev) => ({
    ...prev,
    [topicId]: activeQuiz,
  }));
  setLoadingAI(false);
  return;
}

  setLoadingAI(true);

  setAiQuestions((prev) => ({
    ...prev,
    [topicId]: [],
  }));

  try {
    const difficulty = getDifficultyForTopic(topicId, topicProgressMap);
    const userId = getStoredGuestId();

    const wrongQuestions = getWrongQuestions();
    const weakAreas = (wrongQuestions[topicId] || [])
      .slice(-3)
      .map((item) => item.q);

    const res = await fetch(buildApiUrl('/quiz/generate'), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        userId,
        topicId,
        difficulty,
        weakAreas,
      }),
    });

    if (!res.ok) {
      throw new Error("AI generation failed.");
    }

    const data = await res.json();

    if (!Array.isArray(data.questions) || data.questions.length === 0) {
      throw new Error("AI returned no questions.");
    }

saveActiveQuiz(topicId, data.questions);

setAiQuestions((prev) => ({
  ...prev,
  [topicId]: data.questions,
}));
  } catch (error) {
    setSaveError(error.message || "AI questions could not be loaded.");
  } finally {
    setLoadingAI(false);
  }
}, [topicProgressMap]);

  const startQuiz = useCallback((item) => {
    const bossPractice = localStorage.getItem("smarty-boss-practice") === "true";
    const shouldStartBoss = visitProgress.streak >= 7 || bossPractice;

    setBossMode(shouldStartBoss);

    if (bossPractice) {
      localStorage.removeItem("smarty-boss-practice");
    }

    setTopic(item);
    setIndex(0);
    setScore(0);
    setAnswers([]);
    setSelected("");
    setFinished(false);
    setProgress(null);
    setSaveError("");
    setLocked(false);
    setXpGained(0);
    setComboCount(1);
    loadAIQuestions(item.id);
  }, [loadAIQuestions, visitProgress.streak]);

const renderedTopics = useMemo(
  () => TOPICS.map((item) => (
    <TopicCard
      key={item.id}
      item={item}
      progress={topicProgressDetails[item.id]}
      onStart={startQuiz}
    />
  )),
  [topicProgressDetails, startQuiz]
);

const saveQuizProgress = useCallback(async (finalScore, finalAnswers) => {
  setSaving(true);
  setSaveError("");

  const userId = getStoredGuestId();

  const percentage = mixedSteps.length ? Math.round((finalScore / mixedSteps.length) * 100) : 0;

  if (!API_BASE_URL) {
    const xpEarnedLocal = finalAnswers.reduce(
      (total, answer) => total + (answer.xp || 0),
      0
    );

    const updatedProgress = saveStoredTopicProgress(topic.id, {
      bestScore: Math.max(topicProgressMap[topic.id]?.bestScore || 0, finalScore),
      bestPercent: Math.max(topicProgressMap[topic.id]?.bestPercent || 0, percentage),
      attempts: (topicProgressMap[topic.id]?.attempts || 0) + 1,
      totalXP: (topicProgressMap[topic.id]?.totalXP || 0) + xpEarnedLocal,
      lastScore: finalScore,
      updatedAt: new Date().toISOString(),
    });

    setTopicProgressMap(updatedProgress);
    clearActiveQuiz(topic.id);
    setSaveError("Progress saved locally. API is not configured.");
    setSaving(false);
    return;
  }

  const xpEarned = finalAnswers.reduce(
    (total, answer) => total + (answer.xp || 0),
    0
  );

  try {
      const res = await fetch(buildApiUrl('/quiz/save'), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId,
          topicId: topic.id,
          topicTitle: topic.title,
          score: finalScore,
          totalQuestions: mixedSteps.length,
          percentage,
          xpEarned,
          answers: finalAnswers.map((answer) => ({
            id: answer.id,
            question: answer.q,
            selected: answer.selected,
            correctAnswer: answer.correctAnswer,
            explanation: answer.explanation,
            isCorrect: answer.isCorrect,
            difficulty: answer.difficulty,
            xp: answer.xp || 0,
          })),
        }),
      });

      if (!res.ok) {
        throw new Error("Could not save quiz progress.");
      }

      const data = await res.json();

      setProgress(data);
      const updatedProgress = saveStoredTopicProgress(topic.id, {
        bestScore: data.bestScore ?? finalScore,
        bestPercent: Math.max(data.percentage || percentage, topicProgressMap[topic.id]?.bestPercent || 0),
        attempts: data.attempts ?? ((topicProgressMap[topic.id]?.attempts || 0) + 1),
        totalXP: data.totalXP ?? ((topicProgressMap[topic.id]?.totalXP || 0) + xpEarned),
        level: data.level,
        lastScore: finalScore,
        updatedAt: new Date().toISOString(),
      });

      setTopicProgressMap(updatedProgress);
      const unlocked = checkAchievements({
        topicId: topic.id,
        percentage,
        streak: visitProgress.streak,
        overallLevel,
      });

      if (unlocked.length) {
        setNewAchievements(unlocked);
        sounds.levelUp();
      }
      clearActiveQuiz(topic.id);

      if (percentage >= 60) {
        confetti({
          particleCount: 140,
          spread: 85,
          origin: { y: 0.65 },
        });
      }
    } catch (error) {
      const updatedProgress = saveStoredTopicProgress(topic.id, {
        bestScore: Math.max(topicProgressMap[topic.id]?.bestScore || 0, finalScore),
        bestPercent: Math.max(topicProgressMap[topic.id]?.bestPercent || 0, percentage),
        attempts: (topicProgressMap[topic.id]?.attempts || 0) + 1,
        totalXP: (topicProgressMap[topic.id]?.totalXP || 0) + xpEarned,
        lastScore: finalScore,
        updatedAt: new Date().toISOString(),
      });

      setTopicProgressMap(updatedProgress);
      clearActiveQuiz(topic.id);
      setSaveError(error.message || "Could not save quiz progress.");
    } finally {
      setSaving(false);
    }
  }, [mixedSteps.length, overallLevel, sounds, topic, topicProgressMap, visitProgress.streak]);

useEffect(() => {
  if (!topic || finished || !current || !survivalMode) return;

  setSurvivalTimeLeft(SURVIVAL_TIME);

  const timer = setInterval(() => {
    setSurvivalTimeLeft((prev) => {
      if (prev <= 1) {
        clearInterval(timer);

        const timeoutAnswer = {
          id: current.id || `timeout-${topic.id}-${index}`,
          q: current.q || current.gameType || "Survival Challenge",
          selected: "Timed out",
          correctAnswer: current.answer || "Time ran out",
          explanation: "You ran out of time. Survival mode trains fast thinking.",
          difficulty: current.difficulty || "Survival",
          isCorrect: false,
          xp: 0,
        };

        const nextAnswers = [...answers, timeoutAnswer];
        setAnswers(nextAnswers);

        if (index + 1 < mixedSteps.length) {
          setIndex((prevIndex) => prevIndex + 1);
          setSelected("");
        } else {
          setFinished(true);
          saveQuizProgress(score, nextAnswers);
        }

        return 0;
      }

      return prev - 1;
    });
  }, 1000);

  return () => clearInterval(timer);
}, [answers, current, finished, index, mixedSteps.length, saveQuizProgress, score, survivalMode, topic]);

const submitAnswer = useCallback(() => {
  if (locked || !selected || !current) return;

  setLocked(true);

  const isCorrect = selected === current.answer;

  if (isCorrect) {
    sounds.correct();
    setComboCount((prev) => prev + 1);
    showXPGain(10);
  } else {
    sounds.wrong();
    setComboCount(1);
    setXpGained(0);
  }

  if (!isCorrect && current.type === "mcq") {
    saveWrongQuestion(topic.id, current);
  }

  const nextScore = score + (isCorrect ? 1 : 0);

  const nextAnswers = [
    ...answers,
    {
      id: current.id,
      q: current.q,
      selected,
      correctAnswer: current.answer,
      explanation: current.explanation,
      difficulty: current.difficulty,
      isCorrect,
      xp: isCorrect ? 10 : 0,
    },
  ];

  setAnswers(nextAnswers);
  setScore(nextScore);

  if (index + 1 < mixedSteps.length) {
    setIndex((prev) => prev + 1);
    setSelected("");
    setLocked(false);
  } else {
    setFinished(true);
    saveQuizProgress(nextScore, nextAnswers);
  }
}, [answers, current, index, locked, mixedSteps.length, saveQuizProgress, score, selected, showXPGain, sounds, topic]);

const restart = useCallback(() => {
  setBossMode(false);
  localStorage.removeItem("smarty-boss-practice");
  localStorage.removeItem("smarty-game-mode");

  setTopic(null);
  setIndex(0);
  setSelected("");
  setScore(0);
  setAnswers([]);
  setFinished(false);
  setProgress(null);
  setSaveError("");
  setLocked(false);
  setXpGained(0);
  setComboCount(1);
}, []);

  const finalScore = score;

  const percentage = mixedSteps.length ? Math.round((finalScore / mixedSteps.length) * 100) : 0;

  const won = percentage >= 60;

  const xpPreview = answers.reduce((total, answer) => total + (answer.xp || 0), 0);

  const previousScore = progress?.previousScore ?? null;

  const improvement = progress?.improvement ?? (previousScore === null ? 0 : finalScore - previousScore);
const handleBossComplete = useCallback((result) => {
  if (result.success) {
    sounds.correct();
    setComboCount((prev) => prev + 1);
    showXPGain(10);
  } else {
    sounds.wrong();
    setComboCount(1);
    setXpGained(0);
  }

  const bossScore = result.success ? score + 2 : score;

  const nextAnswers = [
    ...answers,
    {
      id: `boss-${topic.id}-${Date.now()}`,
      q: "Boss Level",
      selected: result.success ? "Completed" : "Failed",
      correctAnswer: "Boss challenge",
      explanation: result.message,
      difficulty: "Boss",
      isCorrect: result.success,
      xp: result.success ? 10 : 0,
    },
  ];

  setScore(bossScore);
  setAnswers(nextAnswers);
  setBossMode(false);
  localStorage.removeItem("smarty-boss-practice");
  setIndex(0);
  setFinished(true);
  saveQuizProgress(bossScore, nextAnswers);
}, [answers, saveQuizProgress, score, showXPGain, sounds, topic]);

const handleGameComplete = useCallback((result) => {
  if (result.success) {
    sounds.correct();
    setComboCount((prev) => prev + 1);
    showXPGain(10);
  } else {
    sounds.wrong();
    setComboCount(1);
    setXpGained(0);
  }

  const nextScore = score + (result.success ? 1 : 0);
  const nextAnswers = [
    ...answers,
    {
      id: `game-${topic.id}-${current.gameType}-${index}`,
      q: current.gameType,
      selected: result.success ? "Completed" : "Failed",
      correctAnswer: "Game challenge",
      explanation: result.message,
      difficulty: "Game",
      isCorrect: result.success,
      xp: result.success ? 10 : 0,
    },
  ];

  setScore(nextScore);
  setAnswers(nextAnswers);

  if (index + 1 < mixedSteps.length) {
    setIndex((prev) => prev + 1);
  } else {
    setFinished(true);
    saveQuizProgress(nextScore, nextAnswers);
  }
}, [answers, current, index, mixedSteps.length, saveQuizProgress, score, showXPGain, sounds, topic]);

if (topic && bossMode && !finished) {
  return (
    <main className="quiz-page">
      <section className="question-card">
        <div className="quiz-top-row">
          <button type="button" className="back-btn" onClick={restart}><span className="arrow">←</span> Topics</button>
          <span>Boss Level</span>
        </div>

        <Suspense fallback={<QuizLoadingCard label="Loading boss level..." />}>
          <BossChallenge
            topicId={topic.id}
            onComplete={handleBossComplete}
          />
        </Suspense>
      </section>

      {quizShellExtras}
    </main>
  );
}

  if (topic && !currentTopicHasAIQuestions && !finished) {
    return (
      <main className="quiz-page">
        <section className="question-card">
          <div className="quiz-top-row">
            <button type="button" className="back-btn" onClick={restart}><span className="arrow">←</span> Topics</button>
            <span>Smarty Quiz</span>
          </div>

          <div className="ai-loading-card">
            <h2>{loadingAI ? "Generating your quiz..." : " questions unavailable"}</h2>
            <p>
              {loadingAI
                ? "Smarty is creating fresh questions for this topic."
                : saveError || "Please check your AI API setup and try again."}
            </p>
            {!loadingAI && (
              <button type="button" className="submit-answer-btn" onClick={() => loadAIQuestions(topic.id)}>
                Try Again
              </button>
            )}
          </div>
        </section>
        {quizShellExtras}
      </main>
    );
  }
  if (!topic) {

    return (

<main className="quiz-page">
  <button
    className="back-btn quiz-page-back"
    onClick={() => window.history.back()}
  >
    <span className="arrow">←</span> Back
  </button>

  <section className="quiz-hero">
    <div className="quiz-hero-copy">
      <span className="quiz-kicker">Play · learn · improve</span>
      <h1>Turn curiosity into momentum.</h1>
      <p>
        Choose a subject and sharpen your knowledge through quick challenges,
        practical questions, and progress you can see.
      </p>

      <div className="quiz-hero-metrics" aria-label="Quiz progress summary">
        <span><strong>{TOPICS.length}</strong> subjects</span>
        <span><strong>{overallLevel}</strong> current level</span>
        <span><strong>{totalXP}</strong> total XP</span>
      </div>

      <div className="hero-actions">
        <button
          type="button"
          className="profile-btn"
          onClick={() => window.location.href = "/game-profile"}
        >
          View Game Profile
        </button>
      </div>
    </div>

<div className="streak-card streak-game-card">
  <div className="streak-card-top">
    <div className="streak-flame">🔥</div>

<div className="streak-mini-stats">
  <span className="level-badge">LVL {overallLevel}</span>

  <div className="mini-bar-group">
    <div className="mini-bar-row">
      <span>Streak</span>
      <strong>{visitProgress.streak}/{streakGoal}</strong>
    </div>

    <div className="mini-progress-track">
      <div
        className="mini-progress-fill streak-fill"
        style={{ width: `${streakPercent}%` }}
      />
    </div>
  </div>

  <div className="mini-bar-group">
    <div className="mini-bar-row">
      <span>Total XP</span>
      <strong>{totalXP}</strong>
    </div>

    <div className="mini-progress-track">
      <div
        className="mini-progress-fill total-xp-fill"
        style={{ width: `${overallXpPercent}%` }}
      />
    </div>
  </div>
</div>
  </div>

  <h3>{visitProgress.streak} Day Streak · {totalXP} XP</h3>
<p>Open Smarty every day, earn XP, and keep the flame alive.</p>
</div>

        </section>

        <section className="topic-grid">
{renderedTopics}
        </section>
{quizShellExtras}
      </main>

    );

  }

  if (finished) {

    

    return (

      <main className="quiz-page">

        <section className={`result-card ${won ? "win" : "lose"}`}>

          <div className="result-animation">{won ? "🏆" : ""}</div>

          <p className="quiz-kicker">{topic.emoji} {topic.title}</p>

          <h1>{won ? "Amazing work!" : "Good try — keep improving!"}</h1>

          <div className="score-ring">

            <span>{percentage}%</span>

            <small>{finalScore}/{mixedSteps.length}</small>

          </div>

          <p>{getGradeMessage(percentage)}</p>

          <div className="progress-insight">

            <h3> Your Growth Report</h3>

            {saving && <p>Saving your progress to AWS...</p>}

            {saveError && <p className="save-error">{saveError}</p>}

            <div className="stat-grid">

              <div>

                <span>Current Score</span>

                <strong>{finalScore}/{mixedSteps.length}</strong>

              </div>

              <div>

                <span>XP Earned</span>

                <strong>+{progress?.xpEarned ?? xpPreview}</strong>

              </div>



              <div>

                <span>Improvement</span>

                <strong>{improvement > 0 ? `+${improvement}` : improvement}</strong>

              </div>

              <div>

                <span>Best Score</span>

                <strong>{progress?.bestScore ?? finalScore}</strong>

              </div>






            </div>

          </div>

          <div className="review-panel">

            <h3>Review Your Answers</h3>

            {renderedReviewItems}

          </div>

          <div className="result-actions">

            <button type="button" onClick={() => startQuiz(topic)}>Retry Topic</button>

            <button type="button" onClick={restart} className="secondary-btn">
              Choose Another Topic
            </button>

          </div>

        </section>
{quizShellExtras}
      </main>

    );

  }

  if (topic && current?.type === "game" && !finished) {
  return (
    <main className="quiz-page">
      <section className="question-card">
        <div className="quiz-top-row">
          <button type="button" className="back-btn" onClick={restart}><span className="arrow">←</span> Topics</button>
          <span>
            Challenge {index + 1}/{mixedSteps.length}
          </span>
        </div>

<div className="progress-track">
  <div
    className="progress-fill"
    style={{ width: `${((index + 1) / mixedSteps.length) * 100}%` }}
  />
</div>

{survivalMode && (
  <div className="survival-timer">
    <span>⏱ Survival</span>
    <strong>{survivalTimeLeft}s</strong>
  </div>
)}



        <Suspense fallback={<QuizLoadingCard />}>
          <BrainGameEngine
            game={current}
            topicId={topic.id}
            onComplete={handleGameComplete}
          />
        </Suspense>
      </section>
      {quizShellExtras}
    </main>
  );
}
  

  return (

    

    <main className="quiz-page">

      <section className="question-card">

        <div className="quiz-top-row">
          <div className="top-left">
            <button className="back-btn" onClick={restart}><span className="arrow">←</span> Topics</button>
          </div>

          <span>
            Challenge {index + 1}/{mixedSteps.length}
          </span>

          <button
            type="button"
            className="profile-mini-btn"
            onClick={() => window.location.href = "/game-profile"}
          >
            🎮
          </button>
        </div>

        <div className="progress-track">

          <div

            className="progress-fill"

            style={{ width: `${((index + 1) / mixedSteps.length) * 100}%` }}

          />

        </div>
        {survivalMode && (
  <div className="survival-timer">
    <span>⏱ Survival</span>
    <strong>{survivalTimeLeft}s</strong>
  </div>
)}


        <h2>{current?.q || "Challenge question"}</h2>
        
<div className="option-list">
  {currentOptions.map((option) => (
    <button
      key={option}
      className={selected === option ? "option-btn selected" : "option-btn"}
      type="button"
      onClick={() => !locked && setSelected(option)}
      disabled={locked}
      aria-pressed={selected === option}
    >
      {option}
    </button>
  ))}
</div>

{currentOptions.length === 0 && (
  <p className="save-error">
    This question could not load properly. Please go back and try again.
  </p>
)}

        <button
          type="button"
          className="submit-answer-btn"
          onClick={submitAnswer}
          disabled={!selected || locked || (current?.options || []).length === 0}
        >
          {index + 1 === mixedSteps.length ? "Finish Quiz" : "Lock Answer"}
        </button>

      </section>
{quizShellExtras}
    </main>

  );

}
