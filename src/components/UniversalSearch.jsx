import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowUpRight,
  BookOpen,
  BrainCircuit,
  FileText,
  Hash,
  History,
  LoaderCircle,
  Newspaper,
  RotateCcw,
  Search,
  UserRound,
  UsersRound,
  WifiOff,
  X,
} from 'lucide-react';
import { chatApi, newsApi, postApi, readBooksApi, roomApi } from '../api/client';
import { getDefaultNewsCountry } from '../data/newsLocations';
import { getUserScopedStorageKey } from '../lib/userScopedStorage';
import './UniversalSearch.css';

const SEARCH_DELAY_MS = 240;
const SEARCH_CACHE_MS = 1000 * 60 * 5;
const SOURCE_CACHE_MS = 1000 * 60 * 3;
const SOURCE_TIMEOUT_MS = 7000;
const EXTERNAL_SOURCE_TIMEOUT_MS = 9000;
const MAX_SEARCH_CACHE_ENTRIES = 40;
const MAX_SOURCE_CACHE_ENTRIES = 8;
const MAX_QUERY_LENGTH = 120;
const RESULT_LIMIT = 6;
const searchCache = new Map();
const sourceCache = new Map();

const QUERY_ALIASES = {
  ai: ['artificial intelligence', 'machine learning', 'neural networks'],
  ml: ['machine learning', 'artificial intelligence'],
  coding: ['programming', 'software development'],
  programming: ['coding', 'software development'],
  money: ['finance', 'personal finance', 'investing'],
  stocks: ['stock market', 'investing', 'trading'],
  brain: ['neuroscience', 'brain function', 'cognitive psychology'],
  mind: ['psychology', 'mental health', 'neuroscience'],
  space: ['astronomy', 'cosmos', 'spaceflight'],
  climate: ['climate change', 'environment', 'sustainability'],
  startup: ['startups', 'entrepreneurship', 'business'],
  startups: ['entrepreneurship', 'business'],
};

const SOURCE_LABELS = {
  topics: 'topics',
  posts: 'posts',
  people: 'people',
  rooms: 'rooms',
  books: 'books',
  news: 'news',
};

const DEFAULT_TOPICS = [
  'Artificial Intelligence', 'Astronomy', 'Biology', 'Brain Function',
  'Business', 'Chemistry', 'Climate Change', 'Coding', 'Consumer Behavior',
  'Culture', 'Cybersecurity', 'Decision Making', 'Economics', 'Entrepreneurship',
  'Environment', 'Finance', 'Fitness', 'Focus', 'Global Economy', 'Gravity',
  'Habits', 'Health', 'History', 'Human Behavior', 'Investing', 'Learning',
  'Marketing', 'Memory', 'Mental Health', 'Motivation', 'Neuroscience',
  'Nutrition', 'Personal Finance', 'Physics', 'Productivity', 'Psychology',
  'Self Improvement', 'Sleep', 'Society', 'Software Systems', 'Space',
  'Startups', 'Stock Market', 'Sustainability', 'Technology', 'Trading',
];

const QUICK_DESTINATIONS = [
  { key: 'quick-topics', label: 'Explore topics', meta: 'Complete catalog', path: '/topics', type: 'topic' },
  { key: 'quick-books', label: 'Read books', meta: 'Free library', path: '/read-books', type: 'book' },
  { key: 'quick-news', label: "Today's briefing", meta: 'Local and global news', path: '/news', type: 'news' },
  { key: 'quick-quiz', label: 'Challenge yourself', meta: 'Adaptive quizzes', path: '/quiz', type: 'quiz' },
  { key: 'quick-rooms', label: 'Join discussions', meta: 'Topic rooms', path: '/rooms', type: 'room' },
  { key: 'quick-saved', label: 'Saved knowledge', meta: 'Your collection', path: '/saved', type: 'post' },
];

const TYPE_ICONS = {
  topic: Hash,
  post: FileText,
  person: UserRound,
  room: UsersRound,
  book: BookOpen,
  news: Newspaper,
  quiz: BrainCircuit,
};

const FILTERS = [
  ['all', 'All'],
  ['topics', 'Topics'],
  ['posts', 'Posts'],
  ['people', 'People'],
  ['rooms', 'Rooms'],
  ['books', 'Books'],
  ['news', 'News'],
];

function normalizeText(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function setBoundedCache(cache, key, value, limit) {
  if (cache.has(key)) cache.delete(key);
  cache.set(key, value);

  while (cache.size > limit) {
    const oldestKey = cache.keys().next().value;
    cache.delete(oldestKey);
  }
}

function withTimeout(promise, timeoutMs, sourceName) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = window.setTimeout(() => {
      const error = new Error(`${sourceName} search timed out`);
      error.code = 'SEARCH_TIMEOUT';
      reject(error);
    }, timeoutMs);
  });

  return Promise.race([promise, timeout]).finally(() => window.clearTimeout(timer));
}

function editDistanceWithinOne(left, right) {
  if (left === right) return true;
  if (Math.abs(left.length - right.length) > 1) return false;

  let leftIndex = 0;
  let rightIndex = 0;
  let edits = 0;

  while (leftIndex < left.length && rightIndex < right.length) {
    if (left[leftIndex] === right[rightIndex]) {
      leftIndex += 1;
      rightIndex += 1;
      continue;
    }

    edits += 1;
    if (edits > 1) return false;

    if (left.length > right.length) leftIndex += 1;
    else if (right.length > left.length) rightIndex += 1;
    else {
      leftIndex += 1;
      rightIndex += 1;
    }
  }

  if (leftIndex < left.length || rightIndex < right.length) edits += 1;
  return edits <= 1;
}

function tokenMatchScore(queryToken, candidateToken) {
  if (!queryToken || !candidateToken) return 0;
  if (queryToken === candidateToken) return 1;
  if (candidateToken.startsWith(queryToken) && queryToken.length >= 2) return 0.88;
  if (queryToken.startsWith(candidateToken) && candidateToken.length >= 3) return 0.78;
  if (
    queryToken.length >= 4 &&
    candidateToken.length >= 4 &&
    editDistanceWithinOne(queryToken, candidateToken)
  ) {
    return 0.68;
  }
  return 0;
}

function getQueryVariants(query) {
  const normalized = normalizeText(query);
  const aliases = QUERY_ALIASES[normalized] || [];
  return [normalized, ...aliases.map(normalizeText)].filter(Boolean);
}

function scoreSingleMatch(searchableValue, normalizedQuery) {
  const searchable = normalizeText(searchableValue);
  if (!searchable || !normalizedQuery) return 0;
  if (searchable === normalizedQuery) return 140;
  if (searchable.startsWith(normalizedQuery)) return 118;
  if (normalizedQuery.length >= 3 && searchable.includes(normalizedQuery)) return 96;

  const queryWords = normalizedQuery.split(/[^a-z0-9]+/).filter(Boolean);
  const candidateWords = searchable.split(/[^a-z0-9]+/).filter(Boolean);
  if (!queryWords.length || !candidateWords.length) return 0;

  const tokenScores = queryWords.map((queryWord) =>
    candidateWords.reduce(
      (best, candidateWord) => Math.max(best, tokenMatchScore(queryWord, candidateWord)),
      0
    )
  );
  const matchedScores = tokenScores.filter((score) => score > 0);
  const coverage = matchedScores.length / queryWords.length;

  if (coverage === 1) {
    const quality = matchedScores.reduce((sum, score) => sum + score, 0) / matchedScores.length;
    return 54 + quality * 34;
  }

  if (queryWords.length > 1 && coverage >= 0.66) return 36 * coverage;
  return 0;
}

function getTopicValue(value) {
  if (value && typeof value === 'object') {
    return String(
      value.name ||
        value.label ||
        value.title ||
        value.topic ||
        value.topicName ||
        value.slug ||
        ''
    ).trim();
  }

  return String(value || '').trim();
}

function uniqueTopics(values = []) {
  const seen = new Set();

  return values.reduce((topics, value) => {
    const topic = getTopicValue(value);
    const key = normalizeText(topic);
    if (!key || seen.has(key)) return topics;
    seen.add(key);
    topics.push(topic);
    return topics;
  }, []);
}

function scoreMatch(searchableValue, query) {
  return getQueryVariants(query).reduce((best, variant, index) => {
    const score = scoreSingleMatch(searchableValue, variant);
    return Math.max(best, index === 0 ? score : score * 0.9);
  }, 0);
}

function rankMatches(items, query, getSearchText, limit = RESULT_LIMIT) {
  return (items || [])
    .map((item, index) => ({ item, index, score: scoreMatch(getSearchText(item), query) }))
    .filter(({ score }) => score > 0)
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .slice(0, limit)
    .map(({ item }) => item);
}

function dedupe(items, getKey) {
  const seen = new Set();

  return (items || []).filter((item) => {
    const key = String(getKey(item) || '').trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function extractArray(value, keys = []) {
  if (Array.isArray(value)) return value;

  for (const key of keys) {
    if (Array.isArray(value?.[key])) return value[key];
  }

  return [];
}

function getPostId(post) {
  return String(post?.reelId || post?.postId || post?.id || '').trim();
}

function getPersonId(person) {
  return String(person?.userId || person?.sub || person?.id || '').trim();
}

function getRoomId(room) {
  return String(room?.roomId || room?.id || room?.topicId || '').trim();
}

function getBookId(book) {
  return String(book?.gutenberg_id || book?.book_id || book?.ia || book?.id || '').trim();
}

function getBookAuthor(book) {
  if (Array.isArray(book?.authors)) {
    return book.authors.map((author) => author?.name || author).filter(Boolean).join(', ');
  }
  if (Array.isArray(book?.author_name)) return book.author_name.join(', ');
  return String(book?.author || book?.author_name || 'Unknown author');
}

function readCachedPosts(userId) {
  try {
    const key = getUserScopedStorageKey('smarty_cached_feed_v2', userId);
    const parsed = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function readCachedNews() {
  const articles = [];

  try {
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index) || '';
      if (!key.startsWith('smarty_location_news_v19_')) continue;

      const cached = JSON.parse(localStorage.getItem(key) || 'null');
      const news = cached?.news || {};
      const cachedArticles = Array.isArray(news.articles)
        ? news.articles
        : Object.entries(news.sections || {}).flatMap(([section, items]) =>
            (Array.isArray(items) ? items : []).map((item) => ({ ...item, section: item.section || section }))
          );

      articles.push(...cachedArticles);
    }
  } catch {
    return [];
  }

  return dedupe(articles, (article) => article.news_link || article.url || article.id || article.title);
}

function extractNewsArticles(newsData) {
  if (!newsData) return [];
  if (Array.isArray(newsData)) return newsData;
  if (Array.isArray(newsData.articles)) return newsData.articles;

  return Object.entries(newsData.sections || {}).flatMap(([section, items]) =>
    (Array.isArray(items) ? items : []).map((item) => ({
      ...item,
      section: item.section || section,
    }))
  );
}

function getNewsSearchLocation() {
  const country = getDefaultNewsCountry();
  let region = '';

  try {
    region = localStorage.getItem(`smarty-news-region-${country}`) || '';
  } catch {
    region = '';
  }

  return { country, region };
}

function makeTopicResults(topics, query) {
  return rankMatches(uniqueTopics(topics), query, (topic) => topic).map((topic) => ({
    key: `topic-${normalizeText(topic)}`,
    type: 'topic',
    label: topic,
    description: `Explore focused lessons, posts, and ideas about ${topic}.`,
    meta: 'Topic',
    path: `/feed?topic=${encodeURIComponent(topic)}`,
  }));
}

function makePostResults(posts, query) {
  const ranked = rankMatches(
    dedupe(posts, getPostId),
    query,
    (post) => [
      post?.title,
      post?.body,
      post?.description,
      post?.caption,
      post?.topic,
      post?.subTopic,
      post?.subtopic,
      post?.author,
      post?.creatorName,
    ].flat().filter(Boolean).join(' ')
  );

  return ranked.map((post) => {
    const postId = getPostId(post);
    const topic = getTopicValue(post?.topic || post?.category) || 'Post';

    return {
      key: `post-${postId}`,
      type: 'post',
      label: post?.title || post?.caption || `A post about ${topic}`,
      description: post?.description || post?.body || post?.caption || `Continue learning about ${topic}.`,
      meta: topic,
      image: post?.thumbnail || post?.imageUrl || post?.coverImage || post?.image || '',
      path: `/reel/${encodeURIComponent(postId)}`,
    };
  });
}

function makePeopleResults(people, query) {
  return rankMatches(
    dedupe(people, getPersonId),
    query,
    (person) => [person?.name, person?.displayName, person?.username, person?.email].filter(Boolean).join(' ')
  ).map((person) => {
    const personId = getPersonId(person);
    const username = person?.username ? `@${String(person.username).replace(/^@/, '')}` : '';

    return {
      key: `person-${personId}`,
      type: 'person',
      label: person?.name || person?.displayName || person?.username || person?.email || 'Smarty user',
      description: [username, person?.bio || person?.headline].filter(Boolean).join(' · ') || 'View profile',
      meta: 'Person',
      image: person?.photoUrl || person?.avatarUrl || person?.profilePic || person?.profilePictureUrl || '',
      path: `/creator/${encodeURIComponent(personId)}`,
    };
  });
}

function makeRoomResults(rooms, query) {
  return rankMatches(
    dedupe(rooms, getRoomId),
    query,
    (room) => [room?.name, room?.title, room?.description, room?.topic, room?.category].filter(Boolean).join(' ')
  ).map((room) => {
    const roomId = getRoomId(room);

    return {
      key: `room-${roomId}`,
      type: 'room',
      roomId,
      label: room?.name || room?.title || 'Topic room',
      description: room?.description || room?.about || 'Open the discussion and learn together.',
      meta: room?.privacy === 'private' || room?.isPrivate ? 'Private room' : 'Discussion',
      image: room?.imageUrl || room?.roomImageUrl || room?.coverImageUrl || '',
      path: `/rooms/${encodeURIComponent(roomId)}`,
    };
  });
}

function makeBookResults(books, query) {
  return rankMatches(
    dedupe(books, (book) => getBookId(book) || `${book?.title}-${getBookAuthor(book)}`),
    query,
    (book) => [book?.title, getBookAuthor(book), book?.subjects, book?.description].flat().filter(Boolean).join(' ')
  ).map((book) => {
    const bookId = getBookId(book);
    const readable = Boolean(book?.readable || book?.gutenberg_id || book?.book_id || book?.ia);

    return {
      key: `book-${bookId || normalizeText(book?.title)}`,
      type: 'book',
      label: book?.title || 'Untitled book',
      description: getBookAuthor(book),
      meta: readable ? 'Read free' : 'Book',
      image: book?.cover || book?.coverUrl || '',
      path: readable && bookId
        ? `/read-book/${encodeURIComponent(bookId)}`
        : `/read-books?search=${encodeURIComponent(book?.title || query)}`,
    };
  });
}

function makeNewsResults(articles, query) {
  return rankMatches(
    articles,
    query,
    (article) => [article?.title, article?.summary, article?.source, article?.section].filter(Boolean).join(' ')
  ).map((article, index) => ({
    key: `news-${article?.id || index}-${normalizeText(article?.title)}`,
    type: 'news',
    label: article?.title || 'News story',
    description: article?.summary || `Reported by ${article?.source || 'a news source'}.`,
    meta: [article?.section, article?.source].filter(Boolean).join(' · ') || 'News',
    image: article?.image_link || article?.image_url || '',
    externalUrl: article?.news_link || article?.url || '',
  }));
}

function makeActionResults(query, signedIn) {
  const encoded = encodeURIComponent(query);
  const actions = [
    {
      key: `action-feed-${normalizeText(query)}`,
      type: 'topic',
      label: `Explore “${query}”`,
      description: 'Open the focused learning feed.',
      meta: 'Feed',
      path: `/feed?topic=${encoded}`,
    },
    {
      key: `action-quiz-${normalizeText(query)}`,
      type: 'quiz',
      label: `Quiz yourself on “${query}”`,
      description: 'Turn this subject into a knowledge challenge.',
      meta: 'Quiz',
      path: `/quiz?topic=${encoded}`,
    },
    {
      key: `action-news-${normalizeText(query)}`,
      type: 'news',
      label: `Find “${query}” in today’s news`,
      description: 'Search your selected country and regional briefing.',
      meta: 'News',
      path: `/news?search=${encoded}`,
    },
    {
      key: `action-books-${normalizeText(query)}`,
      type: 'book',
      label: `Find books about “${query}”`,
      description: 'Search the free reading library.',
      meta: 'Books',
      path: `/read-books?search=${encoded}`,
    },
  ];

  if (signedIn) {
    actions.push({
      key: `action-rooms-${normalizeText(query)}`,
      type: 'room',
      label: `Discuss “${query}”`,
      description: 'Find a room or start exploring related discussions.',
      meta: 'Rooms',
      path: `/rooms?search=${encoded}`,
    });
  }

  return actions;
}

function getRecentSearches(storageKey) {
  try {
    const value = JSON.parse(localStorage.getItem(storageKey) || '[]');
    return Array.isArray(value) ? value.slice(0, 6) : [];
  } catch {
    return [];
  }
}

const EMPTY_RESULTS = {
  topics: [],
  posts: [],
  people: [],
  rooms: [],
  books: [],
  news: [],
  actions: [],
};

export default function UniversalSearch({ open, onOpen, onClose, user }) {
  const navigate = useNavigate();
  const inputRef = useRef(null);
  const panelRef = useRef(null);
  const requestSequenceRef = useRef(0);
  const searchTimerRef = useRef(null);
  const abortControllerRef = useRef(null);
  const previousFocusRef = useRef(null);
  const [query, setQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [activeIndex, setActiveIndex] = useState(0);
  const [results, setResults] = useState(EMPTY_RESULTS);
  const [loading, setLoading] = useState(false);
  const [partialFailure, setPartialFailure] = useState(false);
  const [pendingSources, setPendingSources] = useState([]);
  const [failedSources, setFailedSources] = useState([]);
  const [isOnline, setIsOnline] = useState(() => (
    typeof navigator === 'undefined' ? true : navigator.onLine
  ));

  const userId = String(user?.userId || user?.sub || user?.id || '').trim();
  const searchScope = userId || 'guest';
  const recentStorageKey = useMemo(
    () => getUserScopedStorageKey('smarty-universal-search-recent-v1', searchScope),
    [searchScope]
  );
  const [recentSearches, setRecentSearches] = useState(() => getRecentSearches(recentStorageKey));

  useEffect(() => {
    setRecentSearches(getRecentSearches(recentStorageKey));
  }, [recentStorageKey]);

  const saveRecentSearch = useCallback((value) => {
    const normalized = String(value || '').trim();
    if (normalized.length < 2) return;

    setRecentSearches((current) => {
      const next = [normalized, ...current.filter((item) => normalizeText(item) !== normalizeText(normalized))].slice(0, 6);
      try {
        localStorage.setItem(recentStorageKey, JSON.stringify(next));
      } catch {
        // Search remains usable if storage is unavailable.
      }
      return next;
    });
  }, [recentStorageKey]);

  const runSearch = useCallback(async (rawQuery, options = {}) => {
    const cleanQuery = String(rawQuery || '').trim().slice(0, MAX_QUERY_LENGTH);
    if (cleanQuery.length < 2) return;

    const requestId = requestSequenceRef.current + 1;
    requestSequenceRef.current = requestId;
    const cacheKey = `${searchScope}:${normalizeText(cleanQuery)}`;
    const cached = searchCache.get(cacheKey);

    if (!options.force && cached && Date.now() - cached.savedAt < SEARCH_CACHE_MS) {
      setResults(cached.results);
      setLoading(false);
      setPartialFailure(false);
      setPendingSources([]);
      setFailedSources([]);
      return;
    }

    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const cachedPosts = readCachedPosts(userId);
    const cachedNews = readCachedNews();
    const cachedSources = sourceCache.get(searchScope);
    const sourceCacheFresh = Boolean(
      cachedSources && Date.now() - cachedSources.savedAt < SOURCE_CACHE_MS
    );
    let sourceSnapshot = cachedSources || { topics: [], posts: [], news: [] };
    let latestResults = {
      ...EMPTY_RESULTS,
      topics: makeTopicResults([...DEFAULT_TOPICS, ...(sourceSnapshot.topics || [])], cleanQuery),
      posts: makePostResults([...cachedPosts, ...(sourceSnapshot.posts || [])], cleanQuery),
      news: makeNewsResults([...cachedNews, ...(sourceSnapshot.news || [])], cleanQuery),
      actions: makeActionResults(cleanQuery, Boolean(user)),
    };

    setResults(latestResults);
    setPartialFailure(false);
    setFailedSources([]);

    if (!isOnline) {
      setLoading(false);
      setPendingSources([]);
      setBoundedCache(
        searchCache,
        cacheKey,
        { savedAt: Date.now(), results: latestResults },
        MAX_SEARCH_CACHE_ENTRIES
      );
      return;
    }

    const sourcesToSearch = [
      ...(!sourceCacheFresh ? ['topics', 'posts'] : []),
      ...(user ? ['people', 'rooms'] : []),
      'books',
      ...(cachedNews.length || sourceSnapshot.news?.length ? [] : ['news']),
    ];

    setPendingSources(sourcesToSearch);
    setLoading(sourcesToSearch.length > 0);

    const failed = new Set();
    const isCurrentRequest = () => (
      requestId === requestSequenceRef.current && !controller.signal.aborted
    );

    const commitResults = (category, categoryResults) => {
      if (!isCurrentRequest()) return;

      latestResults = { ...latestResults, [category]: categoryResults };
      setResults(latestResults);
      setBoundedCache(
        searchCache,
        cacheKey,
        { savedAt: Date.now(), results: latestResults },
        MAX_SEARCH_CACHE_ENTRIES
      );
    };

    const updateSourceCache = (patch) => {
      sourceSnapshot = { ...sourceSnapshot, ...patch, savedAt: Date.now() };
      setBoundedCache(
        sourceCache,
        searchScope,
        sourceSnapshot,
        MAX_SOURCE_CACHE_ENTRIES
      );
    };

    const runSource = (name, request, onSuccess, timeoutMs = SOURCE_TIMEOUT_MS) =>
      withTimeout(Promise.resolve().then(request), timeoutMs, name)
        .then((value) => {
          if (isCurrentRequest()) onSuccess(value);
        })
        .catch((error) => {
          if (
            !isCurrentRequest() ||
            error?.name === 'AbortError' ||
            error?.code === 'ERR_CANCELED'
          ) {
            return;
          }

          failed.add(name);
          setFailedSources(Array.from(failed));
        })
        .finally(() => {
          if (!isCurrentRequest()) return;
          setPendingSources((current) => current.filter((source) => source !== name));
        });

    const jobs = [];

    if (!sourceCacheFresh) {
      jobs.push(runSource('topics', () => postApi.getTopics(), (value) => {
        const liveTopics = extractArray(value, ['topics', 'items', 'results']);
        updateSourceCache({ topics: liveTopics });
        commitResults('topics', makeTopicResults([...DEFAULT_TOPICS, ...liveTopics], cleanQuery));
      }));

      jobs.push(runSource('posts', () => postApi.getFeed({ limit: 60 }), (value) => {
        const livePosts = extractArray(value, ['items', 'posts', 'reels']);
        updateSourceCache({ posts: livePosts });
        commitResults('posts', makePostResults([...cachedPosts, ...livePosts], cleanQuery));
      }));
    }

    if (user) {
      jobs.push(runSource('people', () => chatApi.searchUsers(cleanQuery), (value) => {
        commitResults(
          'people',
          makePeopleResults(extractArray(value, ['users', 'items', 'results']), cleanQuery)
        );
      }));

      jobs.push(runSource('rooms', () => roomApi.getRooms({ search: cleanQuery }), (value) => {
        commitResults(
          'rooms',
          makeRoomResults(extractArray(value, ['rooms', 'items', 'results']), cleanQuery)
        );
      }));
    }

    jobs.push(runSource(
      'books',
      () => readBooksApi.searchBooks(
        cleanQuery,
        { page: 1, page_size: 12, limit: 12 },
        { signal: controller.signal }
      ),
      (value) => {
        commitResults(
          'books',
          makeBookResults(extractArray(value, ['books', 'items', 'results']), cleanQuery)
        );
      },
      EXTERNAL_SOURCE_TIMEOUT_MS
    ));

    if (!cachedNews.length && !sourceSnapshot.news?.length) {
      jobs.push(runSource(
        'news',
        () => newsApi.getLatestNews({
          ...getNewsSearchLocation(),
          lang: 'english',
          signal: controller.signal,
        }),
        (value) => {
          const liveNews = extractNewsArticles(value);
          updateSourceCache({ news: liveNews });
          commitResults('news', makeNewsResults(liveNews, cleanQuery));
        },
        EXTERNAL_SOURCE_TIMEOUT_MS
      ));
    }

    await Promise.allSettled(jobs);
    if (!isCurrentRequest()) return;

    setLoading(false);
    setPendingSources([]);
    setPartialFailure(failed.size > 0);
    setFailedSources(Array.from(failed));
    setBoundedCache(
      searchCache,
      cacheKey,
      { savedAt: Date.now(), results: latestResults },
      MAX_SEARCH_CACHE_ENTRIES
    );
  }, [isOnline, searchScope, user, userId]);

  useEffect(() => {
    if (!open) return undefined;

    const cleanQuery = query.trim();
    if (searchTimerRef.current) window.clearTimeout(searchTimerRef.current);

    if (cleanQuery.length < 2) {
      requestSequenceRef.current += 1;
      abortControllerRef.current?.abort();
      setResults(EMPTY_RESULTS);
      setLoading(false);
      setPartialFailure(false);
      return undefined;
    }

    searchTimerRef.current = window.setTimeout(() => {
      searchTimerRef.current = null;
      runSearch(cleanQuery).catch((error) => {
        if (error?.name === 'AbortError' || error?.code === 'ERR_CANCELED') return;
        console.error('Universal search failed:', error);
        setLoading(false);
        setPartialFailure(true);
      });
    }, SEARCH_DELAY_MS);

    return () => {
      if (searchTimerRef.current) {
        window.clearTimeout(searchTimerRef.current);
        searchTimerRef.current = null;
      }
    };
  }, [open, query, runSearch]);

  useEffect(() => {
    const handleGlobalShortcut = (event) => {
      const target = event.target;
      const isTyping = target instanceof HTMLElement && (
        target.isContentEditable ||
        ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
      );

      if (open && event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        onOpen();
        return;
      }

      if (!open && event.key === '/' && !isTyping && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault();
        onOpen();
      }
    };

    window.addEventListener('keydown', handleGlobalShortcut);
    return () => window.removeEventListener('keydown', handleGlobalShortcut);
  }, [onClose, onOpen, open]);

  useEffect(() => {
    if (!open) return undefined;

    previousFocusRef.current = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const focusTimer = window.setTimeout(() => inputRef.current?.focus(), 30);

    const keepFocusInside = (event) => {
      if (event.key !== 'Tab' || !panelRef.current) return;

      const focusable = Array.from(
        panelRef.current.querySelectorAll(
          'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
        )
      ).filter((element) => !element.hasAttribute('hidden'));

      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', keepFocusInside);

    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('keydown', keepFocusInside);
      document.body.style.overflow = previousOverflow;
      abortControllerRef.current?.abort();
      requestSequenceRef.current += 1;
      previousFocusRef.current?.focus?.();
    };
  }, [open]);

  const groups = useMemo(() => {
    const allGroups = [
      { key: 'topics', label: 'Topics', items: results.topics },
      { key: 'posts', label: 'Posts', items: results.posts },
      { key: 'people', label: 'People', items: results.people },
      { key: 'rooms', label: 'Rooms', items: results.rooms },
      { key: 'books', label: 'Books', items: results.books },
      { key: 'news', label: 'News', items: results.news },
      { key: 'actions', label: 'Keep exploring', items: results.actions },
    ];

    if (activeFilter === 'all') return allGroups.filter((group) => group.items.length);
    return allGroups.filter((group) => group.key === activeFilter && group.items.length);
  }, [activeFilter, results]);

  const keyboardResults = useMemo(
    () => groups.flatMap((group) => group.items),
    [groups]
  );

  useEffect(() => {
    setActiveIndex(0);
  }, [activeFilter, query]);

  const selectResult = useCallback((result) => {
    if (!result) return;
    saveRecentSearch(query);

    if (result.externalUrl) {
      window.open(result.externalUrl, '_blank', 'noopener,noreferrer');
      onClose();
      return;
    }

    if (result.type === 'room' && result.roomId) {
      navigate('/rooms', {
        state: {
          openJoinedRoom: true,
          openRoomId: result.roomId,
          selectedRoomId: result.roomId,
          searchSource: 'universal-search',
        },
      });
      onClose();
      return;
    }

    if (result.path) {
      navigate(result.path);
      onClose();
    }
  }, [navigate, onClose, query, saveRecentSearch]);

  const handleInputKeyDown = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
      return;
    }

    if (!keyboardResults.length) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((current) => (current + 1) % keyboardResults.length);
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((current) => (current - 1 + keyboardResults.length) % keyboardResults.length);
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      selectResult(keyboardResults[activeIndex]);
    }
  };

  if (!open) return null;

  const cleanQuery = query.trim();
  const hasResults = keyboardResults.length > 0;

  return (
    <div
      className="universal-search-layer"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="universal-search-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Search Smarty"
        ref={panelRef}
      >
        <div className="universal-search-input-row">
          <Search size={22} strokeWidth={1.9} aria-hidden="true" />
          <label className="sr-only" htmlFor="universal-search-input">Search Smarty</label>
          <input
            id="universal-search-input"
            ref={inputRef}
            type="search"
            autoComplete="off"
            spellCheck="false"
            placeholder="Search topics, posts, people, books, news…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={handleInputKeyDown}
            aria-controls="universal-search-results"
            aria-activedescendant={hasResults ? `universal-result-${activeIndex}` : undefined}
          />

          {query && (
            <button
              type="button"
              className="universal-search-clear"
              onClick={() => {
                setQuery('');
                inputRef.current?.focus();
              }}
              aria-label="Clear search"
            >
              <X size={17} aria-hidden="true" />
            </button>
          )}

          <kbd>⌘ K</kbd>
          <button
            type="button"
            className="universal-search-close"
            onClick={onClose}
            aria-label="Close search"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        {cleanQuery.length >= 2 && (
          <nav className="universal-search-filters" aria-label="Search result types">
            {FILTERS.map(([value, label]) => {
              const count = value === 'all'
                ? Object.values(results).reduce((total, items) => total + items.length, 0)
                : results[value]?.length || 0;

              return (
                <button
                  type="button"
                  key={value}
                  className={activeFilter === value ? 'is-active' : ''}
                  onClick={() => setActiveFilter(value)}
                >
                  {label}
                  {count > 0 && <span>{count}</span>}
                </button>
              );
            })}
          </nav>
        )}

        <div className="universal-search-body" id="universal-search-results">
          {cleanQuery.length < 2 ? (
            <div className="universal-search-start">
              <div className="universal-search-intro">
                <span>SMARTY SEARCH</span>
                <h2 id="universal-search-title">Find anything. Keep learning.</h2>
                <p>Search across the whole app without leaving what you are doing.</p>
              </div>

              {recentSearches.length > 0 && (
                <section className="universal-search-recent" aria-label="Recent searches">
                  <h3><History size={15} aria-hidden="true" /> Recent</h3>
                  <div>
                    {recentSearches.map((item) => (
                      <button type="button" key={item} onClick={() => setQuery(item)}>{item}</button>
                    ))}
                  </div>
                </section>
              )}

              <div className="universal-search-quick-grid">
                {QUICK_DESTINATIONS.map((item) => {
                  const Icon = TYPE_ICONS[item.type] || Search;
                  return (
                    <button type="button" key={item.key} onClick={() => selectResult(item)}>
                      <span className={`universal-result-icon is-${item.type}`}><Icon size={18} /></span>
                      <span><strong>{item.label}</strong><small>{item.meta}</small></span>
                      <ArrowUpRight size={16} aria-hidden="true" />
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="universal-search-results" role="listbox" aria-label="Search results">
              {loading && (
                <div className="universal-search-progress" role="status">
                  <LoaderCircle size={15} aria-hidden="true" /> Searching across Smarty
                </div>
              )}

              {groups.map((group) => (
                <section className="universal-search-group" key={group.key}>
                  <header>
                    <h3>{group.label}</h3>
                    <span>{group.items.length}</span>
                  </header>

                  <div>
                    {group.items.map((result) => {
                      const resultIndex = keyboardResults.indexOf(result);
                      const Icon = TYPE_ICONS[result.type] || Search;

                      return (
                        <button
                          type="button"
                          id={`universal-result-${resultIndex}`}
                          role="option"
                          aria-selected={resultIndex === activeIndex}
                          className={`universal-search-result${resultIndex === activeIndex ? ' is-active' : ''}`}
                          key={result.key}
                          onMouseEnter={() => setActiveIndex(resultIndex)}
                          onClick={() => selectResult(result)}
                        >
                          <span className={`universal-result-icon is-${result.type}`}>
                            {result.image ? (
                              <img src={result.image} alt="" loading="lazy" decoding="async" />
                            ) : (
                              <Icon size={19} strokeWidth={1.9} aria-hidden="true" />
                            )}
                          </span>
                          <span className="universal-result-copy">
                            <span className="universal-result-meta">{result.meta}</span>
                            <strong>{result.label}</strong>
                            <small>{result.description}</small>
                          </span>
                          <ArrowUpRight size={17} aria-hidden="true" />
                        </button>
                      );
                    })}
                  </div>
                </section>
              ))}

              {!loading && !hasResults && (
                <div className="universal-search-empty">
                  <Search size={24} strokeWidth={1.6} aria-hidden="true" />
                  <strong>No exact matches yet</strong>
                  <p>Try a shorter phrase, or use the learning paths below.</p>
                  <button type="button" onClick={() => setActiveFilter('all')}>Show all paths</button>
                </div>
              )}

              {partialFailure && (
                <p className="universal-search-notice">
                  Some live sources are taking longer. Available results are shown.
                </p>
              )}
            </div>
          )}
        </div>

        <footer className="universal-search-footer">
          <span><kbd>↑</kbd><kbd>↓</kbd> move</span>
          <span><kbd>↵</kbd> open</span>
          <span><kbd>esc</kbd> close</span>
        </footer>
      </section>
    </div>
  );
}
