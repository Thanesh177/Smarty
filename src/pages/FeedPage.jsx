import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { postApi, creatorApi } from '../api/client';
import FeedSkeleton from '../components/FeedSkeleton';
import useFeed from '../hooks/useFeed';
import './FeedPage.css';

const normalizeTopic = (value) =>
  String(value || '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-');

const getPostCreatorId = (post) =>
  post.authorId ||
  post.creatorId ||
  post.userId ||
  post.ownerId ||
  post.createdBy ||
  post.authorUserId ||
  post.creatorUserId ||
  post.author?.userId ||
  post.author?.id ||
  post.creator?.userId ||
  post.creator?.id ||
  post.user?.userId ||
  post.user?.id ||
  '';

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
  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
      if (highlightRemoveTimerRef.current) clearTimeout(highlightRemoveTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!loadMoreRef.current || !nextCursor) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !loadingMore && !loading && nextCursor) {
          observer.unobserve(entry.target);
          loadMore();
        }
      },
      {
        root: null,
        rootMargin: '300px',
        threshold: 0,
      }
    );

    observer.observe(loadMoreRef.current);

    return () => observer.disconnect();
  }, [nextCursor, loadingMore, loading, loadMore]);

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
      const postId = post.reelId || post.id;
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

  useEffect(() => {
    const creatorIds = [
      ...new Set(
        visiblePosts
          .slice(0, 30)
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
  }, [visiblePosts, creatorProfiles]);

  const handleTranslate = async (post, lang = 'Hindi') => {
    const postId = post.reelId || post.id;
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
  };


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

  const showToast = (message, duration = 1200) => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }

    if (!mountedRef.current) return;

    setToast(message);

    toastTimerRef.current = setTimeout(() => {
      setToast('');
      toastTimerRef.current = null;
    }, duration);
  };

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
        toastTimerRef.current = null;
      }
    };
  }, []);

  const handleSave = async (postId) => {
    if (!postId) return;
    try {
      await savePost(postId);
      showToast('Saved successfully 🔖');
    } catch (err) {
      console.error('Save failed:', err);
      showToast('Save failed');
    }
  };
  const handleExplain = async (post) => {
    const postId = post.reelId || post.id;
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
        [postId]: data.explanation || 'Could not simplify this post.',
      }));
    } catch (err) {
      console.error('Explain failed:', err);
      showToast('Could not explain right now');
    } finally {
      if (mountedRef.current) {
        setExplaining((prev) => ({ ...prev, [postId]: false }));
      }
    }
  };
  const handleLike = async (postId) => {
    if (!postId) return;
    try {
      await likePost(postId);
      showToast('Liked ❤️');
    } catch (err) {
      console.error('Like failed:', err);
      showToast('Like failed');
    }
  };

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
        {topics.map((item) => (
          <button
            key={item}
            type="button"
            className={selectedTopic === item ? 'topic-pill active' : 'topic-pill'}
            onClick={() => setSelectedTopic(item)}
            title={item}
          >
            <span>{item[0]}</span>
            <strong>{item}</strong>
          </button>
        ))}
      </aside>

      {loading && filteredPosts.length === 0 && <FeedSkeleton />}

      {error && <p className="feed-status error">{error}</p>}

      {!loading && !error && filteredPosts.length === 0 && (
        <p className="feed-status">No posts found for this topic.</p>
      )}

      <section className="snap-feed">
        {filteredPosts.map((post, index) => {
          const postId = post.reelId || post.id;
          const creatorId = getPostCreatorId(post);
          const creatorProfile = creatorId ? creatorProfiles[creatorId] : null;
          const creatorName = getDisplayUsername(post, creatorProfile);

          return (
            <article
              id={`post-${postId}`}
              className={`snap-post ${
                !post.imageUrl && !post.videoUrl ? 'no-media' : ''
              }`}
              key={`${postId}-${post.createdAt || post.updatedAt || ''}`}
            >
              {(post.videoUrl || post.imageUrl) && (
                <div className="mini-media">
                  {post.videoUrl ? (
                    <video
                      src={post.videoUrl}
                      controls
                      playsInline
                      preload={index < 2 ? 'auto' : 'metadata'}
                    />
                  ) : (
                    <img
                      src={post.imageUrl}
                      alt={post.title || 'Post media'}
                      loading={index < 3 ? 'eager' : 'lazy'}
                      decoding="async"
                      fetchpriority={index < 3 ? 'high' : 'auto'}
                      className="feed-image"
                    />
                  )}
                </div>
              )}

              <div className="post-content">
                <button
                  type="button"
                  className="post-topic clickable-topic"
                  onClick={() => post.topic && navigate(`/feed/${normalizeTopic(post.topic)}`)}
                >
                  {post.topic || 'Smarty'}
                </button>

                <div className="post-author">
                  {creatorId ? (
                    <Link to={`/creator/${creatorId}`} className="creator-link">
                      {creatorName}
                    </Link>
                  ) : (
                    <span className="creator-link creator-link-disabled">{creatorName}</span>
                  )}
                </div>

                <h1>{post.title}</h1>
                <p>
                  {showTranslated[postId] && translations[postId]
                    ? translations[postId]
                    : post.body}
                </p>

                <div className="post-actions">

                  {/* <button type="button" onClick={() => handleLike(postId)}>
                    ❤️ {post.likes ?? 0}
                  </button> */}

                  <button type="button" disabled={!postId} onClick={() => handleSave(postId)}>
                    🔖 Save
                  </button>

                  <button
                    type="button"
                    disabled={!postId}
                    onClick={() => postId && navigate(`/comments/${postId}`)}
                  >
                    💬 Comments
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExplain(post)}
                    disabled={explaining[postId]}
                  >
                    {explaining[postId] ? 'Simplifying...' : 'Simplify'}
                  </button>

                  <select
                    onChange={(e) => {
                      const value = e.target.value;

                      if (value === 'original') {
                        setShowTranslated((prev) => ({
                          ...prev,
                          [postId]: false,
                        }));
                        return;
                      }

                      handleTranslate(post, value);
                    }}
                    value={showTranslated[postId] ? 'translated' : ''}
                    className="translate-dropdown"
                    disabled={translating[postId]}
                  >
                    <option value="" disabled>
                      🌍 {translating[postId] ? 'Translating...' : 'Translate'}
                    </option>
                    {translations[postId] && (
                      <option value="original">Original</option>
                    )}
                    {translations[postId] && showTranslated[postId] && (
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
                {translating[postId] && (
                  <div className="ai-loading-box">
                    <span className="ai-loader-dot"></span>
                    <p>Translating...</p>
                  </div>
                )}

                {translations[postId] && !translating[postId] && !showTranslated[postId] && (
                  <div className="translated-box">
                    <strong>Translation ready</strong>
                    <p>Select the translated language again to view it, or choose Original to go back.</p>
                  </div>
                )}

                {explaining[postId] && (
                  <div className="ai-loading-box">
                    <span className="ai-loader-dot"></span>
                    <p>Simplifying...</p>
                  </div>
                )}

                {simpleExplanations[postId] && !explaining[postId] && (
                  <div className="simple-explanation">
                    <strong>Simplify</strong>
                    <p>{simpleExplanations[postId]}</p>
                  </div>
                )}
              </div>
            </article>
          );
        })}
      </section>

      <div ref={loadMoreRef} className="feed-load-trigger" />

      {loadingMore && <p className="feed-status">Loading more posts...</p>}
    </main>
  );
}