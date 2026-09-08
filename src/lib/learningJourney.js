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

  return {
    postId,
    topic,
    focus,
    title: String(post.title || focus || topic).trim(),
    body: String(post.body || post.description || '').trim(),
    contentAngle: String(post.contentAngleLabel || post.contentAngle || '').trim(),
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
    return {
      read: Boolean(saved.read),
      understand: Boolean(saved.understand),
      challenge: Boolean(saved.challenge),
      updatedAt: saved.updatedAt || '',
    };
  } catch {
    return { read: false, understand: false, challenge: false, updatedAt: '' };
  }
}

export function markLearningProgress(postId, userId, stage) {
  if (!postId || !['read', 'understand', 'challenge'].includes(stage)) {
    return readLearningProgress(postId, userId);
  }

  const current = readLearningProgress(postId, userId);
  const stageOrder = ['read', 'understand', 'challenge'];
  const stageIndex = stageOrder.indexOf(stage);
  const next = {
    ...current,
    updatedAt: new Date().toISOString(),
  };

  stageOrder.slice(0, stageIndex + 1).forEach((stageName) => {
    next[stageName] = true;
  });

  try {
    localStorage.setItem(getLearningProgressKey(postId, userId), JSON.stringify(next));
  } catch {
    // Progress is optional when storage is unavailable (for example, private mode).
  }

  return next;
}

export function getFocusedQuizId(context = {}) {
  const source = context.focus || context.title || context.topic || context.postId || 'lesson';
  const lessonId = normalizeLearningTopic(context.postId).slice(-22);
  return `lesson-${normalizeLearningTopic(source).slice(0, 54) || 'topic'}${lessonId ? `-${lessonId}` : ''}`;
}
