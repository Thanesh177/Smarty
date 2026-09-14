import { lazy, memo, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import confetti from "canvas-confetti";
import {
  getProgress,
  getProgressUserId,
  getVisitStreak,
  getWrongQuestions,
  saveProgress,
  saveWrongQuestion,
} from "../lib/progressStore";
import { getFocusedQuizId, getLearningContext, recordLearningQuiz } from "../lib/learningJourney";
import { getLearningGuide, getGuideQuestions } from "../data/learningGuides";
import { postApi } from "../api/client";
import {
  clearActiveQuiz,
  filterUnseenQuestions,
  getQuestionFingerprint,
  getQuizContextKey,
  getRecentQuestionFingerprints,
  getRecentQuestionPrompts,
  loadActiveQuiz,
  recordQuestionHistory,
  saveActiveQuiz,
} from "../lib/quizQuestionStore";
import { useAuth } from "../contexts/AuthContext";
import "./QuizPage.css";
import { checkAchievements } from "../components/achievements/achievementEngine";
import AchievementToast from "../components/achievements/AchievementToast";
import useSoundFeedback from "../components/audio/useSoundFeedback";
import XPOrb from "../components/ui/XPOrb";


const BrainGameEngine = lazy(() => import("../components/games/BrainGameEngine"));
const BossChallenge = lazy(() => import("../components/boss/BossChallenge"));

const API_BASE_URL = String(import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
const CAN_USE_REMOTE_QUIZ_API = Boolean(API_BASE_URL) && (
  typeof window === "undefined" || window.location.protocol !== "file:"
);

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

const SHARED_FOUNDATION_QUESTIONS = [
  ["What is the strongest way to verify an unfamiliar claim?", "Compare several independent, credible sources", "Trust the first search result", "Rely on how confident it sounds", "Choose the most shared post", "Independent evidence is more reliable than popularity or confident wording."],
  ["What does correlation between two things prove by itself?", "They are related, but not necessarily causal", "One definitely causes the other", "The data must be false", "Both have the same cause", "Correlation can suggest a relationship, but additional evidence is needed to establish causation."],
  ["Which study method usually strengthens long-term recall most effectively?", "Active retrieval over spaced sessions", "Rereading once without testing", "Highlighting every sentence", "Studying only immediately before a test", "Retrieving information and spacing practice strengthens durable memory."],
];

const TOPIC_QUESTION_DATA = {
  memory: [
    ["Which practice most directly strengthens recall?", "Trying to retrieve the answer before checking", "Copying the answer repeatedly", "Reading faster", "Avoiding all mistakes", "Retrieval practice makes the memory easier to access later."],
    ["Why is sleep important after learning?", "It supports memory consolidation", "It deletes older memories", "It prevents all forgetting", "It replaces practice", "Sleep helps stabilize and integrate recently learned information."],
  ],
  politics: [
    ["Why do democracies separate government powers?", "To limit concentrated power through checks and balances", "To eliminate elections", "To make laws secret", "To remove courts", "Separated powers allow institutions to check one another."],
    ["What does the rule of law require?", "Laws apply consistently, including to public officials", "Leaders may ignore courts", "Only voters must follow laws", "Every decision requires a referendum", "The rule of law constrains both citizens and government."],
  ],
  animals: [
    ["What is echolocation?", "Using reflected sound to locate objects", "Seeing ultraviolet heat", "Following Earth's magnetic field only", "Communicating through color", "Animals such as bats can interpret returning sound echoes."],
    ["Why does biodiversity often improve ecosystem resilience?", "Different species can support overlapping ecological roles", "Every species uses identical resources", "It prevents environmental change", "It removes competition completely", "Diverse systems have more pathways for maintaining important functions."],
  ],
  physics: [
    ["According to Newton's second law, acceleration depends on what?", "Net force and mass", "Temperature only", "Object color", "Volume without mass", "Acceleration increases with net force and decreases as mass increases."],
    ["What does conservation of energy mean?", "Energy changes form but is not created or destroyed in an isolated system", "Energy always becomes motion", "Stored energy has no value", "Energy disappears after use", "Total energy remains constant while moving between forms."],
  ],
  trading: [
    ["What is the primary purpose of a stop-loss plan?", "Limit the damage from an adverse move", "Guarantee a profitable trade", "Predict the exact market bottom", "Increase leverage automatically", "Defined exits help keep a single loss from becoming destructive."],
    ["Why do investors diversify?", "To reduce dependence on one asset or risk", "To remove every possible loss", "To maximize trading frequency", "To guarantee market-beating returns", "Diversification spreads exposure instead of concentrating it."],
  ],
  critical_thinking: [
    ["What is an ad hominem fallacy?", "Attacking the person instead of addressing the argument", "Using numerical evidence", "Revising a conclusion", "Comparing two hypotheses", "A person's traits do not by themselves refute their reasoning."],
    ["What is confirmation bias?", "Favoring information that supports an existing belief", "Changing a belief after new evidence", "Checking opposing explanations", "Using a random sample", "Confirmation bias makes supportive evidence easier to notice and accept."],
  ],
  personal_finance: [
    ["What is an emergency fund designed to cover?", "Unexpected essential expenses", "Guaranteed investment returns", "Routine luxury purchases", "Only retirement costs", "Accessible savings reduce the need for expensive debt during surprises."],
    ["What makes compound growth powerful over time?", "Returns can earn additional returns", "Interest rates never change", "All investments are risk free", "Taxes disappear automatically", "Compounding builds on both the original amount and prior growth."],
  ],
  health_fitness: [
    ["What is progressive overload?", "Gradually increasing a training demand", "Exercising at maximum effort daily", "Changing exercises every session", "Avoiding recovery", "Adaptation requires a manageable increase in challenge over time."],
    ["How much sleep do most healthy adults generally need?", "About seven to nine hours", "Two to three hours", "Exactly five hours", "More than fourteen hours", "Most adults function best with roughly seven to nine hours of regular sleep."],
  ],
  psychology: [
    ["What is classical conditioning?", "Learning an association between stimuli", "Learning only through punishment", "Remembering a list in order", "Making a decision with no experience", "A previously neutral cue can acquire meaning through repeated association."],
    ["What is working memory used for?", "Holding and manipulating a small amount of current information", "Storing every lifetime memory", "Controlling reflexes only", "Preventing emotional responses", "Working memory supports tasks such as reasoning and mental calculation."],
  ],
  law_rights: [
    ["What is the usual burden of proof in a criminal trial?", "Beyond a reasonable doubt", "A simple possibility", "The balance of convenience", "No evidence is required", "Criminal conviction generally requires the highest common legal standard of proof."],
    ["Why is due process important?", "It requires fair procedures before government deprives a person of protected interests", "It guarantees every lawsuit succeeds", "It removes judicial review", "It applies only to contracts", "Due process protects people through notice, fairness, and an opportunity to be heard."],
  ],
  ai_technology: [
    ["What does a machine-learning model learn from training data?", "Patterns useful for making predictions or generating outputs", "Perfect certainty about the future", "Human consciousness", "A permanent internet connection", "Models adjust internal parameters to capture statistical patterns."],
    ["What does encryption primarily protect?", "Data confidentiality by making content unreadable without a key", "Battery life", "Screen resolution", "File compression only", "Encryption transforms readable data into protected ciphertext."],
  ],
  cybersecurity: [
    ["What is phishing?", "A deceptive attempt to steal information or access", "A method of compressing files", "A secure backup protocol", "A type of hardware repair", "Phishing impersonates trusted sources to manipulate a target."],
    ["Why does multi-factor authentication improve account security?", "It requires more than one kind of proof", "It makes passwords public", "It disables encryption", "It removes account recovery", "A stolen password alone is less likely to be enough for access."],
  ],
  world_history: [
    ["What is a primary historical source?", "Evidence created during the period being studied", "Any modern textbook", "A fictional retelling", "A search result summary", "Letters, records, artifacts, and contemporary accounts are primary evidence."],
    ["What major change characterized the Industrial Revolution?", "Production shifted toward mechanized factories", "International trade ended", "Cities disappeared", "Agriculture was abandoned everywhere", "Mechanization transformed production, labor, transport, and urban life."],
  ],
  geography_world: [
    ["What does latitude measure?", "Distance north or south of the equator", "Elevation above sea level", "Distance east or west of Greenwich", "Annual rainfall", "Latitude lines describe angular position north or south."],
    ["How does climate differ from weather?", "Climate describes long-term patterns; weather describes short-term conditions", "Climate changes hourly", "Weather is global only", "They mean exactly the same thing", "Weather is immediate; climate summarizes patterns over longer periods."],
  ],
  communication: [
    ["What is active listening?", "Listening to understand and confirming what was heard", "Waiting silently to speak", "Agreeing with every statement", "Repeating the same argument", "Reflection and clarification reduce misunderstanding."],
    ["In negotiation, what is a BATNA?", "The best alternative if no agreement is reached", "The opening demand", "A legally binding offer", "A shared concession", "Knowing the best alternative helps evaluate whether an agreement is worthwhile."],
  ],
  media_literacy: [
    ["What is a useful first step for checking a suspicious image?", "Use reverse-image search and inspect its original context", "Trust the caption", "Count how many likes it has", "Increase its brightness", "Older or unrelated images are often reused with false captions."],
    ["How can a truncated graph axis mislead viewers?", "It can exaggerate small differences", "It always removes the data labels", "It proves the sample is random", "It converts correlation into causation", "A narrow scale can make modest changes look visually dramatic."],
  ],
  career_skills: [
    ["What does STAR help structure in an interview answer?", "Situation, task, action, and result", "Salary, title, availability, and references", "Skills, training, awards, and rank", "Strategy, timing, accuracy, and review", "STAR turns an example into a clear, outcome-focused story."],
    ["What makes workplace feedback most useful?", "It is specific, timely, and actionable", "It focuses on personality", "It is saved for annual reviews only", "It avoids examples", "Clear observations and next steps make feedback easier to use."],
  ],
};

const createLocalQuestions = (topicId) => {
  const rows = [...(TOPIC_QUESTION_DATA[topicId] || []), ...SHARED_FOUNDATION_QUESTIONS];

  return rows.slice(0, 5).map(([q, answer, ...rest], index) => {
    const explanation = rest.pop();
    const distractors = rest;
    const choices = [answer, ...distractors];
    const shift = index % choices.length;
    const options = [...choices.slice(shift), ...choices.slice(0, shift)];

    const question = {
      id: `local-${topicId}-${index + 1}`,
      q,
      options,
      answer,
      explanation,
      difficulty: index < 2 ? "Easy" : index < 3 ? "Medium" : "Hard",
      source: "local",
    };

    return {
      ...question,
      fingerprint: getQuestionFingerprint(question),
    };
  });
};

const QUESTIONS = Object.fromEntries(
  TOPICS.map((topic) => [topic.id, createLocalQuestions(topic.id)]),
);

function shuffleItems(items) {
  const shuffled = [...items];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  return shuffled;
}

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

function getChallengeProfile(topicId, progressMap) {
  const forceHard = localStorage.getItem("smarty-force-hard") === "true";
  const item = progressMap[topicId] || {};
  const bestPercent = Number(item.bestPercent || 0);
  const lastPercent = Number(item.lastPercent ?? item.bestPercent ?? 0);
  const attempts = Number(item.attempts || 0);
  const totalXP = Number(item.totalXP || 0);
  const level = Math.max(1, Number(item.level || Math.floor(totalXP / 100) + 1));

  if (forceHard || level >= 8 || (attempts >= 5 && bestPercent >= 85)) {
    return {
      difficulty: "Hard",
      depth: "Expert",
      level,
      minimumDifficulty: "Hard",
      questionStyle: "multi-step failure analysis, evidence evaluation, edge cases, and transfer to unfamiliar scenarios",
    };
  }

  if (level >= 5 || (attempts >= 3 && bestPercent >= 72 && lastPercent >= 60)) {
    return {
      difficulty: "Hard",
      depth: "Advanced",
      level,
      minimumDifficulty: "Hard",
      questionStyle: "causal reasoning, realistic application, trade-offs, and close plausible distractors",
    };
  }

  if (level >= 3 || attempts >= 2 || bestPercent >= 50) {
    return {
      difficulty: "Medium",
      depth: "Intermediate",
      level,
      minimumDifficulty: "Medium",
      questionStyle: "mechanisms, comparisons, cause and effect, and application to a new example",
    };
  }

  return {
    difficulty: "Easy",
    depth: "Foundation",
    level,
    minimumDifficulty: "Easy",
    questionStyle: "specific concepts, one-step mechanisms, and clear recall with meaningful distractors",
  };
}

function getAdaptiveQuestions(topicId, progressMap, seenFingerprints = []) {
  const all = (QUESTIONS[topicId] || []).map((question) => ({
    ...question,
    options: shuffleItems(question.options),
  }));
  const profile = getChallengeProfile(topicId, progressMap);
  const unseen = filterUnseenQuestions(all, seenFingerprints);

  const preferred = unseen.filter((question) => {
    if (profile.minimumDifficulty === "Hard") return question.difficulty === "Hard";
    if (profile.minimumDifficulty === "Medium") return question.difficulty !== "Easy";
    return question.difficulty === "Easy";
  });
  const remaining = unseen.filter((question) => !preferred.includes(question));

  return [...shuffleItems(preferred), ...shuffleItems(remaining)].slice(0, 5);
}

function getAnswerXP(question, comboCount) {
  const difficultyXP = {
    Easy: 8,
    Medium: 10,
    Hard: 14,
    Adaptive: 12,
  };
  const baseXP = difficultyXP[question?.difficulty] || 10;
  const comboBonus = Math.min(Math.max(comboCount - 1, 0), 3) * 2;
  return baseXP + comboBonus;
}

function normalizeGeneratedQuestions(payload, topicId, {
  excludedFingerprints = [],
  fallbackDifficulty = "Adaptive",
  limit = 5,
} = {}) {
  let parsed = payload;

  if (typeof parsed?.body === "string") {
    try {
      parsed = JSON.parse(parsed.body);
    } catch {
      parsed = payload;
    }
  }

  const values = Array.isArray(parsed)
    ? parsed
    : Array.isArray(parsed?.questions)
      ? parsed.questions
      : Array.isArray(parsed?.items)
        ? parsed.items
        : [];

  const normalized = values.map((question, questionIndex) => {
    const q = String(question?.q || question?.question || question?.prompt || "").trim();
    const rawOptions = question?.options || question?.choices || question?.answers || [];
    const seenOptions = new Set();
    const options = Array.isArray(rawOptions) ? rawOptions
      .map((option) => String(option?.text || option?.label || option || "")
        .replace(/^\s*[A-D][.):\-]\s*/i, "")
        .trim())
      .filter((option) => {
        const key = option.toLocaleLowerCase();
        if (!option || seenOptions.has(key)) return false;
        seenOptions.add(key);
        return true;
      })
      .slice(0, 4) : [];
    const rawAnswer = question?.answer ?? question?.correctAnswer ?? question?.correct ?? question?.correctOption;
    const answerIndex = Number.isInteger(rawAnswer)
      ? rawAnswer
      : /^\d+$/.test(String(rawAnswer || "").trim())
        ? Number(rawAnswer)
        : /^[A-D]$/i.test(String(rawAnswer || "").trim())
          ? String(rawAnswer).trim().toUpperCase().charCodeAt(0) - 65
          : -1;
    const answerText = String(rawAnswer || "")
      .replace(/^\s*[A-D][.):\-]\s*/i, "")
      .trim();
    const answer = answerIndex >= 0
      ? options[answerIndex]
      : options.find((option) => option.toLocaleLowerCase() === answerText.toLocaleLowerCase());
    const difficultyText = String(question?.difficulty || "").trim().toLocaleLowerCase();
    const difficulty = difficultyText === "easy"
      ? "Easy"
      : difficultyText === "medium"
        ? "Medium"
        : difficultyText === "hard"
          ? "Hard"
          : fallbackDifficulty;

    if (q.length < 12 || options.length < 3 || !answer || !options.includes(answer)) return null;

    const normalizedQuestion = {
      id: question?.id || `generated-${topicId}-${questionIndex + 1}`,
      q,
      options,
      answer,
      explanation: String(
        question?.explanation || question?.reason || `The correct answer is ${answer}.`,
      ).trim(),
      difficulty,
      source: "generated",
    };

    return {
      ...normalizedQuestion,
      fingerprint: getQuestionFingerprint(normalizedQuestion),
    };
  }).filter(Boolean);

  return filterUnseenQuestions(normalized, excludedFingerprints).slice(0, limit);
}


function getGradeMessage(percent) {

  if (percent >= 90) return "Elite performance. You are mastering this topic.";

  if (percent >= 70) return "Strong work. You are clearly improving.";

  if (percent >= 50) return "Good effort. Review the explanations and try again.";

  return "This is your training round. Come back stronger next attempt.";

}

function saveStoredTopicProgress(userId, topicId, data) {
  const existing = getProgress(userId);
  const updated = {
    ...existing,
    [topicId]: {
      ...(existing[topicId] || {}),
      ...data,
    },
  };

  saveProgress(updated, userId);
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
const navigate = useNavigate();
const location = useLocation();
const { user } = useAuth();
const [comboCount, setComboCount] = useState(1);
const SURVIVAL_TIME = 12;
const [survivalTimeLeft, setSurvivalTimeLeft] = useState(SURVIVAL_TIME);
const [newAchievements, setNewAchievements] = useState([]);
const sounds = useSoundFeedback();
const survivalMode = useMemo(() => localStorage.getItem("smarty-game-mode") === "survival", []);
const [bossMode, setBossMode] = useState(false);
const [xpGained, setXpGained] = useState(0);
const transitionLockRef = useRef(false);
const focusedQuizStartedRef = useRef('');
const quizAttemptRef = useRef('');
const questionRequestRef = useRef({ id: 0, controller: null });
useEffect(() => () => {
  questionRequestRef.current.id += 1;
  questionRequestRef.current.controller?.abort();
  focusedQuizStartedRef.current = '';
}, []);
const learningUserId = user?.sub || user?.userId || user?.id || user?.username || '';
const quizUserId = useMemo(() => getProgressUserId(user), [user]);

const focusedLearningTopic = useMemo(() => {
  const params = new URLSearchParams(location.search);
  const stateContext = location.state?.learningContext || {};
  const routePost = location.state?.post || getLearningGuide(params.get('postId')) || {};
  const baseContext = getLearningContext(
    { ...routePost, ...stateContext },
    params.get('postId') || stateContext.postId || '',
  );
  const focus = String(params.get('focus') || stateContext.focus || baseContext.focus || '').trim();
  const topicName = String(params.get('topic') || stateContext.topic || baseContext.topic || '').trim();
  const postId = String(params.get('postId') || stateContext.postId || baseContext.postId || '').trim();

  if (!focus || !postId) return null;

  const context = {
    ...baseContext,
    ...stateContext,
    postId,
    topic: topicName || baseContext.topic,
    focus,
    title: stateContext.title || baseContext.title || focus,
    body: stateContext.body || baseContext.body || '',
  };

  return {
    id: getFocusedQuizId(context),
    title: context.focus,
    topic: context.topic,
    focus: context.focus,
    desc: `A focused knowledge check based on “${context.title}”.`,
    emoji: '◎',
    color: 'cyan',
    postId: context.postId,
    sourceTitle: context.title,
    sourceBody: context.body,
    learningContext: context,
    reviewQuestions: Boolean(location.state?.reviewLesson),
  };
}, [location.search, location.state]);

const showXPGain = useCallback((xp) => {
  setXpGained(0);
  requestAnimationFrame(() => {
    setXpGained(xp);
  });
}, []);

  const [topic, setTopic] = useState(null);
  const [reviewMode, setReviewMode] = useState(false);

  const [index, setIndex] = useState(0);

  const [selected, setSelected] = useState("");

  const [score, setScore] = useState(0);

  const [answers, setAnswers] = useState([]);

  const [finished, setFinished] = useState(false);

  const [progress, setProgress] = useState(null);

  const [saving, setSaving] = useState(false);

  const [saveError, setSaveError] = useState("");
  const [quizNotice, setQuizNotice] = useState("");
  const [answerFeedback, setAnswerFeedback] = useState(null);
  const [locked, setLocked] = useState(false);
  const [aiQuestions, setAiQuestions] = useState({});
  const [loadingAI, setLoadingAI] = useState(false);
  const [topicProgressMap, setTopicProgressMap] = useState(() => getProgress(quizUserId));

useEffect(() => {
  setTopicProgressMap(getProgress(quizUserId));
}, [quizUserId]);

const visitProgress = useMemo(() => getVisitStreak(quizUserId), [quizUserId]);
const totalXP = useMemo(() => getTotalXP(topicProgressMap), [topicProgressMap]);
const overallLevel = Math.max(1, Math.floor(totalXP / 250) + 1);
const overallXpPercent = totalXP % 250 ? ((totalXP % 250) / 250) * 100 : totalXP > 0 ? 100 : 0;
    const mixedSteps = useMemo(() => {
  if (!topic) return [];

const quizQuestions = aiQuestions[topic.id] || [];
const games = GAME_STEPS[topic.id] || [];
  if (reviewMode) {
    return quizQuestions.map((question) => ({ type: "mcq", ...question }));
  }
  return [
    quizQuestions[0] && { type: "mcq", ...quizQuestions[0] },
    games[0],
    quizQuestions[1] && { type: "mcq", ...quizQuestions[1] },
    quizQuestions[2] && { type: "mcq", ...quizQuestions[2] },
    games[1],
    quizQuestions[3] && { type: "mcq", ...quizQuestions[3] },
    quizQuestions[4] && { type: "mcq", ...quizQuestions[4] },
  ].filter(Boolean);
}, [topic, aiQuestions, reviewMode]);
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
  const activeChallengeProfile = useMemo(
    () => getChallengeProfile(topic?.id || '', topicProgressMap),
    [topic?.id, topicProgressMap],
  );
  const currentTopicHasAIQuestions = topic ? Array.isArray(aiQuestions[topic.id]) && aiQuestions[topic.id].length > 0 : false;

  const currentOptions = useMemo(() => (
    Array.isArray(current?.options) ? current.options : []
  ), [current]);

  useEffect(() => {
    transitionLockRef.current = false;
  }, [index, topic?.id]);

  const quizShellExtras = useMemo(() => (
    <>
      <AchievementToast achievements={newAchievements} />
      <XPOrb xp={xpGained} combo={comboCount} />
    </>
  ), [comboCount, newAchievements, xpGained]);

  const loadAIQuestions = useCallback(async (topicId, topicDetails = null) => {
    questionRequestRef.current.controller?.abort();
    const requestId = ++questionRequestRef.current.id;
    const controller = new AbortController();
    questionRequestRef.current.controller = controller;
    const isCurrent = () => questionRequestRef.current.id === requestId;
    let selectedTopic = topicDetails || TOPICS.find((item) => item.id === topicId) || { id: topicId };
    const challengeProfile = getChallengeProfile(topicId, topicProgressMap);
    const seen = getRecentQuestionFingerprints(quizUserId, topicId);
    const guide = getLearningGuide(selectedTopic.postId);
    setLoadingAI(true);
    setAiQuestions((prev) => ({ ...prev, [topicId]: [] }));

    const useLocalQuestions = () => {
      if (!isCurrent()) return;
      const questions = guide
        ? filterUnseenQuestions(getGuideQuestions(guide.id), selectedTopic.reviewQuestions ? [] : seen)
            .map((question) => ({ ...question, options: shuffleItems(question.options), fingerprint: getQuestionFingerprint(question) }))
        : selectedTopic.postId ? [] : getAdaptiveQuestions(topicId, topicProgressMap, seen);
      setAiQuestions((prev) => ({ ...prev, [topicId]: questions }));
      setQuizNotice(questions.length
        ? (guide ? (selectedTopic.reviewQuestions ? 'Review practice · revisiting this guide’s questions' : 'Guide check · concepts, examples, and limits') : 'Built-in topic questions')
        : selectedTopic.postId
          ? (guide ? 'You have seen this guide’s questions. Choose review practice to revisit them, or explore a new lesson.'
            : 'A focused quiz is unavailable right now. Revisit the lesson and your reflection, or try again shortly.')
          : 'No unseen built-in questions remain. Reconnect for a fresh challenge.');
    };

    let timeout;
    try {
      if (guide || !CAN_USE_REMOTE_QUIZ_API) {
        useLocalQuestions();
        return;
      }
      timeout = window.setTimeout(() => controller.abort(), 25000);
      if (selectedTopic.postId && !selectedTopic.sourceBody) {
        const post = await postApi.getSingleReel(selectedTopic.postId);
        if (!isCurrent()) return;
        const context = getLearningContext(post, selectedTopic.postId);
        if (!context.body) throw new Error('The source lesson is unavailable.');
        selectedTopic = { ...selectedTopic, sourceTitle: context.title, sourceBody: context.body, learningContext: context };
        setTopic((current) => current?.id === topicId ? selectedTopic : current);
      }
      const contextKey = getQuizContextKey(selectedTopic);
      const active = loadActiveQuiz({ userId: quizUserId, topicId, difficulty: challengeProfile.difficulty, contextKey });
      if (active?.length) {
        const questions = normalizeGeneratedQuestions(active, topicId, {
          excludedFingerprints: seen,
          fallbackDifficulty: challengeProfile.difficulty,
        });
        if (questions.length) {
          setAiQuestions((prev) => ({ ...prev, [topicId]: questions }));
          setQuizNotice('Continue your unfinished challenge');
          return;
        }
        clearActiveQuiz(quizUserId, topicId);
      }
      const collected = [];
      const excluded = new Set(seen);
      for (let attempt = 0; attempt < 2 && collected.length < 5; attempt += 1) {
        const data = await postApi.generateLearningQuiz({
          userId: quizUserId, topicId, topicTitle: selectedTopic.title || topicId,
          parentTopic: selectedTopic.topic || selectedTopic.title || topicId,
          focus: selectedTopic.focus || selectedTopic.title || '',
          sourcePostId: selectedTopic.postId || '', sourceTitle: selectedTopic.sourceTitle || '',
          sourceBody: selectedTopic.sourceBody || '',
          difficulty: challengeProfile.difficulty, minimumDifficulty: challengeProfile.minimumDifficulty,
          learnerLevel: challengeProfile.level, learnerDepth: challengeProfile.depth,
          questionStyle: selectedTopic.postId
            ? challengeProfile.questionStyle + '. Test the source concept: mechanism, cause and effect, a new example, and a limitation. Do not ask for the post title or generic study advice.'
            : challengeProfile.questionStyle,
          requestedCount: 5 - collected.length, generationAttempt: attempt,
          weakAreas: (getWrongQuestions(quizUserId)[topicId] || []).slice(-5).map((item) => item.q),
          recentQuestionFingerprints: [...excluded].slice(-100),
          excludeQuestions: getRecentQuestionPrompts(quizUserId, topicId),
        }, { signal: controller.signal });
        if (!isCurrent()) return;
        const batch = normalizeGeneratedQuestions(data, topicId, {
          excludedFingerprints: [...excluded], fallbackDifficulty: challengeProfile.difficulty, limit: 5 - collected.length,
        }).filter((question) => !selectedTopic.postId || !/which title|what exact concept|name of (the|this) (post|lesson)/i.test(question.q));
        batch.forEach((question) => { collected.push(question); excluded.add(question.fingerprint); });
      }
      if (!collected.length) throw new Error('No unseen questions available.');
      try { saveActiveQuiz({ userId: quizUserId, topicId, difficulty: challengeProfile.difficulty, contextKey, questions: collected }); } catch { /* A quiz still works when storage is full. */ }
      setAiQuestions((prev) => ({ ...prev, [topicId]: collected }));
      setQuizNotice(challengeProfile.depth + ' · ' + collected.length + ' fresh questions');
    } catch (error) {
      if (isCurrent()) useLocalQuestions();
    } finally {
      if (timeout) window.clearTimeout(timeout);
      if (isCurrent()) setLoadingAI(false);
    }
  }, [quizUserId, topicProgressMap]);

  const startQuiz = useCallback((item) => {
    quizAttemptRef.current = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
    const bossPractice = localStorage.getItem("smarty-boss-practice") === "true";
    const isFocusedLesson = Boolean(item?.postId || item?.learningContext?.postId);
    const shouldStartBoss = !isFocusedLesson && (visitProgress.streak >= 7 || bossPractice);

    setBossMode(shouldStartBoss);

    if (bossPractice) {
      localStorage.removeItem("smarty-boss-practice");
    }

    setTopic(item);
    setReviewMode(false);
    transitionLockRef.current = false;
    setIndex(0);
    setScore(0);
    setAnswers([]);
    setSelected("");
    setFinished(false);
    setProgress(null);
    setSaveError("");
    setQuizNotice("");
    setAnswerFeedback(null);
    setLocked(false);
    setXpGained(0);
    setComboCount(1);
    loadAIQuestions(item.id, item);
  }, [loadAIQuestions, visitProgress.streak]);

  useEffect(() => {
    if (!focusedLearningTopic) return;
    if (focusedQuizStartedRef.current === `${quizUserId}:${focusedLearningTopic.id}`) return;

    focusedQuizStartedRef.current = `${quizUserId}:${focusedLearningTopic.id}`;
    startQuiz(focusedLearningTopic);
  }, [focusedLearningTopic, quizUserId, startQuiz]);

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
  setQuizNotice("");
  setAnswerFeedback(null);

  const userId = quizUserId;

  const percentage = mixedSteps.length ? Math.round((finalScore / mixedSteps.length) * 100) : 0;

  const finishRewards = () => {
    const unlocked = checkAchievements({
      topicId: topic.id,
      percentage,
      streak: visitProgress.streak,
      overallLevel,
      userId,
    });

    if (unlocked.length) {
      setNewAchievements(unlocked);
      sounds.levelUp();
    }

    clearActiveQuiz(userId, topic.id);
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    if (percentage >= 60 && !reducedMotion) {
      confetti({ particleCount: 110, spread: 78, origin: { y: 0.65 } });
    }
  };

  try { recordQuestionHistory(userId, topic.id, finalAnswers); } catch { /* Keep results visible if storage is unavailable. */ }

  if (topic?.postId) {
    const checks = finalAnswers.filter((answer) => Array.isArray(answer.options) && answer.options.length > 1);
    recordLearningQuiz(topic.postId, learningUserId, { correct: checks.filter((answer) => answer.isCorrect).length,
      total: checks.length, attemptId: quizAttemptRef.current }, topic.learningContext || { ...topic, postId: topic.postId });
  }

  if (!CAN_USE_REMOTE_QUIZ_API || getLearningGuide(topic?.postId)) {
    const xpEarnedLocal = finalAnswers.reduce(
      (total, answer) => total + (answer.xp || 0),
      0
    );

    const updatedProgress = saveStoredTopicProgress(userId, topic.id, {
      bestScore: Math.max(topicProgressMap[topic.id]?.bestScore || 0, finalScore),
      bestPercent: Math.max(topicProgressMap[topic.id]?.bestPercent || 0, percentage),
      attempts: (topicProgressMap[topic.id]?.attempts || 0) + 1,
      totalXP: (topicProgressMap[topic.id]?.totalXP || 0) + xpEarnedLocal,
      lastScore: finalScore,
      lastPercent: percentage,
      lastDifficulty: activeChallengeProfile.difficulty,
      updatedAt: new Date().toISOString(),
    });

    setTopicProgressMap(updatedProgress);
    finishRewards();
    setSaveError("");
    setSaving(false);
    return;
  }

  const xpEarned = finalAnswers.reduce(
    (total, answer) => total + (answer.xp || 0),
    0
  );

  try {
      const data = (await postApi.saveLearningQuiz({
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
            fingerprint: answer.fingerprint || getQuestionFingerprint({
              q: answer.q,
              answer: answer.correctAnswer,
            }),
            xp: answer.xp || 0,
          })),
      })) || {};

      setProgress(data);
      const updatedProgress = saveStoredTopicProgress(userId, topic.id, {
        bestScore: data.bestScore ?? finalScore,
        bestPercent: Math.max(data.percentage || percentage, topicProgressMap[topic.id]?.bestPercent || 0),
        attempts: data.attempts ?? ((topicProgressMap[topic.id]?.attempts || 0) + 1),
        totalXP: data.totalXP ?? ((topicProgressMap[topic.id]?.totalXP || 0) + xpEarned),
        level: data.level,
        lastScore: finalScore,
        lastPercent: percentage,
        lastDifficulty: activeChallengeProfile.difficulty,
        updatedAt: new Date().toISOString(),
      });

      setTopicProgressMap(updatedProgress);
      finishRewards();
    } catch (error) {
      const updatedProgress = saveStoredTopicProgress(userId, topic.id, {
        bestScore: Math.max(topicProgressMap[topic.id]?.bestScore || 0, finalScore),
        bestPercent: Math.max(topicProgressMap[topic.id]?.bestPercent || 0, percentage),
        attempts: (topicProgressMap[topic.id]?.attempts || 0) + 1,
        totalXP: (topicProgressMap[topic.id]?.totalXP || 0) + xpEarned,
        lastScore: finalScore,
        lastPercent: percentage,
        lastDifficulty: activeChallengeProfile.difficulty,
        updatedAt: new Date().toISOString(),
      });

      setTopicProgressMap(updatedProgress);
      finishRewards();
      setSaveError(error.message || "Could not save quiz progress.");
    } finally {
      setSaving(false);
    }
  }, [activeChallengeProfile.difficulty, learningUserId, mixedSteps.length, overallLevel, quizUserId, sounds, topic, topicProgressMap, visitProgress.streak]);

useEffect(() => {
  if (!topic || finished || !current || !survivalMode || locked || bossMode) return;

  setSurvivalTimeLeft(SURVIVAL_TIME);

  const timer = setInterval(() => {
    setSurvivalTimeLeft((prev) => {
      if (prev <= 1) {
        clearInterval(timer);
        if (transitionLockRef.current) return 0;
        transitionLockRef.current = true;

        const timeoutAnswer = {
          id: current.id || `timeout-${topic.id}-${index}`,
          q: current.q || current.gameType || "Survival Challenge",
          selected: "Timed out",
          correctAnswer: current.answer || "Time ran out",
          explanation: "You ran out of time. Survival mode trains fast thinking.",
          difficulty: current.difficulty || "Survival",
          fingerprint: current.fingerprint || getQuestionFingerprint(current),
          source: current.source,
          isCorrect: false,
          xp: 0,
          options: currentOptions,
        };

        const nextAnswers = [...answers, timeoutAnswer];
        setAnswers(nextAnswers);
        if (current.type === "mcq") saveWrongQuestion(topic.id, timeoutAnswer, quizUserId);
        try { recordQuestionHistory(quizUserId, topic.id, [timeoutAnswer]); } catch { /* Keep the timer responsive if storage is unavailable. */ }

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
}, [answers, bossMode, current, currentOptions, finished, index, locked, mixedSteps.length, quizUserId, saveQuizProgress, score, survivalMode, topic]);

const submitAnswer = useCallback(() => {
  if (locked || transitionLockRef.current || !selected || !current) return;

  transitionLockRef.current = true;
  setLocked(true);

  const isCorrect = selected === current.answer;

  const earnedXP = isCorrect ? getAnswerXP(current, comboCount) : 0;

  if (isCorrect) {
    sounds.correct();
    setComboCount((prev) => prev + 1);
    showXPGain(earnedXP);
  } else {
    sounds.wrong();
    setComboCount(1);
    setXpGained(0);
  }

  const nextScore = score + (isCorrect ? 1 : 0);

  const answerRecord = {
      id: current.id,
      q: current.q,
      selected,
      correctAnswer: current.answer,
      explanation: current.explanation,
      difficulty: current.difficulty,
      fingerprint: current.fingerprint || getQuestionFingerprint(current),
      source: current.source,
      isCorrect,
      xp: earnedXP,
      options: currentOptions,
    };

  if (!isCorrect && current.type === "mcq") {
    saveWrongQuestion(topic.id, answerRecord, quizUserId);
  }

  try { recordQuestionHistory(quizUserId, topic.id, [answerRecord]); } catch { /* An answer still counts if storage is unavailable. */ }

  const nextAnswers = [...answers, answerRecord];

  setAnswers(nextAnswers);
  setScore(nextScore);
  setAnswerFeedback({
    isCorrect,
    selected,
    correctAnswer: current.answer,
    explanation: current.explanation,
    xp: earnedXP,
    nextScore,
    nextAnswers,
  });
}, [answers, comboCount, current, currentOptions, locked, quizUserId, score, selected, showXPGain, sounds, topic]);

const advanceAfterAnswer = useCallback(() => {
  if (!answerFeedback || transitionLockRef.current === "advancing") return;
  transitionLockRef.current = "advancing";

  if (index + 1 < mixedSteps.length) {
    setIndex((prev) => prev + 1);
    setSelected("");
    setLocked(false);
    setAnswerFeedback(null);
  } else {
    setFinished(true);
    saveQuizProgress(answerFeedback.nextScore, answerFeedback.nextAnswers);
  }
}, [answerFeedback, index, mixedSteps.length, saveQuizProgress]);

useEffect(() => {
  if (!topic || finished || current?.type !== "mcq") return undefined;

  const handleQuizKeyboard = (event) => {
    if (event.target instanceof HTMLElement && event.target.closest("button, input, textarea, select, a")) return;

    const optionKeys = ["1", "2", "3", "4", "a", "b", "c", "d"];
    const pressedKey = event.key.toLowerCase();
    const keyIndex = optionKeys.indexOf(pressedKey);

    if (keyIndex >= 0 && !locked && !answerFeedback) {
      const optionIndex = keyIndex % 4;
      const option = currentOptions[optionIndex];
      if (option) {
        event.preventDefault();
        setSelected(option);
      }
      return;
    }

    if (event.key === "Enter") {
      if (answerFeedback) {
        event.preventDefault();
        advanceAfterAnswer();
      } else if (selected && !locked) {
        event.preventDefault();
        submitAnswer();
      }
    }
  };

  window.addEventListener("keydown", handleQuizKeyboard);
  return () => window.removeEventListener("keydown", handleQuizKeyboard);
}, [advanceAfterAnswer, answerFeedback, current?.type, currentOptions, finished, locked, selected, submitAnswer, topic]);

const restart = useCallback(() => {
  questionRequestRef.current.id += 1;
  questionRequestRef.current.controller?.abort();
  setLoadingAI(false);
  setBossMode(false);
  localStorage.removeItem("smarty-boss-practice");
  localStorage.removeItem("smarty-game-mode");

  setTopic(null);
  setReviewMode(false);
  transitionLockRef.current = false;
  setIndex(0);
  setSelected("");
  setScore(0);
  setAnswers([]);
  setFinished(false);
  setProgress(null);
  setSaveError("");
  setQuizNotice("");
  setAnswerFeedback(null);
  setLocked(false);
  setXpGained(0);
  setComboCount(1);
}, []);

const returnToFocusedLesson = useCallback(() => {
  if (!focusedLearningTopic?.postId) return;

  navigate(`/post-ai/${encodeURIComponent(focusedLearningTopic.postId)}`, {
    state: {
      learningContext: focusedLearningTopic.learningContext,
      post: {
        ...(location.state?.post || {}),
        ...focusedLearningTopic.learningContext,
      },
    },
  });
}, [focusedLearningTopic, location.state, navigate]);

const exploreFocusedTopic = useCallback(() => {
  if (!focusedLearningTopic?.topic) return;
  navigate(`/feed?topic=${encodeURIComponent(focusedLearningTopic.topic)}`);
}, [focusedLearningTopic, navigate]);

const missedQuestions = useMemo(
  () => answers.filter((answer) => !answer.isCorrect && Array.isArray(answer.options) && answer.options.length > 1),
  [answers],
);

const difficultyResults = useMemo(() => {
  const groups = new Map();

  answers
    .filter((answer) => Array.isArray(answer.options) && answer.options.length > 1)
    .forEach((answer) => {
      const label = answer.difficulty || "Adaptive";
      const currentGroup = groups.get(label) || { label, correct: 0, total: 0 };
      currentGroup.total += 1;
      currentGroup.correct += answer.isCorrect ? 1 : 0;
      groups.set(label, currentGroup);
    });

  return [...groups.values()].map((group) => ({
    ...group,
    percent: Math.round((group.correct / Math.max(group.total, 1)) * 100),
  }));
}, [answers]);

const nextLearningMove = useMemo(() => {
  if (missedQuestions.length > 0) {
    const weakest = [...difficultyResults].sort((left, right) => left.percent - right.percent)[0];
    return {
      eyebrow: "Recommended next",
      title: `Repair ${missedQuestions.length} knowledge ${missedQuestions.length === 1 ? "gap" : "gaps"}`,
      description: weakest
        ? `Start with the ${weakest.label.toLowerCase()} questions. Read why the correct choice works, then retry only what you missed.`
        : "Review each explanation, explain the idea in your own words, then retry only what you missed.",
    };
  }

  return {
    eyebrow: "Recommended next",
    title: `Move into ${activeChallengeProfile.depth === "Expert" ? "a connected topic" : "deeper reasoning"}`,
    description: activeChallengeProfile.depth === "Expert"
      ? "You have a strong command of this set. Apply it to a connected subject to strengthen transfer."
      : "Your next challenge will introduce closer distractors, real examples, and more cause-and-effect reasoning.",
  };
}, [activeChallengeProfile.depth, difficultyResults, missedQuestions.length]);

const startMistakeReview = useCallback(() => {
  if (!topic || missedQuestions.length === 0) return;
  quizAttemptRef.current = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;

  const retryQuestions = missedQuestions.map((answer, questionIndex) => ({
    id: `review-${answer.id || questionIndex}-${Date.now()}`,
    q: answer.q,
    options: shuffleItems(answer.options),
    answer: answer.correctAnswer,
    explanation: answer.explanation,
    difficulty: answer.difficulty || "Adaptive",
    source: "review",
    fingerprint: answer.fingerprint || getQuestionFingerprint({
      q: answer.q,
      answer: answer.correctAnswer,
    }),
  }));

  setAiQuestions((previous) => ({ ...previous, [topic.id]: retryQuestions }));
  setReviewMode(true);
  setBossMode(false);
  setIndex(0);
  setSelected("");
  setScore(0);
  setAnswers([]);
  setFinished(false);
  setProgress(null);
  setSaveError("");
  setQuizNotice(`Focused review · ${retryQuestions.length} missed ${retryQuestions.length === 1 ? "question" : "questions"}`);
  setAnswerFeedback(null);
  setLocked(false);
  setXpGained(0);
  setComboCount(1);
  transitionLockRef.current = false;
}, [missedQuestions, topic]);

  const finalScore = score;

  const percentage = mixedSteps.length ? Math.round((finalScore / mixedSteps.length) * 100) : 0;

  const won = percentage >= (topic?.postId ? 80 : 60);

  const xpPreview = answers.reduce((total, answer) => total + (answer.xp || 0), 0);

  const previousScore = progress?.previousScore ?? null;

  const improvement = progress?.improvement ?? (previousScore === null ? 0 : finalScore - previousScore);
const handleBossComplete = useCallback((result) => {
  if (transitionLockRef.current) return;
  transitionLockRef.current = true;

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
  if (transitionLockRef.current) return;
  transitionLockRef.current = true;

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
            <h2>{loadingAI ? "Preparing your quiz..." : "Questions unavailable"}</h2>
            <p>
              {loadingAI
                ? "Smarty is creating fresh questions for this topic."
                : (quizNotice || "Smarty could not prepare this challenge. Please try again.")}
            </p>
            {!loadingAI && (
              <button type="button" className="submit-answer-btn" onClick={() => loadAIQuestions(topic.id, topic)}>
                Try Again
              </button>
            )}
            {!loadingAI && getLearningGuide(topic?.postId) && <button type="button" className="submit-answer-btn" onClick={() => loadAIQuestions(topic.id, { ...topic, reviewQuestions: true })}>Review this guide’s questions</button>}
            {!loadingAI && topic?.postId && <button type="button" className="back-btn" onClick={returnToFocusedLesson}>Return to the lesson</button>}
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
    onClick={() => navigate(-1)}
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
          onClick={() => navigate("/game-profile")}
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
          {topic?.postId && <p>{percentage >= 80 && mixedSteps.length >= 3 ? 'Concept check passed. Revisit it tomorrow, then build on a connected idea.' : 'Review the explanations below. A full check needs at least three questions and 80% correct.'}</p>}

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

          <section className="quiz-next-move" aria-labelledby="quiz-next-move-title">
            <span>{nextLearningMove.eyebrow}</span>
            <h2 id="quiz-next-move-title">{nextLearningMove.title}</h2>
            <p>{nextLearningMove.description}</p>
            {difficultyResults.length > 0 && (
              <div className="quiz-difficulty-results" aria-label="Accuracy by difficulty">
                {difficultyResults.map((item) => (
                  <span key={item.label}>
                    {item.label} <strong>{item.correct}/{item.total}</strong>
                  </span>
                ))}
              </div>
            )}
          </section>

          <div className="review-panel">

            <h3>Review Your Answers</h3>

            {renderedReviewItems}

          </div>

          <div className="result-actions">

            {focusedLearningTopic?.postId && <button type="button" onClick={() => navigate(`/learn?topic=${encodeURIComponent(focusedLearningTopic.topic)}`)}>Choose my next lesson →</button>}

            {focusedLearningTopic?.postId && (
              <button type="button" onClick={returnToFocusedLesson}>Review Lesson</button>
            )}

            {missedQuestions.length > 0 && (
              <button type="button" onClick={startMistakeReview}>Practice Mistakes</button>
            )}

            <button type="button" onClick={() => startQuiz(topic)}>Retry Topic</button>

            <button type="button" onClick={restart} className="secondary-btn">
              Choose Another Topic
            </button>

            {focusedLearningTopic?.topic && (
              <button type="button" onClick={exploreFocusedTopic} className="secondary-btn">
                Find Similar Ideas
              </button>
            )}

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
            onClick={() => navigate("/game-profile")}
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
        <div className="quiz-session-stats" aria-label="Current quiz status">
          <span>{activeChallengeProfile.depth} · {current?.difficulty || activeChallengeProfile.difficulty}</span>
          <span>Score <strong>{score}</strong></span>
          <span className={comboCount > 1 ? "is-active" : ""}>Combo <strong>{comboCount}×</strong></span>
        </div>
        {quizNotice && <p className="quiz-source-notice">{quizNotice}</p>}
        {focusedLearningTopic && (
          <div className="focused-quiz-source">
            <span>Focused lesson</span>
            <strong>{focusedLearningTopic.topic}</strong>
          </div>
        )}
        {survivalMode && (
  <div className="survival-timer">
    <span>⏱ Survival</span>
    <strong>{survivalTimeLeft}s</strong>
  </div>
)}


        <div key={current?.id || `${topic?.id}-${index}`} className="quiz-question-stage">
          <h2>{current?.q || "Challenge question"}</h2>

<div className="option-list">
  {currentOptions.map((option, optionIndex) => (
    <button
      key={option}
      className={[
        "option-btn",
        selected === option ? "selected" : "",
        answerFeedback?.correctAnswer === option ? "correct" : "",
        answerFeedback && selected === option && !answerFeedback.isCorrect ? "wrong" : "",
      ].filter(Boolean).join(" ")}
      type="button"
      onClick={() => !locked && setSelected(option)}
      disabled={locked}
      aria-pressed={selected === option}
      data-key={String.fromCharCode(65 + optionIndex)}
    >
      {option}
    </button>
  ))}
</div>

{answerFeedback && (
  <div
    className={`answer-feedback ${answerFeedback.isCorrect ? "correct" : "wrong"}`}
    role="status"
    aria-live="polite"
  >
    <div className="answer-feedback-heading">
      <span aria-hidden="true">{answerFeedback.isCorrect ? "✓" : "↗"}</span>
      <div>
        <small>{answerFeedback.isCorrect ? "Strong reasoning" : "Build the connection"}</small>
        <strong>{answerFeedback.isCorrect ? `Correct · +${answerFeedback.xp} XP` : "Not quite yet"}</strong>
      </div>
    </div>
    {!answerFeedback.isCorrect && (
      <div className="answer-comparison">
        <p><span>Your choice</span>{answerFeedback.selected}</p>
        <p><span>Correct answer</span>{answerFeedback.correctAnswer}</p>
      </div>
    )}
    <div className="answer-explanation">
      <span>Why this works</span>
      <p>{answerFeedback.explanation}</p>
    </div>
  </div>
)}

{currentOptions.length === 0 && (
  <p className="save-error">
    This question could not load properly. Please go back and try again.
  </p>
)}

        <button
          type="button"
          className="submit-answer-btn"
          onClick={answerFeedback ? advanceAfterAnswer : submitAnswer}
          disabled={!answerFeedback && (!selected || locked || (current?.options || []).length === 0)}
        >
          {answerFeedback
            ? (index + 1 === mixedSteps.length ? "View Results" : "Next Challenge")
            : "Check Answer"}
        </button>
        </div>

      </section>
{quizShellExtras}
    </main>

  );

}
