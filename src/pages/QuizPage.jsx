import { lazy, memo, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { recordMeaningfulEngagement } from '../lib/appEngagement';
import {
  getProgress,
  getProgressUserId,
  getVisitStreak,
  getWrongQuestions,
  saveProgress,
  saveWrongQuestion,
  removeWrongQuestion,
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
import "./QuizLearning.css";
import "./QuizWorkspace.css";
import { normalizeGeneratedQuestions, needsQuizReview, getQuizResult, getSavedReviewDeck, readQuizFlag, clearQuizFlag } from '../lib/quizLearning.js';
import { QUIZ_SUBJECTS, SUBJECT_QUESTIONS } from '../data/quizSubjects.js';
import { getQuizChapters, getQuizLessons, getQuizLesson, getRelatedQuizLessons, makeLessonQuizTopic, getLessonStudyReference } from '../data/quizLessons.js';
import { getLessonTopicQuestions } from '../data/quizLessonQuestions.js';
import { selectLessonQuestions, selectBalancedLessonSet, hasBroadLessonCoverage, getLessonQuestionStyle, summarizeLessonCoverage, summarizeLessonSkills } from '../lib/quizLessonPractice.js';
import QuizLessonLibrary from '../components/QuizLessonLibrary';
import './QuizLessons.css';
import { checkAchievements } from "../components/achievements/achievementEngine";
import useSoundFeedback from "../components/audio/useSoundFeedback";
import QuizSubjectArt from '../components/QuizSubjectArt';
import { ArrowRight, ArrowUpRight, Search, Check, ChartNoAxesColumnIncreasing, ChevronDown, SlidersHorizontal, X } from 'lucide-react';
import QuizPracticeControls, { getQuizPracticeLevel } from '../components/QuizPracticeControls';
import { ArcadeLobby, ArcadeProgress, ArcadeRecap, ArcadeShell, ArcadeStage } from '../components/games/QuizArcade';


const BrainGameEngine = lazy(() => import("../components/games/BrainGameEngine"));
const BossChallenge = lazy(() => import("../components/boss/BossChallenge"));

const API_BASE_URL = String(import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
const CAN_USE_REMOTE_QUIZ_API = Boolean(API_BASE_URL) && (
  typeof window === "undefined" || window.location.protocol !== "file:"
);

const LEGACY_TOPICS = [

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

const TOPICS = QUIZ_SUBJECTS;
const SUBJECT_BY_ID = new Map(TOPICS.map(item => [item.id, item]));
const SUBJECT_FILTERS = [['all', 'All subjects'], ['stem', 'Science & tech'], ['people', 'People & culture'], ['everyday', 'Everyday knowledge']];
const SUBJECT_GROUPS = {
  stem: ['technology', 'engineering', 'science-mathematics', 'life-sciences', 'earth-space'],
  people: ['history', 'society-ideas', 'arts-design', 'community'],
  everyday: ['news', 'mind-health', 'money-business', 'food-agriculture'],
};

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
  if (SUBJECT_QUESTIONS[topicId]) return SUBJECT_QUESTIONS[topicId].map((question) => ({
    ...question, fingerprint: getQuestionFingerprint(question),
  }));
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
  [...TOPICS, ...LEGACY_TOPICS].map((topic) => [topic.id, createLocalQuestions(topic.id)]),
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
      className="topic-card quiz-subject-card"
      onClick={() => onStart(item)}
      aria-label={`Explore ${item.title} lessons`}
    >
      <div className="quiz-subject-top"><QuizSubjectArt subject={item.id} />{progress.attempts > 0 && <span><Check size={13} aria-hidden="true" /> Practised</span>}</div>
      <h3>{item.title}</h3>
      <p>{item.desc}</p>
      <div className="quiz-subject-areas">{(item.subjects || []).slice(0, 3).map((area) => <span key={area}>{area}</span>)}</div>
      <div className="quiz-subject-bottom"><span>{getQuizChapters(item.id).length} lessons</span><span className="quiz-subject-open"><ArrowUpRight size={17} aria-hidden="true" /><span className="sr-only">Explore lessons</span></span></div>
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
        {answer.confidence === 'unsure' && <p className="quiz-review-tag">Marked unsure · revisit this idea</p>}
        <small>{answer.explanation}</small>
      </div>
      <span className="quiz-review-result">{answer.isCorrect ? <Check size={16} aria-hidden="true" /> : <X size={16} aria-hidden="true" />}<span className="sr-only">{answer.isCorrect ? 'Correct' : 'Incorrect'}</span></span>
    </article>
  );
});

const QuizLoadingCard = memo(function QuizLoadingCard({ label = "Loading challenge..." }) {
  return (
    <div className="ai-loading-card compact-loading-card" role="status">
      <div className="quiz-loading-lines" aria-hidden="true"><span /><span /><span /></div>
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

const GAME_SUBJECTS = {
  technology: 'ai_technology', engineering: 'physics', 'science-mathematics': 'physics',
  'life-sciences': 'animals', 'earth-space': 'geography_world', 'mind-health': 'memory',
  'money-business': 'personal_finance', history: 'world_history', 'society-ideas': 'critical_thinking',
  'arts-design': 'communication', news: 'media_literacy', community: 'communication',
};
const NO_GAME_STEPS = [];
const getSubjectGameSteps = id => GAME_STEPS[GAME_SUBJECTS[id] || id] || NO_GAME_STEPS;

function getChallengeProfile(topicId, progressMap) {
  const forceHard = readQuizFlag("smarty-force-hard") === "true";
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
  // Keep the level honest: a short matched set is better than silently filling with easier questions.
  return shuffleItems(preferred).slice(0, 5);
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


function getGradeMessage(percent) {

  if (percent >= 90) return "This set went well. Try a new application, then revisit it later to check recall.";

  if (percent >= 70) return "A useful start. Revisit the uncertain ideas before increasing the difficulty.";

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
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  if (loading) return <ArcadeShell backLabel="Feed" onBack={() => navigate('/feed?topic=All')}>
    <section className="arcade-screen"><QuizLoadingCard label="Getting your practice ready…" /></section>
  </ArcadeShell>;
  const account = user?.sub || user?.userId || user?.id || user?.username || 'guest';
  return <QuizSession key={account} />;
}

function QuizSession() {
const navigate = useNavigate();
const location = useLocation();
const { user } = useAuth();
const selectedLibrarySubject = useMemo(() => SUBJECT_BY_ID.get(new URLSearchParams(location.search).get('subject')) || null, [location.search]);
const openSubject = useCallback(item => navigate('/quiz?subject=' + encodeURIComponent(item.id)), [navigate]);
const openProgress = useCallback(() => navigate('/game-profile'), [navigate]);
const [comboCount, setComboCount] = useState(1);
const SURVIVAL_TIME = 12;
const [survivalTimeLeft, setSurvivalTimeLeft] = useState(SURVIVAL_TIME);
const [soundEnabled, setSoundEnabled] = useState(false);
const sounds = useSoundFeedback({ enabled: soundEnabled });
const survivalMode = useMemo(() => readQuizFlag("smarty-game-mode") === "survival", []);
const [bossMode, setBossMode] = useState(false);
const [bossRequested, setBossRequested] = useState(() => readQuizFlag('smarty-boss-practice') === 'true');
const [sessionMode, setSessionMode] = useState(() => survivalMode ? 'mixed' : 'practice');
const studyTrack = 'college';
const [practiceLevel, setPracticeLevel] = useState('Easy');
const { difficultyPreference, challengeMode } = getQuizPracticeLevel(practiceLevel);
const examTarget = '';
const [subjectQuery, setSubjectQuery] = useState('');
const [libraryFilter, setLibraryFilter] = useState('all');
const [lessonLibraryView, setLessonLibraryView] = useState(null);
const [confidence, setConfidence] = useState('unmarked');
const [reviewFilter, setReviewFilter] = useState('all');
const quizLocationRef = useRef(location.key);
const finishRequestRef = useRef('');
const questionHeadingRef = useRef(null);
const resultHeadingRef = useRef(null);
const reviewHeadingRef = useRef(null);
const answerFeedbackRef = useRef(null);
const transitionLockRef = useRef(false);
const focusedQuizStartedRef = useRef('');
const quizAttemptRef = useRef('');
const questionRequestRef = useRef({ id: 0, controller: null });
useEffect(() => () => {
  questionRequestRef.current.id += 1;
  questionRequestRef.current.controller?.abort();
  focusedQuizStartedRef.current = '';
  quizAttemptRef.current = '';
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

  const [topic, setTopic] = useState(null);
  const [reviewMode, setReviewMode] = useState(false);

  const [index, setIndex] = useState(0);

  const [selected, setSelected] = useState("");

  const [score, setScore] = useState(0);

  const [answers, setAnswers] = useState([]);

  const [finished, setFinished] = useState(false);
  useEffect(() => {
    if (!finished) return;
    const heading = resultHeadingRef.current;
    heading?.closest('.content')?.scrollTo({ top: 0, behavior: 'instant' });
    heading?.focus({ preventScroll: true });
  }, [finished]);

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
const activeFormat = topic?.format ?? sessionMode;
    const mixedSteps = useMemo(() => {
  if (!topic) return [];

const quizQuestions = aiQuestions[topic.id] || [];
const games = getSubjectGameSteps(topic.id);
  if (reviewMode || activeFormat === 'practice' || topic.lessonId) {
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
}, [topic, aiQuestions, reviewMode, activeFormat]);

const topicProgressDetails = useMemo(() => {
  const details = {};

  for (const item of TOPICS) {
    details[item.id] = { ...getTopicProgressDetails(item.id, topicProgressMap),
      attempts: Object.entries(topicProgressMap).filter(([id]) => id === item.id || id.startsWith(item.id + '--'))
        .reduce((total, [, record]) => total + (Number(record?.attempts) || 0), 0) };
  }

  return details;
}, [topicProgressMap]);


const renderedReviewItems = useMemo(
  () => answers.map((answer, answerIndex) => ({ answer, answerIndex }))
    .filter(({ answer }) => reviewFilter === 'all' || (reviewFilter === 'missed' ? !answer.isCorrect : answer.confidence === 'unsure'))
    .map(({ answer, answerIndex }) => (
    <ReviewItem
      key={answer.id || `${answer.q}-${answerIndex}`}
      answer={answer}
      answerIndex={answerIndex}
    />
  )),
  [answers, reviewFilter]
);


  const current = mixedSteps[index];
  const activeChallengeProfile = useMemo(
    () => ({ ...getChallengeProfile(topic?.id || '', topicProgressMap),
      ...(topic?.difficultyPreference ? { difficulty: topic.difficultyPreference, depth: { Easy: 'Foundation', Medium: 'Application', Hard: 'Challenge' }[topic.difficultyPreference] } : {}) }),
    [topic, topicProgressMap],
  );
  const currentTopicHasAIQuestions = topic ? Array.isArray(aiQuestions[topic.id]) && aiQuestions[topic.id].length > 0 : false;

  const currentOptions = useMemo(() => (
    Array.isArray(current?.options) ? current.options : []
  ), [current]);

  useEffect(() => {
    if (finished || current?.type !== 'mcq') return;
    const heading = questionHeadingRef.current;
    if (!heading) return;
    heading.focus({ preventScroll: true });
    const rect = heading.getBoundingClientRect();
    if (index === 0 || rect.top < 16 || rect.bottom > window.innerHeight * .7) {
      heading.closest('.content')?.scrollTo({ top: 0, behavior: 'instant' });
    }
  }, [current?.id, index, finished]);

  useEffect(() => {
    transitionLockRef.current = false;
    setConfidence('unmarked');
  }, [index, topic?.id]);

  const hasFeedback = Boolean(answerFeedback);
  useEffect(() => {
    if (!hasFeedback) return;
    const feedback = answerFeedbackRef.current;
    feedback?.focus({ preventScroll: true });
    feedback?.scrollIntoView({ block: 'nearest', behavior: 'instant' });
  }, [hasFeedback]);

  const loadAIQuestions = useCallback(async (topicId, topicDetails = null) => {
    questionRequestRef.current.controller?.abort();
    const requestId = ++questionRequestRef.current.id;
    const controller = new AbortController();
    questionRequestRef.current.controller = controller;
    const isCurrent = () => questionRequestRef.current.id === requestId;
    let selectedTopic = topicDetails || TOPICS.find((item) => item.id === topicId) || { id: topicId };
    const wholeLesson = Boolean(selectedTopic.lessonId && !selectedTopic.conceptId);
    const candidateCount = wholeLesson ? 8 : 5;
    const chooseQuestions = questions => wholeLesson
      ? selectBalancedLessonSet(selectedTopic, questions, 6).map(question => ({ ...question, options: shuffleItems(question.options) }))
      : questions;
    const reference = getLessonStudyReference(selectedTopic);
    const challengeProfile = { ...getChallengeProfile(topicId, topicProgressMap),
      ...(selectedTopic.difficultyPreference ? { difficulty: selectedTopic.difficultyPreference,
        minimumDifficulty: selectedTopic.difficultyPreference,
        depth: { Easy: 'Foundation', Medium: 'Application', Hard: 'Challenge' }[selectedTopic.difficultyPreference] } : {}) };
    const seen = [...new Set([...getRecentQuestionFingerprints(quizUserId, topicId),
      ...(selectedTopic.baseTopicId ? getRecentQuestionFingerprints(quizUserId, selectedTopic.baseTopicId, 500) : [])])];
    const recentPrompts = [...new Set([...getRecentQuestionPrompts(quizUserId, topicId),
      ...(selectedTopic.baseTopicId ? getRecentQuestionPrompts(quizUserId, selectedTopic.baseTopicId) : [])])];
    const guide = getLearningGuide(selectedTopic.postId);
    const lessonQuestions = selectedTopic.lessonId ? selectLessonQuestions(selectedTopic, {
      seen, difficulty: challengeProfile.difficulty, review: selectedTopic.reviewQuestions,
      includeApplication: wholeLesson && !selectedTopic.difficultyPreference,
      limit: wholeLesson ? 6 : 5,
    }).map(question => ({ ...question, options: shuffleItems(question.options) })) : [];
    setLoadingAI(true);
    setAiQuestions((prev) => ({ ...prev, [topicId]: [] }));

    const useLocalQuestions = () => {
      if (!isCurrent()) return;
      const questions = selectedTopic.lessonId ? lessonQuestions : guide
        ? filterUnseenQuestions(getGuideQuestions(guide.id), selectedTopic.reviewQuestions ? [] : seen)
            .map((question) => ({ ...question, source: selectedTopic.reviewQuestions ? 'review' : question.source,
              options: shuffleItems(question.options), fingerprint: getQuestionFingerprint(question) }))
        : selectedTopic.postId ? [] : selectedTopic.reviewQuestions
          ? shuffleItems(QUESTIONS[topicId] || []).slice(0, 5).map((question) => ({ ...question, options: shuffleItems(question.options), source: 'review' }))
          : selectedTopic.difficultyPreference
            ? shuffleItems(filterUnseenQuestions(QUESTIONS[topicId] || [], seen)
              .filter((question) => question.difficulty === selectedTopic.difficultyPreference)).slice(0, 5)
              .map((question) => ({ ...question, options: shuffleItems(question.options) }))
            : getAdaptiveQuestions(topicId, topicProgressMap, seen);
      setAiQuestions((prev) => ({ ...prev, [topicId]: questions }));
      setQuizNotice(questions.length
        ? (selectedTopic.reviewQuestions ? 'Review practice · no new XP or exam-readiness score'
          : selectedTopic.lessonId ? `${questions.length} built-in questions with worked explanations`
            : guide ? 'Guide check · concepts, examples, and limits' : 'Original practice bank · general preparation, not a complete exam syllabus')
        : selectedTopic.lessonId
          ? (getLessonTopicQuestions(selectedTopic).length
            ? 'No unseen built-in questions remain at this level. Try a fresh online set, choose another level, or review this lesson’s built-in questions.'
            : 'This lesson needs online questions. Check your connection and try again, or choose a lesson marked Built-in practice.')
          : selectedTopic.postId
          ? (guide ? 'You have seen this guide’s questions. Choose review practice to revisit them, or explore a new lesson.'
            : 'A focused quiz is unavailable right now. Revisit the lesson or try again shortly.')
          : 'No unseen built-in questions remain. Reconnect for a fresh challenge.');
    };

    let timeout;
    try {
      if (guide || selectedTopic.reviewQuestions || !CAN_USE_REMOTE_QUIZ_API
        || (wholeLesson ? hasBroadLessonCoverage(selectedTopic, lessonQuestions) : lessonQuestions.length >= 3)) {
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
      const contextKey = getQuizContextKey({ ...selectedTopic, ...reference });
      const active = loadActiveQuiz({ userId: quizUserId, topicId, difficulty: challengeProfile.difficulty, contextKey });
      if (active?.length) {
        const questions = normalizeGeneratedQuestions(active, topicId, {
          excludedFingerprints: seen,
          fallbackDifficulty: challengeProfile.difficulty,
          requiredDifficulty: selectedTopic.lessonId ? challengeProfile.difficulty : selectedTopic.difficultyPreference || '',
          excludedPrompts: recentPrompts,
          limit: candidateCount,
        });
        if (questions.length) {
          setAiQuestions((prev) => ({ ...prev, [topicId]: chooseQuestions(questions) }));
          setQuizNotice('Saved question set · fresh unanswered questions');
          return;
        }
        clearActiveQuiz(quizUserId, topicId);
      }
      const collected = [];
      const excluded = new Set(seen);
      for (let attempt = 0; attempt < 2 && collected.length < (wholeLesson ? 3 : 5); attempt += 1) {
        const data = await postApi.generateLearningQuiz({
          userId: quizUserId, topicId, topicTitle: selectedTopic.title || topicId,
          parentTopic: selectedTopic.topic || selectedTopic.title || topicId,
          focus: selectedTopic.focus || selectedTopic.title || '',
          sourcePostId: selectedTopic.postId || '', sourceTitle: selectedTopic.sourceTitle || '',
          sourceBody: selectedTopic.sourceBody || '',
          ...reference,
          difficulty: challengeProfile.difficulty, minimumDifficulty: challengeProfile.minimumDifficulty,
          difficultySelection: selectedTopic.difficultyPreference ? 'manual' : 'adaptive',
          studyTrack: selectedTopic.studyTrack || 'college', examTarget: selectedTopic.examTarget || '',
          subjectAreas: selectedTopic.subjects || [],
          learnerLevel: challengeProfile.level, learnerDepth: challengeProfile.depth,
          questionStyle: selectedTopic.lessonId
            ? challengeProfile.questionStyle + '. ' + getLessonQuestionStyle(selectedTopic)
            : selectedTopic.postId
            ? challengeProfile.questionStyle + '. Test the source concept: mechanism, cause and effect, a new example, and a limitation. Do not ask for the post title or generic study advice.'
            : challengeProfile.questionStyle + '. Prepare a learner for ' + (selectedTopic.studyTrack || 'college')
              + ' study. ' + (selectedTopic.examTarget ? `Requested exam or skill: ${selectedTopic.examTarget}. ` : '')
              + 'Use specific concepts from this subject, numerical or scenario problems where appropriate, plausible distractors, and worked explanations. Hard questions must require multi-step reasoning, not obscure trivia. Do not claim official syllabus coverage or invent dated current-affairs facts.',
          requestedCount: candidateCount - collected.length, generationAttempt: attempt,
          weakAreas: getSavedReviewDeck(getWrongQuestions(quizUserId)[topicId]).slice(-5).map((item) => item.q),
          recentQuestionFingerprints: [...excluded].slice(-100),
          excludeQuestions: [...recentPrompts, ...collected.map(question => question.q)].slice(-40),
        }, { signal: controller.signal });
        if (!isCurrent()) return;
        const batch = normalizeGeneratedQuestions(data, topicId, {
          excludedFingerprints: [...excluded], fallbackDifficulty: challengeProfile.difficulty, limit: candidateCount - collected.length,
          requiredDifficulty: selectedTopic.lessonId ? challengeProfile.difficulty : selectedTopic.difficultyPreference || '',
          excludedPrompts: [...recentPrompts, ...collected.map(question => question.q)],
        }).filter((question) => !selectedTopic.postId || !/which title|what exact concept|name of (the|this) (post|lesson)/i.test(question.q));
        batch.forEach((question) => { collected.push(question); excluded.add(question.fingerprint); });
      }
      if (!collected.length) throw new Error('No unseen questions available.');
      const questions = chooseQuestions(collected);
      try { saveActiveQuiz({ userId: quizUserId, topicId, difficulty: challengeProfile.difficulty, contextKey, questions }); } catch { /* A quiz still works when storage is full. */ }
      setAiQuestions((prev) => ({ ...prev, [topicId]: questions }));
      setQuizNotice(challengeProfile.depth + ' · ' + questions.length + ' AI practice questions · check important facts against your study material');
    } catch (error) {
      if (isCurrent()) useLocalQuestions();
    } finally {
      if (timeout) window.clearTimeout(timeout);
      if (isCurrent()) setLoadingAI(false);
    }
  }, [quizUserId, topicProgressMap]);

  const startQuiz = useCallback((item, format = item?.format ?? sessionMode) => {
    // Keep historic topic-specific reviews, but start fresh practice at lesson level.
    if (item?.conceptId && !item.reviewQuestions) {
      const subject = TOPICS.find(entry => entry.id === item.baseTopicId);
      const lesson = getQuizLesson(item.baseTopicId, item.lessonId);
      if (subject && lesson) item = { ...item, ...makeLessonQuizTopic(subject, lesson) };
    }
    quizAttemptRef.current = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
    const isFocusedLesson = Boolean(item?.lessonId || item?.postId || item?.learningContext?.postId);
    const shouldStartBoss = !isFocusedLesson && bossRequested;

    setBossMode(shouldStartBoss);

    if (shouldStartBoss) {
      clearQuizFlag("smarty-boss-practice");
      setBossRequested(false);
    }

    const sessionTopic = { ...item, format: !isFocusedLesson && getSubjectGameSteps(item.id).length ? format : 'practice', studyTrack, examTarget: examTarget.trim().slice(0, 120),
      challengeMode: !item.reviewQuestions && !item.nextDifficulty && (item.challengeMode ?? challengeMode),
      difficultyPreference: item.nextDifficulty || item.difficultyPreference || difficultyPreference };
    setTopic(sessionTopic);
    setReviewMode(Boolean(item.reviewQuestions));
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
    setComboCount(1);
    setConfidence('unmarked');
    setReviewFilter('all');
    loadAIQuestions(item.id, sessionTopic);
  }, [loadAIQuestions, studyTrack, examTarget, difficultyPreference, challengeMode, bossRequested, sessionMode]);

  const startFeaturedChallenge = useCallback((id) => {
    const subject = SUBJECT_BY_ID.get(id);
    if (subject) startQuiz(subject, 'mixed');
  }, [startQuiz]);

  useEffect(() => {
    if (!focusedLearningTopic) return;
    if (focusedQuizStartedRef.current === `${quizUserId}:${focusedLearningTopic.id}`) return;

    focusedQuizStartedRef.current = `${quizUserId}:${focusedLearningTopic.id}`;
    startQuiz(focusedLearningTopic);
  }, [focusedLearningTopic, quizUserId, startQuiz]);

const renderedTopics = useMemo(
  () => {
    const query = subjectQuery.trim().toLocaleLowerCase();
    return TOPICS.filter((item) =>
      (libraryFilter === 'all' || item.group === libraryFilter || SUBJECT_GROUPS[libraryFilter]?.includes(item.id))
      && (!query || `${item.title} ${item.desc} ${getQuizChapters(item.id).map(lesson => lesson.title).join(' ')} ${(item.subjects || []).join(' ')} ${getQuizLessons(item.id).map(lesson => `${lesson.title} ${lesson.concepts.join(' ')}`).join(' ')}`.toLocaleLowerCase().includes(query))
    ).map((item) => (
    <TopicCard
      key={item.id}
      item={item}
      progress={topicProgressDetails[item.id]}
      onStart={openSubject}
    />
    ));
  },
  [topicProgressDetails, openSubject, subjectQuery, libraryFilter]
);

const saveQuizProgress = useCallback(async (finalScore, finalAnswers) => {
  const attemptId = quizAttemptRef.current;
  if (!attemptId || finishRequestRef.current === attemptId) return;
  finishRequestRef.current = attemptId;
  const isCurrent = () => quizAttemptRef.current === attemptId;
  setSaving(true);
  setSaveError("");
  setQuizNotice("");
  setAnswerFeedback(null);

  const userId = quizUserId;

  const result = getQuizResult(finalAnswers);
  const percentage = result.percent;
  finalScore = result.correct;

  if (reviewMode) {
    setQuizNotice('Review complete. Known questions do not award extra XP or change your first-attempt practice score.');
    setSaving(false);
    return;
  }

  // Count completion, never a particular score or a positive opinion.
  if (result.total >= 3) recordMeaningfulEngagement(userId, { kind: 'quiz', id: attemptId });

  const finishRewards = () => {
    checkAchievements({
      topicId: topic.id,
      percentage,
      streak: visitProgress.streak,
      overallLevel,
      userId,
    });

    clearActiveQuiz(userId, topic.id);
  };

  try {
    recordQuestionHistory(userId, topic.id, finalAnswers);
    if (topic.baseTopicId) recordQuestionHistory(userId, topic.baseTopicId, finalAnswers);
  } catch { /* Keep results visible if storage is unavailable. */ }

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
          attemptId,
          topicId: topic.id,
          topicTitle: topic.title,
          score: finalScore,
          totalQuestions: result.total,
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
            confidence: answer.confidence || 'unmarked',
          })),
      })) || {};

      if (!isCurrent()) return;

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
      if (!isCurrent()) return;
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
      setSaveError('Saved on this device. Your server progress could not be updated.');
    } finally {
      if (isCurrent()) setSaving(false);
    }
  }, [activeChallengeProfile.difficulty, learningUserId, overallLevel, quizUserId, topic, topicProgressMap, visitProgress.streak, reviewMode]);

useEffect(() => {
  if (!topic || topic.lessonId || finished || current?.type !== 'mcq' || !survivalMode || locked || bossMode || reviewMode || activeFormat === 'practice') return;

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
          confidence: 'unsure', topicTitle: topic.title, postId: topic.postId, learningContext: topic.learningContext,
          kind: current.kind, concepts: current.concepts, baseTopicId: topic.baseTopicId, lessonId: topic.lessonId, conceptId: topic.conceptId,
        };

        const nextAnswers = [...answers, timeoutAnswer];
        setAnswers(nextAnswers);
        if (current.type === "mcq") saveWrongQuestion(topic.id, timeoutAnswer, quizUserId);
        try {
          recordQuestionHistory(quizUserId, topic.id, [timeoutAnswer]);
          if (topic.baseTopicId) recordQuestionHistory(quizUserId, topic.baseTopicId, [timeoutAnswer]);
        } catch { /* Keep the timer responsive if storage is unavailable. */ }

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
}, [answers, bossMode, current, currentOptions, finished, index, locked, mixedSteps.length, quizUserId, saveQuizProgress, score, survivalMode, topic, reviewMode, activeFormat]);

const submitAnswer = useCallback(() => {
  if (locked || transitionLockRef.current || !selected || !current) return;

  transitionLockRef.current = true;
  setLocked(true);

  const isCorrect = selected === current.answer;

  const earnedXP = isCorrect && !reviewMode ? getAnswerXP(current, comboCount) : 0;

  if (isCorrect) {
    sounds.correct();
    setComboCount((prev) => prev + 1);
  } else {
    sounds.wrong();
    setComboCount(1);
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
      confidence, topicTitle: topic.title, postId: topic.postId, learningContext: topic.learningContext,
      kind: current.kind, concepts: current.concepts, baseTopicId: topic.baseTopicId, lessonId: topic.lessonId, conceptId: topic.conceptId,
    };

  if (needsQuizReview(answerRecord)) {
    saveWrongQuestion(topic.id, answerRecord, quizUserId);
  } else if (isCorrect) {
    removeWrongQuestion(topic.id, answerRecord, quizUserId);
  }

  try {
    recordQuestionHistory(quizUserId, topic.id, [answerRecord]);
    if (topic.baseTopicId) recordQuestionHistory(quizUserId, topic.baseTopicId, [answerRecord]);
  } catch { /* An answer still counts if storage is unavailable. */ }

  const nextAnswers = [...answers, answerRecord];

  setAnswers(nextAnswers);
  setScore(nextScore);
  setAnswerFeedback({
    isCorrect,
    selected,
    correctAnswer: current.answer,
    explanation: current.explanation,
    confidence,
    nextScore,
    nextAnswers,
  });
}, [answers, comboCount, current, currentOptions, locked, quizUserId, score, selected, sounds, topic, confidence, reviewMode]);

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
    if (event.repeat || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey ||
        (event.target instanceof HTMLElement && event.target.closest("button, input, textarea, select, a, summary, [contenteditable='true']"))) return;

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
  quizAttemptRef.current = '';
  questionRequestRef.current.id += 1;
  questionRequestRef.current.controller?.abort();
  setLoadingAI(false);
  setBossMode(false);
  setBossRequested(false);
  clearQuizFlag("smarty-boss-practice");
  clearQuizFlag("smarty-game-mode");

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
  setComboCount(1);
}, []);

useEffect(() => {
  if (quizLocationRef.current === location.key) return;
  quizLocationRef.current = location.key;
  if (topic && !focusedLearningTopic) restart();
}, [location.key, topic, focusedLearningTopic, restart]);

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
  () => answers.filter(needsQuizReview),
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
    return {
      eyebrow: "Recommended next",
      title: `Revisit ${missedQuestions.length} ${missedQuestions.length === 1 ? "question" : "questions"}`,
      description: "Read the explanations for the answers you missed or marked unsure, then try those questions again.",
    };
  }

  return {
    eyebrow: "Recommended next",
    title: 'Build on what you know.',
    description: activeChallengeProfile.depth === "Expert"
      ? "Explore a connected idea, then try explaining how the two fit together."
      : "Try a connected lesson or a harder question set to see what you remember.",
  };
}, [activeChallengeProfile.depth, missedQuestions.length]);

const startReview = useCallback((reviewTopic, records) => {
  if (!reviewTopic || records.length === 0) return;
  questionRequestRef.current.id += 1;
  questionRequestRef.current.controller?.abort();
  setLoadingAI(false);
  quizAttemptRef.current = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;

  const retryQuestions = records.map((answer, questionIndex) => ({
    id: `review-${answer.id || questionIndex}-${Date.now()}`,
    q: answer.q,
    options: shuffleItems(answer.options),
    answer: answer.correctAnswer || answer.answer,
    explanation: answer.explanation,
    kind: answer.kind,
    concepts: answer.concepts,
    difficulty: answer.difficulty || "Adaptive",
    source: "review",
    fingerprint: answer.fingerprint || getQuestionFingerprint({
      q: answer.q,
      answer: answer.correctAnswer || answer.answer,
    }),
  }));

  setTopic(reviewTopic);
  setAiQuestions((previous) => ({ ...previous, [reviewTopic.id]: retryQuestions }));
  setReviewMode(true);
  setBossMode(false);
  setIndex(0);
  setSelected("");
  setScore(0);
  setAnswers([]);
  setFinished(false);
  setProgress(null);
  setSaveError("");
  setQuizNotice(`Review practice · ${retryQuestions.length} ${retryQuestions.length === 1 ? "question" : "questions"} · no extra XP`);
  setAnswerFeedback(null);
  setLocked(false);
  setComboCount(1);
  setConfidence('unmarked');
  setReviewFilter('all');
  transitionLockRef.current = false;
}, []);

const startMistakeReview = useCallback(() => startReview(topic, missedQuestions), [startReview, topic, missedQuestions]);
const relatedLessonOptions = useMemo(() => topic?.lessonId ? getRelatedQuizLessons(topic.baseTopicId, topic.lessonId) : [], [topic?.baseTopicId, topic?.lessonId]);
const lessonSkills = useMemo(() => summarizeLessonSkills(answers), [answers]);
const lessonCoverage = useMemo(() => summarizeLessonCoverage(topic, answers), [topic, answers]);

  const result = getQuizResult(answers);
  const finalScore = result.correct;

  const percentage = result.percent;


  const xpPreview = answers.reduce((total, answer) => total + (answer.xp || 0), 0);

const handleBossComplete = useCallback((result) => {
  if (transitionLockRef.current) return;
  transitionLockRef.current = true;

  if (result.success) {
    sounds.correct();
    setComboCount((prev) => prev + 1);
  } else {
    sounds.wrong();
    setComboCount(1);
  }

  const bossScore = result.success ? score + 1 : score;

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
  clearQuizFlag("smarty-boss-practice");
  setIndex(0);
  setFinished(true);
  saveQuizProgress(bossScore, nextAnswers);
}, [answers, saveQuizProgress, score, sounds, topic]);

const handleGameComplete = useCallback((result) => {
  if (transitionLockRef.current) return;
  transitionLockRef.current = true;

  if (result.success) {
    sounds.correct();
    setComboCount((prev) => prev + 1);
  } else {
    sounds.wrong();
    setComboCount(1);
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
}, [answers, current, index, mixedSteps.length, saveQuizProgress, score, sounds, topic]);

const progressAction = <button type="button" className="arcade-console-control" onClick={openProgress}>
  <ChartNoAxesColumnIncreasing size={16} aria-hidden="true" /> Progress
</button>;

if (topic && bossMode && !finished) {
  return (
    <ArcadeStage boss subject={topic.title} onExit={restart} soundEnabled={soundEnabled} onToggleSound={() => setSoundEnabled(enabled => !enabled)}>
      <Suspense fallback={<QuizLoadingCard label="Loading boss level..." />}>
        <BossChallenge topicId={topic.id} onComplete={handleBossComplete} />
      </Suspense>
    </ArcadeStage>
  );
}

  if (topic && !currentTopicHasAIQuestions && !finished) {
    return (
      <ArcadeShell backLabel={topic.lessonId ? 'Lessons' : 'Subjects'} onBack={restart} actions={progressAction}>
        <section className="arcade-screen arcade-waiting">
          <div className="ai-loading-card" role="status">
            {loadingAI && <div className="quiz-loading-lines" aria-hidden="true"><span /><span /><span /></div>}
            <h2>{loadingAI ? "Preparing your quiz..." : "Questions unavailable"}</h2>
            <p>
              {loadingAI
                ? topic.lessonId ? `Preparing questions for “${topic.lessonTitle}”.` : 'Preparing fresh questions for this quiz.'
                : (quizNotice || "Smarty could not prepare this challenge. Please try again.")}
            </p>
            {!loadingAI && (
              <button type="button" className="submit-answer-btn" onClick={() => loadAIQuestions(topic.id, topic)}>
                Try Again
              </button>
            )}
            {!loadingAI && (getLearningGuide(topic?.postId) || QUESTIONS[topic.id]?.length > 0 || getLessonTopicQuestions(topic).length > 0) && <button type="button" className="submit-answer-btn" onClick={() => startQuiz({ ...topic, reviewQuestions: true })}>Review available questions</button>}
            {!loadingAI && topic?.postId && <button type="button" className="arcade-console-control" onClick={returnToFocusedLesson}>Return to the lesson</button>}
          </div>
        </section>
      </ArcadeShell>
    );
  }
  if (!topic) {

    return (

<ArcadeShell wide backLabel={selectedLibrarySubject ? 'All subjects' : 'Feed'}
  onBack={() => navigate(selectedLibrarySubject ? '/quiz' : '/feed?topic=All')} actions={progressAction}>
  {!selectedLibrarySubject && <ArcadeLobby onChoose={startFeaturedChallenge} />}
  <div className="quiz-library-layout">
    <details className="quiz-study-sidebar arcade-settings">
      <summary><SlidersHorizontal size={16} aria-hidden="true" /><span>Play settings</span>
        <small>{practiceLevel} <span aria-hidden="true">/</span> {sessionMode === 'mixed' ? 'Games' : 'Questions'}</small><ChevronDown size={15} aria-hidden="true" />
      </summary>
      <div className="arcade-settings-body">
        <QuizPracticeControls level={practiceLevel} onLevel={setPracticeLevel} mode={sessionMode} onMode={setSessionMode} sound={soundEnabled} onSound={setSoundEnabled} />
        <p className="quiz-prep-note">Lessons are questions only. Subject challenges mix questions and games where available.</p>
      </div>
    </details>
    <div className="quiz-library-main">
      {selectedLibrarySubject ? <QuizLessonLibrary key={selectedLibrarySubject.id} subject={selectedLibrarySubject} progress={topicProgressMap}
        initialView={lessonLibraryView?.subjectId === selectedLibrarySubject.id ? lessonLibraryView : undefined}
        onStart={(item, view) => { setLessonLibraryView({ ...view, subjectId: selectedLibrarySubject.id }); startQuiz(item); }}
        onMixedStart={bossRequested || sessionMode === 'mixed' ? () => startQuiz(selectedLibrarySubject) : undefined}
        subjectIncludesGames={getSubjectGameSteps(selectedLibrarySubject.id).length > 0} bossChallenge={bossRequested} /> : <>
        <div className="quiz-subject-toolbar">
          <div><h2>Choose a subject</h2><span className="quiz-library-count" role="status">{renderedTopics.length} of {TOPICS.length} subjects</span></div>
          <label><Search size={17} aria-hidden="true" /><span className="sr-only">Search quiz subjects</span><input type="search" value={subjectQuery} onChange={(event) => setSubjectQuery(event.target.value)} placeholder="Find your subject" /></label>
        </div>
        <div className="quiz-library-filters" role="group" aria-label="Filter subjects">{SUBJECT_FILTERS.map(([id, label]) => <button type="button" key={id} aria-pressed={libraryFilter === id} onClick={() => setLibraryFilter(id)}>{label}</button>)}</div>
        <section className="topic-grid" aria-label="Quiz subjects">
{renderedTopics}
          {renderedTopics.length === 0 && <div className="quiz-empty"><p>No matching subjects.</p><button type="button" onClick={() => { setSubjectQuery(''); setLibraryFilter('all'); }}>Clear search</button></div>}
        </section>
      </>}
    </div>
  </div>
</ArcadeShell>

    );

  }

  if (finished) {
    const canAdvanceDifficulty = !reviewMode && result.total >= 3 && percentage >= 80 && activeChallengeProfile.difficulty !== 'Hard';
    const increaseDifficulty = () => startQuiz({ ...topic, reviewQuestions: false,
      nextDifficulty: activeChallengeProfile.difficulty === 'Easy' ? 'Medium' : 'Hard' });
    const exploreNext = topic.lessonId ? restart : () => navigate(`/learn?topic=${encodeURIComponent(focusedLearningTopic?.topic || topic.topic || topic.title)}`);
    const exploreLabel = topic.lessonId ? 'Explore more lessons' : 'Explore this subject';
    return (
      <ArcadeShell backLabel={topic.lessonId ? 'Lessons' : 'Subjects'} onBack={restart} actions={progressAction}>
        <section className="arcade-screen arcade-results" aria-labelledby="arcade-results-title">
          <header className="arcade-scoreboard">
            <div>
              <p>{topic.title}</p>
              <h1 id="arcade-results-title" ref={resultHeadingRef} tabIndex={-1}>{reviewMode ? 'Review results' : 'Quiz results'}</h1>
              <p>{getGradeMessage(percentage)}</p>
            </div>
            <div className="arcade-score"><strong>{percentage}%</strong><span>{finalScore} of {result.total} correct</span></div>
          </header>
          <ArcadeRecap answers={answers} onReview={() => {
            setReviewFilter('all');
            reviewHeadingRef.current?.focus({ preventScroll: true });
            reviewHeadingRef.current?.scrollIntoView({ block: 'start', behavior: 'instant' });
          }} />
          {topic.challengeMode && topic.studyNote && <details className="quiz-study-notes"><summary>Review lesson notes</summary><p>{topic.studyNote}</p><ul>{topic.subjects.map(idea => <li key={idea}>{idea}</li>)}</ul></details>}
          {reviewMode && <p>Review only · no additional XP or first-attempt score changes.</p>}
          {!reviewMode && topic?.postId && <p>{percentage >= 80 && result.total >= 3 ? 'Concept check passed. Revisit it tomorrow, then build on a connected idea.' : 'Review the explanations below. A full check needs at least three questions and 80% correct.'}</p>}

          {saving && <p role="status">Saving your progress…</p>}
          {saveError && <p className="save-error">{saveError}</p>}
          <dl className="arcade-result-stats">
            <div><dt>XP earned</dt><dd>+{progress?.xpEarned ?? xpPreview}</dd></div>
            <div><dt>Worth reviewing</dt><dd>{missedQuestions.length}</dd></div>
            <div><dt>Personal best</dt><dd>{topicProgressMap[topic.id]?.bestPercent || 0}%</dd></div>
          </dl>

          <section className="quiz-next-move" aria-labelledby="quiz-next-move-title">
            <span>{nextLearningMove.eyebrow}</span>
            <h2 id="quiz-next-move-title">{nextLearningMove.title}</h2>
            <p>{nextLearningMove.description}</p>
            <div className="quiz-next-actions">
              <button type="button" className="quiz-next-primary" onClick={missedQuestions.length > 0
                ? startMistakeReview : canAdvanceDifficulty ? increaseDifficulty : exploreNext}>
                {missedQuestions.length > 0 ? 'Practice missed & unsure' : canAdvanceDifficulty ? 'Try the next level' : exploreLabel} <ArrowRight size={15} aria-hidden="true" />
              </button>
              {canAdvanceDifficulty && (missedQuestions.length > 0
                ? <button type="button" className="quiz-next-secondary" onClick={increaseDifficulty}>Try the next level</button>
                : <button type="button" className="quiz-next-secondary" onClick={exploreNext}>{exploreLabel}</button>)}
              {focusedLearningTopic?.postId && <button type="button" className="quiz-next-secondary" onClick={returnToFocusedLesson}>Revisit the explanation</button>}
            </div>
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

          {lessonCoverage.length > 0 && <section className="quiz-next-lessons quiz-lesson-coverage" aria-labelledby="quiz-lesson-coverage-title">
            <h2 id="quiz-lesson-coverage-title">What you practised</h2>
            <p>Use these results to decide what to revisit.</p>
            <ul>{lessonCoverage.map(area => <li key={area.id}><strong>{area.label}</strong><span>{area.correct} of {area.total} correct{area.needsReview ? ' · Revisit' : ''}</span></li>)}</ul>
          </section>}

          {topic.lessonId && relatedLessonOptions.length > 0 && <section className="quiz-next-lessons" aria-labelledby="quiz-related-lessons-title">
            <h2 id="quiz-related-lessons-title">Connect this to another idea</h2>
            <p>Keep building in {topic.branch}, or explore how another lesson connects.</p>
            <div className="quiz-next-lesson-options">{relatedLessonOptions.map(lesson => <button type="button" key={lesson.id} onClick={() => {
              const parent = TOPICS.find(item => item.id === topic.baseTopicId);
              if (parent) startQuiz(makeLessonQuizTopic(parent, lesson));
            }}><span><strong>{lesson.title}</strong><small>{lesson.outcome}</small></span><ArrowUpRight size={18} aria-hidden="true" /></button>)}</div>
          </section>}
          {lessonSkills.length > 0 && <div className="quiz-skill-summary" aria-label="Reasoning practised in this set">{lessonSkills.map(skill => <span key={skill.kind}>{skill.kind}: {skill.correct}/{skill.total}{skill.unsure ? ` · ${skill.unsure} unsure` : ''}</span>)}</div>}

          <div className="review-panel">

            <h3 ref={reviewHeadingRef} tabIndex={-1}>Your answers & explanations</h3>
            <div className="quiz-mode-picker" aria-label="Filter answer review">
              {[['all', 'All'], ['missed', 'Missed'], ['unsure', 'Unsure']].map(([value, label]) => <button type="button" key={value} aria-pressed={reviewFilter === value} onClick={() => setReviewFilter(value)}>{label}</button>)}
            </div>

            {renderedReviewItems}
            {!renderedReviewItems.length && <p>No answers in this view.</p>}

          </div>

          <div className="result-actions">

            <button type="button" onClick={() => startQuiz({ ...topic, reviewQuestions: false, nextDifficulty: '' })}>{topic.conceptId ? 'Start whole lesson quiz' : 'New question set'}</button>

            <button type="button" onClick={restart} className="secondary-btn">
              {topic.lessonId ? 'Choose another lesson' : 'Choose another topic'}
            </button>

            {focusedLearningTopic?.topic && (
              <button type="button" onClick={exploreFocusedTopic} className="secondary-btn">
                Find Similar Ideas
              </button>
            )}

          </div>

        </section>
      </ArcadeShell>

    );

  }

  if (topic && current?.type === "game" && !finished) {
    return (
      <ArcadeStage subject={topic.title} round={index + 1} total={mixedSteps.length} onExit={restart}
        survivalTime={survivalMode && activeFormat === 'mixed' && !reviewMode ? survivalTimeLeft : null}
        soundEnabled={soundEnabled} onToggleSound={() => setSoundEnabled(enabled => !enabled)}>
        <Suspense fallback={<QuizLoadingCard />}>
          <BrainGameEngine game={current} topicId={topic.id} onComplete={handleGameComplete} />
        </Suspense>
      </ArcadeStage>
    );
  }
  

  return (
    <ArcadeShell backLabel={topic.lessonId ? 'Lessons' : 'Subjects'} onBack={restart} actions={progressAction}>
      <section className="arcade-screen arcade-question">
        <div className="arcade-round-header">
          <div><span>{topic.lessonId ? topic.topic : reviewMode ? 'Review practice' : 'Question round'}</span><h1>{topic.title}</h1></div>
          <div className="arcade-round-count"><strong>{index + 1}</strong><span> / {mixedSteps.length}</span></div>
        </div>
        <ArcadeProgress step={index + 1} total={mixedSteps.length} label="Quiz progress" unit={activeFormat === 'mixed' && !topic.lessonId && !reviewMode ? 'Step' : 'Question'} />
        <div className="quiz-session-stats" aria-label="Current quiz status">
          <span>{reviewMode ? 'Review practice' : activeChallengeProfile.depth} · {current?.difficulty || activeChallengeProfile.difficulty}</span>
          <span>Score <strong>{score}</strong></span>
          <span className={comboCount > 1 ? "is-active" : ""}>Combo <strong>{comboCount}×</strong></span>
        </div>
        {survivalMode && activeFormat === 'mixed' && !reviewMode && !topic.lessonId && (
  <div className="arcade-survival-time">
    <span>Survival</span>
    <strong>{survivalTimeLeft}s</strong>
  </div>
)}


        <div key={current?.id || `${topic?.id}-${index}`} className="quiz-question-stage">
          {current?.kind && <span className="quiz-question-kind">{current.kind}</span>}
          <h2 ref={questionHeadingRef} tabIndex={-1}>{current?.q || "Challenge question"}</h2>

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
      <span className="quiz-choice-key" aria-hidden="true">{String.fromCharCode(65 + optionIndex)}</span>
      <span className="quiz-choice-text">{option}</span>
      <span className="quiz-choice-indicator" aria-hidden="true">
        {answerFeedback?.correctAnswer === option || (!answerFeedback && selected === option) ? <Check size={15} /> : answerFeedback && selected === option ? <X size={15} /> : null}
      </span>
      {answerFeedback?.correctAnswer === option && <span className="sr-only">Correct answer</span>}
      {answerFeedback && selected === option && !answerFeedback.isCorrect && <span className="sr-only">Incorrect answer</span>}
    </button>
  ))}
</div>

{answerFeedback && (
  <div
    className={`answer-feedback ${answerFeedback.isCorrect ? "correct" : "wrong"}`}
  >
    <div className="answer-feedback-heading">
      <span aria-hidden="true">{answerFeedback.isCorrect ? <Check size={18} /> : <X size={18} />}</span>
      <h3 ref={answerFeedbackRef} tabIndex={-1}>{answerFeedback.isCorrect ? 'Correct' : 'Not quite yet'}</h3>
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
    {answerFeedback.confidence === 'unsure' && <p className="quiz-review-tag">{answerFeedback.isCorrect ? 'Saved for review, even though your answer was correct.' : 'Saved for another practice, with the explanation.'}</p>}
  </div>
)}

{currentOptions.length === 0 && (
  <p className="save-error">
    This question could not load properly. Please go back and try again.
  </p>
)}

        <div className="arcade-answer-actions">
        <button
          type="button"
          className="submit-answer-btn"
          onClick={answerFeedback ? advanceAfterAnswer : submitAnswer}
          disabled={!answerFeedback && (!selected || locked || (current?.options || []).length === 0)}
        >
          {answerFeedback
            ? (index + 1 === mixedSteps.length ? "View Results" : mixedSteps[index + 1]?.type === 'game' ? 'Play mini-game' : 'Next Question')
            : "Check Answer"}
          {answerFeedback && <ArrowRight size={16} aria-hidden="true" />}
        </button>
        {!answerFeedback && <div className="quiz-confidence">
          <button type="button" title="Save this question for review" aria-pressed={confidence === 'unsure'} onClick={() => setConfidence((value) => value === 'unsure' ? 'unmarked' : 'unsure')}>Mark as unsure</button>
        </div>}
        </div>
        {(quizNotice || topic.lessonId || focusedLearningTopic) && <details className="quiz-study-notes arcade-round-notes">
          <summary>{topic.lessonId && !topic.conceptId && !topic.challengeMode ? 'Study notes' : 'About this round'}</summary>
          {quizNotice && <p className="quiz-source-notice">{quizNotice}</p>}
          {focusedLearningTopic && <p>Focused practice: {focusedLearningTopic.topic}</p>}
          {topic.lessonId && <p>{topic.conceptId ? topic.lessonTitle : topic.desc}</p>}
          {topic.lessonId && !topic.conceptId && !topic.challengeMode && <>
            {topic.studyNote && <p>{topic.studyNote}</p>}
            <ul>{topic.subjects.map(idea => <li key={idea}>{idea}</li>)}</ul>
          </>}
        </details>}
        </div>

      </section>
    </ArcadeShell>

  );

}
