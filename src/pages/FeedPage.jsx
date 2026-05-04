import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { postApi, creatorApi } from '../api/client';
import FeedSkeleton from '../components/FeedSkeleton';
import useFeed from '../hooks/useFeed';
import './FeedPage.css';
import { useLocation } from "react-router-dom";

const normalizeTopic = (value) =>
  String(value || '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-');

const getDisplayUsername = (post, creatorProfile = null) => {
  const profileName =
    creatorProfile?.username ||
    creatorProfile?.userName ||
    creatorProfile?.displayName ||
    creatorProfile?.name;

  if (profileName && !String(profileName).includes('@')) {
    return String(profileName).trim();
  }

  const postName =
    post.username ||
    post.userName ||
    post.displayName ||
    post.name ||
    post.creatorName ||
    post.authorName;

  if (postName && !String(postName).includes('@')) {
    return String(postName).trim();
  }

  return 'Creator';
};

    

export default function FeedPage() {
  const { topic } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

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
    const targetPostId = params.get("postId");

    if (!targetPostId) return;

    setTimeout(() => {
      const el = document.getElementById(`post-${targetPostId}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.classList.add("highlight-post");

        setTimeout(() => {
          el.classList.remove("highlight-post");
        }, 2000);
      }
    }, 600);
  }, [location, posts]);

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
          .map((post) => post.authorId || post.userId || post.creatorId)
          .filter(Boolean)
      ),
    ];

    const missingCreatorIds = creatorIds.filter((id) => !creatorProfiles[id]);

    if (missingCreatorIds.length === 0) return;

    let cancelled = false;

    async function loadCreatorProfiles() {
      const loadedProfiles = {};

      await Promise.all(
        missingCreatorIds.map(async (creatorId) => {
          try {
            const profile = await creatorApi.getProfile(creatorId);
            loadedProfiles[creatorId] = profile;
          } catch (err) {
            console.error('Could not load creator profile:', creatorId, err);
          }
        })
      );

      if (!cancelled && Object.keys(loadedProfiles).length > 0) {
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

  try {
    setTranslating((prev) => ({ ...prev, [postId]: true }));

    const data = await postApi.translatePost({
      postId,
      title: post.title,
      body: post.body,
      targetLang: lang,
    });

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
    setTranslating((prev) => ({ ...prev, [postId]: false }));
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

  const toastTimerRef = useRef(null);

  const showToast = (message, duration = 1200) => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }

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
      }
    };
  }, []);

  const handleSave = async (postId) => {
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

  if (simpleExplanations[postId]) return;

  try {
    setExplaining((prev) => ({ ...prev, [postId]: true }));

    const data = await postApi.explainPost({
        postId,
      title: post.title,
      body: post.body,
    });

    setSimpleExplanations((prev) => ({
      ...prev,
      [postId]: data.explanation || 'Could not simplify this post.',
    }));
  } catch (err) {
    console.error('Explain failed:', err);
    showToast('Could not explain right now');
  } finally {
    setExplaining((prev) => ({ ...prev, [postId]: false }));
  }
};
  const handleLike = async (postId) => {
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
        {filteredPosts.map((post) => {
          const postId = post.reelId || post.id;
          const creatorId = post.authorId || post.userId || post.creatorId;
          const creatorProfile = creatorId ? creatorProfiles[creatorId] : null;

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
                      preload="metadata"
                    />
                  ) : (
                    <img
                      src={post.imageUrl}
                      alt={post.title || 'Post media'}
                      loading="lazy"
                      decoding="async"
                      className="feed-image"
                    />
                  )}
                </div>
              )}

              <div className="post-content">
                <button
                  type="button"
                  className="post-topic clickable-topic"
                  onClick={() => navigate(`/feed/${normalizeTopic(post.topic)}`)}
                >
                  {post.topic || 'Smarty'}
                </button>

                {creatorId && (
                  <div className="post-author">
                    <Link to={`/creator/${creatorId}`} className="creator-link">
                      @{getDisplayUsername(post, creatorProfile)}
                    </Link>
                  </div>
                )}

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

                  <button type="button" onClick={() => handleSave(postId)}>
                    🔖 Save
                  </button>

                  <button
                    type="button"
                    onClick={() => navigate(`/comments/${postId}`)}
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