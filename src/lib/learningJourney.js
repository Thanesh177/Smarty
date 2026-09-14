const TOPIC_FAMILIES = [
  ['Artificial Intelligence', 'Machine Learning', 'Data Science', 'Robotics', 'Technology'],
  ['Cybersecurity', 'Cryptography', 'Computer Networks', 'Software Systems', 'Cloud Computing'],
  ['Databases', 'Operating Systems', 'Coding', 'Software Systems', 'Computer Networks'],
  ['Physics', 'Astronomy', 'Space', 'Engineering', 'Energy'],
  ['Biology', 'Genetics', 'Neuroscience', 'Human Body', 'Immunology'],
  ['Chemistry', 'Materials Science', 'Manufacturing', 'Energy', 'Environment'],
  ['Psychology', 'Human Behavior', 'Decision Making', 'Memory', 'Learning'],
  ['Health', 'Mental Health', 'Nutrition', 'Sleep', 'Fitness'],
  ['Finance', 'Investing', 'Stock Market', 'Trading', 'Economics'],
  ['Business', 'Startups', 'Entrepreneurship', 'Marketing', 'Consumer Behavior'],
  ['History', 'Ancient Civilizations', 'Medieval History', 'Modern History', 'Revolutions'],
  ['World History', 'Geopolitical History', 'Diplomatic History', 'Military History', 'Borders and Empires'],
  ['Climate Change', 'Environment', 'Sustainability', 'Nature', 'Earth Science'],
  ['Society', 'Culture', 'Law', 'Politics', 'Communication'],
  ['Productivity', 'Focus', 'Self Improvement', 'Discipline', 'Motivation'],
];

export function normalizeLearningTopic(value) {
  return String(value || '')
    .normalize('NFKD')
    .toLowerCase()
    .trim()
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function readTopicValues(value) {
  if (Array.isArray(value)) return value.flatMap(readTopicValues);
  if (value && typeof value === 'object') {
    return readTopicValues(value.name || value.label || value.title || value.topic || '');
  }
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function getLearningContext(post = {}, fallbackId = '') {
  post = post || {};
  const postId = String(
    post.id || post.reelId || post.postId || post.pk || fallbackId || '',
  ).trim();
  const topic = String(
    readTopicValues(post.topic || post.category || post.subject)[0] || 'General Knowledge',
  ).trim();
  const focus = String(
    post.subTopic ||
      post.subtopic ||
      post.focus ||
      post.concept ||
      post.title ||
      topic,
  ).trim();

  const sections = Array.isArray(post.sections) ? post.sections : [];
  const findSection = (...names) => {
    const allowed = new Set(names.map(normalizeLearningTopic));
    const section = sections.find((item) => (
      Array.isArray(item) && allowed.has(normalizeLearningTopic(item[0]))
    ));
    return String(section?.[1] || '').trim();
  };

  return {
    postId,
    topic,
    focus,
    title: String(post.title || focus || topic).trim(),
    body: String(post.body || post.description || post.content || '').trim(),
    contentAngle: String(post.contentAngleLabel || post.contentAngle || '').trim(),
    objective: String(post.objective || post.learningObjective || '').trim(),
    mechanism: findSection('How it works', 'Mechanism', 'Process'),
    takeaway: findSection('Final takeaway', 'Remember this', 'Key takeaway'),
    slug: String(post.slug || '').trim(),
    nextGuides: readTopicValues(post.nextGuides).map(normalizeLearningTopic),
  };
}

export function getRelatedLearningTopics(post = {}, limit = 3) {
  const context = getLearningContext(post);
  const topicKey = normalizeLearningTopic(context.topic);
  const supplied = [
    ...readTopicValues(post.relatedTopics),
    ...readTopicValues(post.relatedTopic),
    ...readTopicValues(post.tags),
    ...readTopicValues(post.categories),
  ];
  const matchedFamily = TOPIC_FAMILIES.find((family) =>
    family.some((item) => normalizeLearningTopic(item) === topicKey),
  );
  const candidates = [...supplied, ...(matchedFamily || [])];
  const seen = new Set([topicKey]);

  return candidates.filter((item) => {
    const key = normalizeLearningTopic(item);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, limit);
}

export function getLearningProgressKey(postId, userId = '') {
  const learner = encodeURIComponent(String(userId || 'anonymous').trim() || 'anonymous');
  const lesson = encodeURIComponent(String(postId || 'unknown').trim() || 'unknown');
  return `smarty-learning-path:${learner}:${lesson}`;
}

export function readLearningProgress(postId, userId = '') {
  try {
    const saved = JSON.parse(localStorage.getItem(getLearningProgressKey(postId, userId)) || '{}');
    const entry = saved?.version === 2 ? saved : {};
    const count = (value, max = 100000) => Number.isFinite(value) ? Math.max(0, Math.min(max, Math.floor(value))) : 0;
    const date = (value) => typeof value === 'string' && Number.isFinite(Date.parse(value)) ? value : '';
    return {
      ...emptyProgress(),
      understand: entry.understand === true,
      challenge: entry.challenge === true,
      note: typeof entry.note === 'string' ? entry.note.slice(0, 2000) : '',
      confidence: ['unsure', 'getting-there', 'confident'].includes(entry.confidence) ? entry.confidence : '',
      attempts: count(entry.attempts), bestScore: count(entry.bestScore, 100),
      lastScore: Number.isFinite(entry.lastScore) ? count(entry.lastScore, 100) : null,
      reviewCount: count(entry.reviewCount, 4),
      nextReviewAt: date(entry.nextReviewAt), updatedAt: date(entry.updatedAt), lastQuizAt: date(entry.lastQuizAt),
      lastAttemptId: typeof entry.lastAttemptId === 'string' ? entry.lastAttemptId : '',
      context: entry.context?.postId && typeof entry.context.title === 'string' && typeof entry.context.topic === 'string'
        ? { ...getLearningContext(entry.context, postId), postId: String(postId) } : null,
      // Old versions marked every step complete on navigation. Those flags
      // cannot be used as evidence of understanding or quiz performance.
      read: Boolean(saved?.read),
    };
  } catch {
    return emptyProgress();
  }
}

export function markLearningProgress(postId, userId, stage, context = {}) {
  if (!postId || !['read', 'understand', 'challenge'].includes(stage)) {
    return readLearningProgress(postId, userId);
  }

  const current = readLearningProgress(postId, userId);
  if (stage === 'challenge') return current; // Only a scored quiz can complete this step.
  return writeProgress(postId, userId, { ...current, [stage]: true }, context);
}

export const LEARNING_UPDATED = 'smarty:learning-updated';
const DAY = 86400000;
const libraryKey = (userId) => `smarty-learning-library:${encodeURIComponent(userId || 'anonymous')}`;
const emptyProgress = () => ({ version: 2, read: false, understand: false, challenge: false,
  note: '', confidence: '', attempts: 0, bestScore: 0, lastScore: null, reviewCount: 0,
  nextReviewAt: '', updatedAt: '', context: null, persisted: true });

export function getLearningLibrary(userId = '') {
  try {
    const ids = JSON.parse(localStorage.getItem(libraryKey(userId)) || '[]');
    if (!Array.isArray(ids)) return [];
    return ids.filter((id) => typeof id === 'string').slice(0, 150).map((id) => ({ ...readLearningProgress(id, userId), postId: id }))
      .filter((item) => item.context?.postId)
      .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  } catch { return []; }
}

function writeProgress(postId, userId, progress, context = {}) {
  if (!postId) return progress;
  const next = { ...progress, version: 2, updatedAt: new Date().toISOString(), persisted: true };
  // Store a small reading history, never a full feed or another user's data.
  if (context.title || context.focus) {
    next.context = { postId: String(postId), title: String(context.title || context.focus).slice(0, 240),
      focus: String(context.focus || context.title).slice(0, 240), topic: String(context.topic || 'General Knowledge').slice(0, 120) };
  }
  try {
    localStorage.setItem(getLearningProgressKey(postId, userId), JSON.stringify(next));
    const previous = JSON.parse(localStorage.getItem(libraryKey(userId)) || '[]');
    const ids = [String(postId), ...(Array.isArray(previous) ? previous : []).filter((id) => typeof id === 'string' && id !== String(postId))];
    localStorage.setItem(libraryKey(userId), JSON.stringify(ids.slice(0, 150)));
    ids.slice(150).forEach((id) => localStorage.removeItem(getLearningProgressKey(id, userId)));
  } catch { next.persisted = false; }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(LEARNING_UPDATED, { detail: { userId, postId, progress: next } }));
  }
  return next;
}

export function saveLearningReflection(postId, userId, { note, confidence }, context) {
  const current = readLearningProgress(postId, userId);
  return writeProgress(postId, userId, { ...current, note: String(note || '').slice(0, 2000),
    confidence: ['unsure', 'getting-there', 'confident'].includes(confidence) ? confidence : '' }, context);
}

export function rememberLearningLesson(context, userId) {
  return writeProgress(context.postId, userId, readLearningProgress(context.postId, userId), context);
}

export function recordLearningQuiz(postId, userId, { correct, total, attemptId, now = Date.now() }, context) {
  const current = readLearningProgress(postId, userId);
  if (!postId || !attemptId || current.lastAttemptId === attemptId || !Number.isInteger(total) || total < 1 ||
      !Number.isInteger(correct) || correct < 0 || correct > total) return current;
  const score = Math.round(correct / total * 100);
  const passed = total >= 3 && score >= 80;
  // A same-day retry can improve a score, but cannot lengthen the review interval.
  const reviewDue = current.nextReviewAt && Date.parse(current.nextReviewAt) <= now;
  const reviewCount = passed ? (reviewDue ? current.reviewCount + 1 : current.reviewCount) : 0;
  const days = passed ? [1, 3, 7, 14, 30][Math.min(reviewCount, 4)] : 1;
  const scheduled = new Date(now + days * DAY).toISOString();
  return writeProgress(postId, userId, { ...current, attempts: current.attempts + 1,
    lastAttemptId: attemptId, lastScore: score, bestScore: Math.max(current.bestScore, score),
    lastQuizAt: new Date(now).toISOString(), challenge: passed, reviewCount,
    nextReviewAt: passed && current.challenge && !reviewDue && current.nextReviewAt ? current.nextReviewAt : scheduled,
  }, context);
}

export function getLearningNextStep(progress) {
  if (!progress?.read) return { label: 'Read the idea', stage: 'read' };
  if (!progress?.understand) return { label: 'Finish the guided explanation', stage: 'understand' };
  if (!progress?.challenge) return { label: 'Check your understanding', stage: 'challenge' };
  return { label: 'Explore the next idea', stage: 'next' };
}

export function getLearningQuizLocation(context) {
  const params = new URLSearchParams({ topic: context.topic, focus: context.focus, postId: context.postId });
  return { pathname: '/quiz', search: `?${params}` };
}

const CONNECTION_STOP_WORDS = new Set([
  'about', 'after', 'again', 'also', 'because', 'before', 'between', 'could',
  'does', 'each', 'from', 'have', 'into', 'more', 'most', 'other', 'over',
  'same', 'some', 'such', 'than', 'that', 'their', 'them', 'then', 'there',
  'these', 'they', 'this', 'through', 'under', 'using', 'very', 'what', 'when',
  'where', 'which', 'while', 'with', 'without', 'would', 'your', 'topic',
  'lesson', 'idea', 'ideas', 'system', 'works', 'work', 'shows', 'learn',
]);

function getConnectionTerms(value) {
  const normalized = normalizeLearningTopic(String(value || '').slice(0, 1800));
  return normalized.split('-').filter(
    (word) => word.length > 3 && !CONNECTION_STOP_WORDS.has(word),
  );
}

function uniqueConnectionTerms(context) {
  return [...new Set(getConnectionTerms(
    `${context.focus} ${context.title} ${context.body} ${context.contentAngle}`,
  ))];
}

function previewSentence(value, fallback) {
  const clean = String(value || '').replace(/\s+/g, ' ').trim();
  const sentences = clean.match(/[^.!?]+[.!?]+/g) || [];
  const preview = (sentences[0] || clean || fallback).slice(0, 220).trim();
  return /[.!?]$/.test(preview) ? preview : `${preview}.`;
}

function joinConnectionTerms(words) {
  if (words.length < 2) return words[0] || '';
  if (words.length === 2) return `${words[0]} and ${words[1]}`;
  return `${words.slice(0, -1).join(', ')}, and ${words.at(-1)}`;
}

function lowerFirst(value) {
  const text = String(value || '').trim();
  return text ? text.charAt(0).toLowerCase() + text.slice(1) : '';
}

function lessonKey(value) {
  return normalizeLearningTopic(String(value || '').replace(/^smarty-guide-/, ''));
}

function getLessonFoundation(context) {
  return previewSentence(
    context.takeaway || context.mechanism || context.body,
    `You now have a working model of ${context.focus}`,
  );
}

function getLessonOutcome(candidate) {
  return previewSentence(
    candidate.objective || candidate.mechanism || candidate.body,
    `Build a clear explanation of ${candidate.focus}`,
  );
}

export function selectNextLessons(posts, context, library = [], limit = 3) {
  const completed = new Set(library.filter((item) => item.challenge).map((item) => item.postId));
  const related = new Set(getRelatedLearningTopics({ topic: context.topic }, 8).map(normalizeLearningTopic));
  const currentTerms = new Set(uniqueConnectionTerms(context));
  const currentFocusTerms = new Set(getConnectionTerms(
    `${context.focus} ${context.title} ${context.contentAngle} ${context.objective}`,
  ));
  const currentConcepts = new Set([
    normalizeLearningTopic(context.focus),
    normalizeLearningTopic(context.title),
  ]);
  const authoredNext = new Set((context.nextGuides || []).map(lessonKey));
  const foundation = getLessonFoundation(context);
  const seen = new Set([context.postId]);
  return posts.flatMap((post) => {
    const candidate = getLearningContext(post);
    if (!candidate.postId || seen.has(candidate.postId) || completed.has(candidate.postId)) return [];
    seen.add(candidate.postId);
    if (
      currentConcepts.has(normalizeLearningTopic(candidate.focus)) ||
      currentConcepts.has(normalizeLearningTopic(candidate.title))
    ) return [];
    const sameTopic = normalizeLearningTopic(candidate.topic) === normalizeLearningTopic(context.topic);
    if (!sameTopic && !related.has(normalizeLearningTopic(candidate.topic))) return [];
    const candidateTerms = uniqueConnectionTerms(candidate);
    const sharedFocusTerms = [...new Set(getConnectionTerms(
      `${candidate.focus} ${candidate.title} ${candidate.contentAngle} ${candidate.objective}`,
    ).filter((word) => currentFocusTerms.has(word)))];
    const sharedTerms = [...new Set([
      ...sharedFocusTerms,
      ...candidateTerms.filter((word) => currentTerms.has(word)),
    ])].slice(0, 3);
    const overlap = sharedTerms.length;
    const termLabel = joinConnectionTerms(sharedTerms);
    const candidateKey = lessonKey(candidate.slug || candidate.postId);
    const explicitNext = authoredNext.has(candidateKey);
    const preview = getLessonOutcome(candidate);
    const pathType = explicitNext ? 'sequence' : sameTopic && overlap ? 'deepen' : sameTopic ? 'compare' : 'transfer';
    const reason = pathType === 'sequence'
      ? 'Recommended next step'
      : pathType === 'deepen'
        ? `Deepen ${termLabel}`
        : pathType === 'compare'
          ? `Compare within ${context.topic}`
          : `Transfer into ${candidate.topic}`;
    const connection = pathType === 'sequence'
      ? `${context.focus} gives you the foundation for ${candidate.focus}. The next lesson turns that foundation into a new ability: ${lowerFirst(preview)}`
      : pathType === 'deepen'
        ? `The hinge between these lessons is ${termLabel}. You used it to reason about ${context.focus}; next you will see exactly what it changes inside ${candidate.focus}.`
        : pathType === 'compare'
          ? `These ideas answer different questions inside ${context.topic}. Put them side by side to separate the general rule from details that apply only to ${context.focus}.`
          : `This is a transfer step. Carry the reasoning from ${context.focus} into ${candidate.topic}, then test which parts still explain ${candidate.focus} and which parts need a new model.`;
    const question = pathType === 'sequence'
      ? `Before opening it: what part of ${context.focus} do you expect ${candidate.focus} to build on?`
      : pathType === 'deepen'
        ? `Predict first: if ${termLabel} changed, what would change in ${candidate.focus}?`
        : pathType === 'compare'
          ? `What should stay true across both ${context.focus} and ${candidate.focus}?`
          : `Which assumption from ${context.focus} might stop working in ${candidate.focus}?`;
    return [{
      post,
      score: (explicitNext ? 40 : 0) + (sameTopic ? 12 : 3) + sharedFocusTerms.length * 6 + overlap * 2,
      reason,
      pathType,
      foundation,
      preview,
      connection,
      question,
    }];
  }).sort((a, b) => b.score - a.score).slice(0, limit);
}

export function getFocusedQuizId(context = {}) {
  const source = context.focus || context.title || context.topic || context.postId || 'lesson';
  const lessonId = normalizeLearningTopic(context.postId).slice(-22);
  return `lesson-${normalizeLearningTopic(source).slice(0, 54) || 'topic'}${lessonId ? `-${lessonId}` : ''}`;
}
