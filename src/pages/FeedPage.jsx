import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  Bookmark,
  Bot,
  MessageCircle,
  Sparkles,
  Loader2,
} from 'lucide-react';
import { postApi, creatorApi } from '../api/client';
import FeedSkeleton from '../components/FeedSkeleton';
import useFeed from '../hooks/useFeed';
import './FeedPage.css';

const normalizeTopic = (value) =>
  String(value || '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-');

const getPostId = (post) => post?.reelId || post?.id || '';

const INITIAL_RENDER_LIMIT = 3;
const RENDER_BATCH_SIZE = 3;
const FAST_IMAGE_LIMIT = 6;
const IMAGE_PRELOAD_MARGIN = '1400px';

const getPostCreatorId = (post) => {
  const authorId = post?.authorId || post?.authorID || post?.author_id || '';
  return String(authorId || '').trim();
};

const getDisplayUsername = (post, creatorProfile = null) => {
  const profile = creatorProfile?.profile || creatorProfile?.user || creatorProfile || {};

  const databasePostNames = [
    post.creatorName,
    post.authorName,
    post.author,
    post.creatorEmail,
    post.authorEmail,
    post.email,
    post.creatorUsername,
    post.authorUsername,
    post.username,
    post.userName,
    post.displayName,
  ];

  const profileNames = [
    profile.username,
    profile.userName,
    profile.displayName,
    profile.name,
    profile.email,
  ];

  const nestedPostNames = [
    post.author?.username,
    post.author?.userName,
    post.author?.displayName,
    post.author?.name,
    post.author?.email,
    post.creator?.username,
    post.creator?.userName,
    post.creator?.displayName,
    post.creator?.name,
    post.creator?.email,
    post.user?.username,
    post.user?.userName,
    post.user?.displayName,
    post.user?.name,
    post.user?.email,
  ];

  const blockedValues = new Set([
    '',
    'null',
    'undefined',
    'none',
    'post',
    'creator',
    'unknown',
  ]);

  const formatName = (value) => {
    const text = String(value || '').trim();
    if (!text || blockedValues.has(text.toLowerCase())) return '';

    if (text.includes('@')) {
      return text.split('@')[0] || 'user';
    }

    return text;
  };

  const pickName = (values) => {
    for (const value of values) {
      const text = formatName(value);
      if (text) return text;
    }
    return '';
  };

  return pickName(databasePostNames) || pickName(profileNames) || pickName(nestedPostNames) || 'user';
};

const TopicPill = memo(function TopicPill({ item, active, onSelect }) {
  return (
    <button
      type="button"
      className={active ? 'topic-pill active' : 'topic-pill'}
      onClick={() => onSelect(item)}
      title={item}
    >
      <span>{item[0]}</span>
      <strong>{item}</strong>
    </button>
  );
});

// Memoized image component for feed posts with lazy loading and IntersectionObserver
const FeedImage = memo(function FeedImage({ src, alt, index }) {
  const imgRef = useRef(null);
  const [shouldLoad, setShouldLoad] = useState(index < FAST_IMAGE_LIMIT);

  useEffect(() => {
    if (shouldLoad || !imgRef.current) return undefined;

    const observer = new window.IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShouldLoad(true);
          observer.disconnect();
        }
      },
      {
        root: null,
        rootMargin: IMAGE_PRELOAD_MARGIN,
        threshold: 0,
      }
    );

    observer.observe(imgRef.current);

    return () => observer.disconnect();
  }, [shouldLoad]);

  return (
    <img
      ref={imgRef}
      src={shouldLoad ? src : undefined}
      data-src={src}
      alt={alt}
      loading={index < FAST_IMAGE_LIMIT ? 'eager' : 'lazy'}
      decoding="async"
     fetchpriority={index < FAST_IMAGE_LIMIT ? 'high' : shouldLoad ? 'auto' : 'low'}
      className="feed-image"
    />
  );
});

const FeedPostCard = memo(function FeedPostCard({
  post,
  index,
  creatorName,
  creatorId,
  postId,
  translatedText,
  isTranslated,
  isTranslating,
  isExplaining,
  explanation,
  onTopicClick,
  onSave,
  onAiDetails,
  onOpenPost,
  onComments,
  onExplain,
  onTranslateChange,
}) {
  const hasMedia = Boolean(post.videoUrl || post.imageUrl);
  const hasTranslation = Boolean(translatedText);

  return (
    <article
      id={`post-${postId}`}
      className={`snap-post ${!post.imageUrl && !post.videoUrl ? 'no-media' : ''}`}
      onClick={() => onOpenPost(post, creatorName)}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onOpenPost(post, creatorName);
        }
      }}
    >
      {hasMedia && (
        <div className="mini-media">
          {post.videoUrl ? (
            <video
              src={post.videoUrl}
              controls
              playsInline
              preload="none"
            />
          ) : (
            <FeedImage
              src={post.imageUrl}
              alt={post.title || 'Post media'}
              index={index}
            />
          )}
        </div>
      )}

      <div className="post-content">
        <button
          type="button"
          className="post-topic clickable-topic"
          onClick={(event) => {
            event.stopPropagation();
            onTopicClick(post.topic);
          }}
        >
          {post.topic || 'Smarty'}
        </button>

        <div className="post-author">
          {creatorId ? (
            <Link
              to={`/creator/${encodeURIComponent(String(creatorId))}`}
              className="creator-link"
              title={`Open ${creatorName}'s creator profile`}
              aria-label={`Open ${creatorName}'s creator profile`}
              onClick={(event) => event.stopPropagation()}
              state={{
                fromPostId: postId,
                creatorId,
                databaseAuthorId: creatorId,
                databaseAuthor: post.author || '',
                source: 'feed-author-link',
              }}
            >
              {creatorName}
            </Link>
          ) : (
            <span
              className="creator-link creator-link-disabled"
              title="Creator profile unavailable for this post"
              aria-label="Creator profile unavailable for this post"
            >
              {creatorName}
            </span>
          )}
        </div>

        <h1>{post.title}</h1>
        <p>{isTranslated && translatedText ? translatedText : post.body}</p>

        <div className="post-actions">
          <button
            type="button"
            className="icon-action-btn"
            disabled={!postId}
            onClick={(event) => {
              event.stopPropagation();
              onSave(postId);
            }}
            title="Save"
            aria-label="Save"
          >
            <Bookmark size={18} strokeWidth={2.2} />
          </button>



          <button
            type="button"
            className="icon-action-btn"
            disabled={!postId}
            title="Comments"
            aria-label="Comments"
            onClick={(event) => {
              event.stopPropagation();
              onComments(postId);
            }}
          >
            <MessageCircle size={18} strokeWidth={2.2} />
          </button>

          <button
            type="button"
            className="icon-action-btn"
            title="Simplify"
            aria-label="Simplify"
            onClick={(event) => {
              event.stopPropagation();
              onExplain(post);
            }}
            disabled={isExplaining}
          >
            {isExplaining ? (
              <Loader2 size={18} strokeWidth={2.2} className="spin-icon" />
            ) : (
              <Sparkles size={18} strokeWidth={2.2} />
            )}
          </button>

          <select
            onClick={(event) => event.stopPropagation()}
            onChange={(event) => onTranslateChange(post, event.target.value)}
            value={isTranslated ? 'translated' : ''}
            className="translate-dropdown"
            disabled={isTranslating}
          >
            <option value="" disabled>
              🌍 {isTranslating ? 'Translating...' : 'Translate'}
            </option>
            {hasTranslation && <option value="original">Original</option>}
            {hasTranslation && isTranslated && (
              <option value="translated" disabled>
                Translated
              </option>
            )}
            <option value="Hindi">Hindi</option>
            <option value="Tamil">Tamil</option>
            <option value="Spanish">Spanish</option>
            <option value="French">French</option>
          </select>
        </div>

        {isTranslating && (
          <div className="ai-loading-box">
            <span className="ai-loader-dot"></span>
            <p>Translating...</p>
          </div>
        )}

        {hasTranslation && !isTranslating && !isTranslated && (
          <div className="translated-box">
            <strong>Translation ready</strong>
            <p>Select the translated language again to view it, or choose Original to go back.</p>
          </div>
        )}

        {isExplaining && (
          <div className="ai-loading-box">
            <span className="ai-loader-dot"></span>
            <p>Simplifying...</p>
          </div>
        )}

        {explanation && !isExplaining && (
          <div className="simple-explanation">
            <strong>Simplify</strong>
            <p>{explanation}</p>
          </div>
        )}
      </div>
    </article>
  );
});

export default function FeedPage() {
  const { topic } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const mountedRef = useRef(true);
  const highlightTimerRef = useRef(null);
  const highlightRemoveTimerRef = useRef(null);
  const requestedCreatorIdsRef = useRef(new Set());
  const toastTimerRef = useRef(null);

  const {
    posts,
    loading,
    loadingMore,
    error,
    nextCursor,
    loadMore,
    likePost,
    savePost,
  } = useFeed();

  const loadMoreRef = useRef(null);
  const [translations, setTranslations] = useState({});
  const [translating, setTranslating] = useState({});
  const [showTranslated, setShowTranslated] = useState({});
  const [selectedTopic, setSelectedTopic] = useState('All');
  const [toast, setToast] = useState('');
  const [simpleExplanations, setSimpleExplanations] = useState({});
  const [explaining, setExplaining] = useState({});
  const [creatorProfiles, setCreatorProfiles] = useState({});
  const [renderLimit, setRenderLimit] = useState(INITIAL_RENDER_LIMIT);
  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
      if (highlightRemoveTimerRef.current) clearTimeout(highlightRemoveTimerRef.current);
    };
  }, []);


  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const targetPostId = params.get('postId');

    if (!targetPostId) return undefined;

    if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    if (highlightRemoveTimerRef.current) clearTimeout(highlightRemoveTimerRef.current);

    highlightTimerRef.current = window.setTimeout(() => {
      if (!mountedRef.current) return;

      const el = document.getElementById(`post-${targetPostId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('highlight-post');

        highlightRemoveTimerRef.current = window.setTimeout(() => {
          el.classList.remove('highlight-post');
        }, 2000);
      }
    }, 450);

    return () => {
      if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
      if (highlightRemoveTimerRef.current) clearTimeout(highlightRemoveTimerRef.current);
    };
  }, [location.search, posts.length]);

  const visiblePosts = useMemo(() => {
    const map = new Map();

    (posts || []).forEach((post) => {
      const postId = getPostId(post);
      if (!postId) return;

      const visibility = String(post.visibility || 'public').toLowerCase();

      const canShow =
        visibility === 'public' ||
        visibility === 'published' ||
        visibility === '' ||
        visibility === 'null';

      if (!canShow) return;

      if (!map.has(postId)) {
        map.set(postId, post);
      }
    });

    return Array.from(map.values()).sort((a, b) => {
      const timeA = Number(a.createdAt || a.updatedAt || a.timestamp || 0);
      const timeB = Number(b.createdAt || b.updatedAt || b.timestamp || 0);

      return timeB - timeA;
    });
  }, [posts]);


  const handleTranslate = useCallback(async (post, lang = 'Hindi') => {
    const postId = getPostId(post);
    if (!postId || translating[postId]) return;

    try {
      setTranslating((prev) => ({ ...prev, [postId]: true }));

      const data = await postApi.translatePost({
        postId,
        title: post.title,
        body: post.body,
        targetLang: lang,
      });
      if (!mountedRef.current) return;

      const translation = data?.translation?.trim();

      if (!translation || translation === 'Translation not available right now.') {
        setTranslations((prev) => {
          const copy = { ...prev };
          delete copy[postId];
          return copy;
        });

        setShowTranslated((prev) => ({
          ...prev,
          [postId]: false,
        }));

        showToast('Translation failed. Check Lambda logs.');
        return;
      }

      setTranslations((prev) => ({
        ...prev,
        [postId]: translation,
      }));

      setShowTranslated((prev) => ({
        ...prev,
        [postId]: true,
      }));
    } catch (err) {
      console.error('Translate failed:', err);

      setTranslations((prev) => {
        const copy = { ...prev };
        delete copy[postId];
        return copy;
      });

      setShowTranslated((prev) => ({
        ...prev,
        [postId]: false,
      }));

      showToast('Translation failed');
    } finally {
      if (mountedRef.current) {
        setTranslating((prev) => ({ ...prev, [postId]: false }));
      }
    }
  }, [translating]);


  const routeFilteredPosts = useMemo(() => {
    if (!topic) return visiblePosts;

    return visiblePosts.filter(
      (post) =>
        normalizeTopic(post.topic) === normalizeTopic(topic) ||
        normalizeTopic(post.category) === normalizeTopic(topic)
    );
  }, [visiblePosts, topic]);

  const topics = useMemo(() => {
    const list = routeFilteredPosts.map((post) => post.topic).filter(Boolean);
    return ['All', ...new Set(list)];
  }, [routeFilteredPosts]);

  const filteredPosts = useMemo(() => {
    if (selectedTopic === 'All') return routeFilteredPosts;

    return routeFilteredPosts.filter(
      (post) => normalizeTopic(post.topic) === normalizeTopic(selectedTopic)
    );
  }, [routeFilteredPosts, selectedTopic]);

  const renderedFeedPosts = useMemo(
    () => filteredPosts.slice(0, renderLimit),
    [filteredPosts, renderLimit]
  );

  const renderedPostIdSet = useMemo(
    () => new Set(renderedFeedPosts.map((post) => getPostId(post)).filter(Boolean)),
    [renderedFeedPosts]
  );

  useEffect(() => {
    setRenderLimit(INITIAL_RENDER_LIMIT);
  }, [topic, selectedTopic]);

  useEffect(() => {
    const pruneByRenderedPosts = (current) => {
      let changed = false;
      const next = {};

      Object.entries(current).forEach(([postId, value]) => {
        if (renderedPostIdSet.has(postId)) {
          next[postId] = value;
        } else {
          changed = true;
        }
      });

      return changed ? next : current;
    };

    setTranslations(pruneByRenderedPosts);
    setShowTranslated(pruneByRenderedPosts);
    setTranslating(pruneByRenderedPosts);
    setSimpleExplanations(pruneByRenderedPosts);
    setExplaining(pruneByRenderedPosts);
  }, [renderedPostIdSet]);

  useEffect(() => {
    if (!loadMoreRef.current) return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting || loadingMore || loading) return;

        if (renderLimit < filteredPosts.length) {
          setRenderLimit((current) => Math.min(current + RENDER_BATCH_SIZE, filteredPosts.length));
          return;
        }

        if (nextCursor) {
          observer.unobserve(entry.target);
          loadMore();
        }
      },
      {
        root: null,
        rootMargin: '900px',
        threshold: 0,
      }
    );

    observer.observe(loadMoreRef.current);

    return () => observer.disconnect();
  }, [nextCursor, loadingMore, loading, loadMore, renderLimit, filteredPosts.length]);

  useEffect(() => {
    const creatorIds = [
      ...new Set(
        renderedFeedPosts
          .map((post) => getPostCreatorId(post))
          .filter(Boolean)
      ),
    ];

    const missingCreatorIds = creatorIds.filter(
      (id) => !creatorProfiles[id] && !requestedCreatorIdsRef.current.has(id)
    );

    if (missingCreatorIds.length === 0) return undefined;

    let cancelled = false;

    missingCreatorIds.forEach((id) => requestedCreatorIdsRef.current.add(id));

    async function loadCreatorProfiles() {
      const loadedProfiles = {};

      await Promise.allSettled(
        missingCreatorIds.map(async (creatorId) => {
          try {
            const profile = await creatorApi.getProfile(creatorId);
            loadedProfiles[creatorId] = profile;
          } catch (err) {
            requestedCreatorIdsRef.current.delete(creatorId);
            console.error('Could not load creator profile:', creatorId, err);
          }
        })
      );

      if (!cancelled && mountedRef.current && Object.keys(loadedProfiles).length > 0) {
        setCreatorProfiles((prev) => ({ ...prev, ...loadedProfiles }));
      }
    }

    loadCreatorProfiles();

    return () => {
      cancelled = true;
    };
  }, [renderedFeedPosts, creatorProfiles]);

  const showToast = useCallback((message, duration = 1200) => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }

    if (!mountedRef.current) return;

    setToast(message);

    toastTimerRef.current = setTimeout(() => {
      setToast('');
      toastTimerRef.current = null;
    }, duration);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
        toastTimerRef.current = null;
      }
    };
  }, []);

  const handleSave = useCallback(async (postId) => {
    if (!postId) return;
    try {
      await savePost(postId);
      showToast('Saved successfully 🔖');
    } catch (err) {
      console.error('Save failed:', err);
      showToast('Save failed');
    }
  }, [savePost, showToast]);

  const handleExplain = useCallback(async (post) => {
    const postId = getPostId(post);
    if (!postId || explaining[postId]) return;

    if (simpleExplanations[postId]) return;

    try {
      setExplaining((prev) => ({ ...prev, [postId]: true }));

      const data = await postApi.explainPost({
        postId,
        title: post.title,
        body: post.body,
      });
      if (!mountedRef.current) return;

      setSimpleExplanations((prev) => ({
        ...prev,
        [postId]: data?.explanation || 'Could not simplify this post.',
      }));
    } catch (err) {
      console.error('Simplify failed:', err);
      showToast('Could not simplify right now');
    } finally {
      if (mountedRef.current) {
        setExplaining((prev) => ({ ...prev, [postId]: false }));
      }
    }
  }, [explaining, simpleExplanations, showToast]);

  const handleLike = useCallback(async (postId) => {
    if (!postId) return;
    try {
      await likePost(postId);
      showToast('Liked ❤️');
    } catch (err) {
      console.error('Like failed:', err);
      showToast('Like failed');
    }
  }, [likePost, showToast]);

  const handleTopicSelect = useCallback((item) => {
    setSelectedTopic(item);
  }, []);

  const handleTopicClick = useCallback(
    (postTopic) => {
      if (postTopic) navigate(`/feed/${normalizeTopic(postTopic)}`);
    },
    [navigate]
  );

  const handleAiDetails = useCallback(
    (post, creatorName) => {
      const postId = getPostId(post);
      if (!postId) return;

      navigate(`/post-ai/${postId}`, {
        state: {
          post: {
            ...post,
            id: postId,
            reelId: postId,
          },
          creatorName,
        },
      });
    },
    [navigate]
  );

  const handleComments = useCallback(
    (postId) => {
      if (postId) navigate(`/comments/${postId}`);
    },
    [navigate]
  );

  const handleOpenPost = useCallback(
    (post, creatorName) => {
      const postId = getPostId(post);
      if (!postId) return;

      navigate(`/post-ai/${postId}`, {
        state: {
          post: {
            ...post,
            id: postId,
            reelId: postId,
          },
          creatorName,
        },
      });
    },
    [navigate]
  );

  const handleTranslateChange = useCallback(
    (post, value) => {
      const postId = getPostId(post);

      if (value === 'original') {
        setShowTranslated((prev) => ({
          ...prev,
          [postId]: false,
        }));
        return;
      }

      handleTranslate(post, value);
    },
    [handleTranslate]
  );

  const renderedTopics = useMemo(
    () => topics.map((item) => (
      <TopicPill
        key={item}
        item={item}
        active={selectedTopic === item}
        onSelect={handleTopicSelect}
      />
    )),
    [handleTopicSelect, selectedTopic, topics]
  );

  const renderedPosts = useMemo(
    () => renderedFeedPosts.map((post, index) => {
      const postId = getPostId(post);
      const creatorId = getPostCreatorId(post);
      const creatorProfile = creatorId ? creatorProfiles[creatorId] : null;
      const creatorName = getDisplayUsername(post, creatorProfile);

      return (
        <FeedPostCard
          key={`${postId}-${post.createdAt || post.updatedAt || ''}`}
          post={post}
          index={index}
          postId={postId}
          creatorId={creatorId}
          creatorName={creatorName}
          translatedText={translations[postId]}
          isTranslated={Boolean(showTranslated[postId])}
          isTranslating={Boolean(translating[postId])}
          isExplaining={Boolean(explaining[postId])}
          explanation={simpleExplanations[postId]}
          onTopicClick={handleTopicClick}
          onSave={handleSave}
          onAiDetails={handleAiDetails}
          onOpenPost={handleOpenPost}
          onComments={handleComments}
          onExplain={handleExplain}
          onTranslateChange={handleTranslateChange}
        />
      );
    }),
    [
      creatorProfiles,
      explaining,
      renderedFeedPosts,
      handleAiDetails,
      handleOpenPost,
      handleComments,
      handleExplain,
      handleSave,
      handleTopicClick,
      handleTranslateChange,
      showTranslated,
      simpleExplanations,
      translating,
      translations,
    ]
  );

  return (
    <main className="snap-feed-page">
      <button
        type="button"
        className="floating-create-btn"
        onClick={() => navigate('/create')}
      >
        +
      </button>

      {toast && <div className="success-toast">{toast}</div>}

      <aside className="topic-rail">
        {renderedTopics}
      </aside>

      {loading && filteredPosts.length === 0 && <FeedSkeleton />}

      {error && <p className="feed-status error">{error}</p>}

      {!loading && !error && filteredPosts.length === 0 && (
        <p className="feed-status">No posts found for this topic.</p>
      )}

      <section className="snap-feed">
        {renderedPosts}
      </section>

      <div ref={loadMoreRef} className="feed-load-trigger" />

      {(loadingMore || renderLimit < filteredPosts.length) && (
        <p className="feed-status">Loading more posts...</p>
      )}
    </main>
  );
}