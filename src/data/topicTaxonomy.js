const normalizeTopicKey = (value) =>
  String(value || '')
    .normalize('NFKD')
    .toLowerCase()
    .trim()
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

export const MAIN_TOPICS = [
  {
    id: 'news',
    label: 'News',
    domain: 'Current affairs',
    eyebrow: 'The world today',
    description: 'A daily world briefing, clear sector summaries, and original reporting to explore.',
    topics: ['World News', 'Current Affairs', 'Daily Briefing'],
  },
  {
    id: 'technology',
    label: 'Technology',
    domain: 'Digital systems',
    eyebrow: 'Digital systems',
    description: 'AI, software, data, security, and the systems behind modern life.',
    topics: [
      'Artificial Intelligence', 'Machine Learning', 'Data Science', 'Robotics',
      'Cybersecurity', 'Cryptography', 'Software Systems', 'Databases',
      'Operating Systems', 'Computer Networks', 'Cloud Computing',
    ],
  },
  {
    id: 'engineering',
    label: 'Engineering',
    domain: 'Engineering and technology',
    eyebrow: 'Build and invent',
    description: 'How ideas become machines, materials, infrastructure, and useful products.',
    topics: [
      'Semiconductors', 'Electronics', 'Engineering', 'Manufacturing',
      'Materials Science', 'Aviation', 'Transportation', 'Energy',
      'Infrastructure', 'Architecture',
    ],
  },
  {
    id: 'science-mathematics',
    label: 'Science & Mathematics',
    domain: 'Physical and quantitative science',
    eyebrow: 'Reason and discover',
    description: 'The laws, patterns, measurements, and models that explain our world.',
    topics: ['Physics', 'Chemistry', 'Mathematics', 'Statistics', 'Probability'],
  },
  {
    id: 'life-sciences',
    label: 'Life Sciences',
    domain: 'Life science',
    eyebrow: 'Living systems',
    description: 'From cells and genes to brains, immunity, microbes, and the human body.',
    topics: ['Biology', 'Genetics', 'Neuroscience', 'Human Body', 'Immunology', 'Microbiology'],
  },
  {
    id: 'earth-space',
    label: 'Earth & Space',
    domain: 'Earth and space',
    eyebrow: 'Our world and beyond',
    description: 'Planets, oceans, weather, climate, ecosystems, and the wider universe.',
    topics: [
      'Astronomy', 'Space', 'Earth Science', 'Geology', 'Oceanography',
      'Weather', 'Climate Change', 'Ecology', 'Environment',
    ],
  },
  {
    id: 'mind-health',
    label: 'Mind & Health',
    domain: 'Mind, learning, and health',
    eyebrow: 'Think and thrive',
    description: 'Psychology, learning, decisions, wellbeing, movement, food, and rest.',
    topics: [
      'Psychology', 'Human Behavior', 'Decision Making', 'Memory', 'Learning',
      'Sleep', 'Nutrition', 'Fitness', 'Health', 'Mental Health',
    ],
  },
  {
    id: 'money-business',
    label: 'Money & Business',
    domain: 'Money and enterprise',
    eyebrow: 'Markets and enterprise',
    description: 'Money, companies, markets, customers, trade, and how value moves.',
    topics: [
      'Finance', 'Investing', 'Personal Finance', 'Stock Market', 'Economics',
      'Global Economy', 'Business', 'Startups', 'Marketing',
      'Consumer Behavior', 'Supply Chain',
    ],
  },
  {
    id: 'food-agriculture',
    label: 'Food & Agriculture',
    domain: 'Food and agriculture',
    eyebrow: 'Grow and nourish',
    description: 'How food is grown, designed, produced, preserved, and understood.',
    topics: ['Agriculture', 'Food Science'],
  },
  {
    id: 'history',
    label: 'History',
    domain: 'History and civilization',
    eyebrow: 'Past to present',
    description: 'Civilizations, empires, borders, conflict, trade, and moments of change.',
    topics: [
      'History', 'Ancient Civilizations', 'World History', 'Geopolitical History',
      'Military History', 'Political History', 'Economic History',
      'Diplomatic History', 'Colonial History', 'Borders and Empires',
      'Medieval History', 'Modern History', 'Trade Routes', 'Revolutions',
    ],
  },
  {
    id: 'society-ideas',
    label: 'Society & Ideas',
    domain: 'Society and humanities',
    eyebrow: 'People and meaning',
    description: 'Culture, language, ethics, philosophy, and how societies take shape.',
    topics: ['Archaeology', 'Anthropology', 'Sociology', 'Culture', 'Linguistics', 'Philosophy', 'Ethics'],
  },
  {
    id: 'arts-design',
    label: 'Arts & Design',
    domain: 'Arts and creative practice',
    eyebrow: 'Create and interpret',
    description: 'Art, music, images, film, and the craft of thoughtful design.',
    topics: ['Art History', 'Music Theory', 'Photography', 'Filmmaking', 'Product Design'],
  },
  {
    id: 'community',
    label: 'Community',
    domain: 'Community',
    eyebrow: 'From the community',
    description: 'Fresh interests and original subjects created by Smarty members.',
    topics: ['Community', 'General Knowledge', 'Smarty'],
    acceptsUnknownTopics: true,
  },
];

const LEGACY_TOPIC_GROUPS = {
  technology: ['AI', 'Tech', 'Technology', 'Coding', 'Programming', 'Software Development'],
  engineering: ['Innovation'],
  'science-mathematics': ['Science', 'Gravity', 'Black Holes', 'Cosmos'],
  'life-sciences': ['Nature'],
  'earth-space': ['Sustainability'],
  'mind-health': [
    'Habits', 'Motivation', 'Brain Function', 'Productivity', 'Focus',
    'Self Improvement', 'Discipline', 'Education', 'Health and Wellbeing',
  ],
  'money-business': ['Trading', 'Entrepreneurship'],
  history: ['Ancient Empires', 'History Between Nations', 'War', 'Wars and Conflicts'],
  'society-ideas': ['Law', 'Society'],
  'arts-design': ['Art', 'Poems', 'Poetry', 'Blog'],
};

const topicLookup = new Map();

MAIN_TOPICS.forEach((mainTopic) => {
  const values = [
    mainTopic.id,
    mainTopic.label,
    mainTopic.domain,
    ...mainTopic.topics,
    ...(LEGACY_TOPIC_GROUPS[mainTopic.id] || []),
  ];

  values.forEach((value) => {
    const key = normalizeTopicKey(value);
    if (key) topicLookup.set(key, mainTopic);
  });
});

export const MAIN_TOPIC_LABELS = MAIN_TOPICS.map((topic) => topic.label);

export function getMainTopicDefinition(value) {
  return topicLookup.get(normalizeTopicKey(value)) || null;
}

export function getMainTopicLabel(value) {
  return getMainTopicDefinition(value)?.label || '';
}

export function postMatchesMainTopic(post, selectedTopic, postTopicValues = []) {
  const selected = getMainTopicDefinition(selectedTopic);
  if (!selected) return false;

  const explicitDomain = getMainTopicDefinition(post?.topicDomain);
  if (explicitDomain) {
    return explicitDomain.id === selected.id;
  }

  const resolvedTopics = postTopicValues
    .map((topic) => getMainTopicDefinition(topic))
    .filter(Boolean);

  if (selected.acceptsUnknownTopics) {
    return resolvedTopics.length === 0;
  }

  return resolvedTopics.some((topic) => topic.id === selected.id);
}

export { normalizeTopicKey };
