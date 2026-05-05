import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { userApi, postApi } from '../api/client';
import EmptyState from '../components/EmptyState';
import './SavedPage.css';
function getPostImage(post) {
  return (
    post?.imageUrl ||
    post?.photoUrl ||
    post?.thumbnail ||
    post?.coverImage ||
    post?.image ||
    post?.mediaUrl ||
    ''
  );
}
export default function SavedPage() {
  const navigate = useNavigate();

  const mountedRef = useRef(true);
  const toastTimerRef = useRef(null);

  const [posts, setPosts] = useState([]);
  const [query, setQuery] = useState('');
  const [activeTopic, setActiveTopic] = useState('All');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  const showToast = (message) => {
    if (!mountedRef.current) return;

    setToast(message);

    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }

    toastTimerRef.current = window.setTimeout(() => {
      if (mountedRef.current) setToast('');
    }, 1600);
  };

  useEffect(() => {
    mountedRef.current = true;

    async function loadSavedPosts() {
      try {
        setLoading(true);
        setError('');

        const data = await postApi.getSavedReels();
        if (!mountedRef.current) return;

        const savedPosts = Array.isArray(data?.posts)
          ? data.posts
          : Array.isArray(data?.reels)
            ? data.reels
            : Array.isArray(data)
              ? data
              : [];

        setPosts(savedPosts);
      } catch (err) {
        console.error('Saved reels error:', err);
        if (mountedRef.current) setError('Failed to load saved content.');
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    }

    loadSavedPosts();

    return () => {
      mountedRef.current = false;
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  const topics = useMemo(() => {
    const list = posts.map((post) => post.topic).filter(Boolean);
    return ['All', ...new Set(list)];
  }, [posts]);

  const filteredPosts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return posts.filter((post) => {
      const matchesTopic = activeTopic === 'All' || post.topic === activeTopic;
      if (!matchesTopic) return false;

      if (!normalizedQuery) return true;

      const text = `${post.title || ''} ${post.body || ''} ${post.description || ''} ${post.topic || ''}`.toLowerCase();
      return text.includes(normalizedQuery);
    });
  }, [posts, activeTopic, query]);

  const handleLike = async (postId) => {
    try {
      await postApi.toggleLike(postId);

      if (!mountedRef.current) return;

      setPosts((prev) =>
        prev.map((post) => {
          if ((post.id || post.reelId) !== postId) return post;

          const wasLiked = Boolean(post.liked);
          return {
            ...post,
            likes: Math.max(0, Number(post.likes || 0) + (wasLiked ? -1 : 1)),
            liked: !wasLiked,
          };
        })
      );

      showToast('Liked ❤️');
    } catch (err) {
      console.error('Like failed:', err);
      showToast('Like failed');
    }
  };

  const handleSave = async (postId) => {
    try {
      await postApi.toggleSave(postId);
      if (!mountedRef.current) return;

      setPosts((prev) =>
        prev.filter((post) => (post.id || post.reelId) !== postId)
      );

      showToast('Removed from saved');
    } catch (err) {
      console.error('Save failed:', err);
      showToast('Save failed');
    }
  };

  return (
    <main className="saved-page">
      {toast && <div className="saved-toast">{toast}</div>}

      <section className="saved-hero">
        <div className="saved-hero-copy">
          <span className="saved-pill">Your library</span>
          <h1>Saved knowledge, ready when you are.</h1>
          <p>Revisit the educational reels and ideas you bookmarked while scrolling.</p>
        </div>

        <div className="saved-summary">
          <strong>{posts.length}</strong>
          <span>saved items</span>
        </div>
      </section>

      <section className="saved-toolbar">
        <input
          placeholder="Search saved posts..."
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />

        <div className="saved-topics">
          {topics.map((topic) => (
            <button
              key={topic}
              type="button"
              className={activeTopic === topic ? 'active' : ''}
              onClick={() => setActiveTopic(topic)}
            >
              {topic}
            </button>
          ))}
        </div>
      </section>

      <section className="saved-content">
        <div className="saved-heading-row">
          <div>
            <h2>Saved Content</h2>
            <p>
              {filteredPosts.length} item{filteredPosts.length === 1 ? '' : 's'} found
            </p>
          </div>
        </div>

        {loading ? (
          <div className="saved-skeleton-grid">
            {Array.from({ length: 6 }).map((_, index) => (
              <div className="saved-skeleton" key={index} />
            ))}
          </div>
        ) : error ? (
          <p className="status error">{error}</p>
        ) : posts.length === 0 ? (
          <EmptyState
            title="No saved posts yet"
            description="When you bookmark educational posts, they will appear here."
          />
        ) : filteredPosts.length === 0 ? (
          <EmptyState
            title="No matching saved posts"
            description="Try a different search term or topic."
          />
        ) : (
          <div className="saved-grid">
            {filteredPosts.map((post) => {
              const postId = post.id || post.reelId;

              return (
                <article className="saved-card" key={postId}>
                  <button
                    className="saved-card-media"
                    type="button"
                    onClick={() => navigate(`/reel/${postId}`)}
                  >
                    {post.videoUrl ? (
                      <video src={post.videoUrl} muted playsInline preload="metadata" />
                    ) : getPostImage(post) ? (
                      <img
                        src={getPostImage(post)}
                        alt={post.title || 'Saved post'}
                        loading="eager"
                        decoding="async"
                        fetchPriority="high"
                      />
                    ) : (
                      <div className="saved-placeholder">{post.topic?.[0] || 'S'}</div>
                    )}
                  </button>

                  <div className="saved-card-body">
                    <span className="saved-topic">{post.topic || 'Smarty'}</span>

                    <button
                      className="saved-title-btn"
                      type="button"
                      onClick={() => navigate(`/reel/${postId}`)}
                    >
                      {post.title || 'Untitled post'}
                    </button>

                    <p>{post.body || post.description || 'No description available.'}</p>

                    <div className="saved-card-actions">
                      <button type="button" onClick={() => handleLike(postId)}>
                        ❤️ {post.likes || 0}
                      </button>

                      <button type="button" onClick={() => handleSave(postId)}>
                        ✅ Saved
                      </button>

                      <button type="button" onClick={() => navigate(`/reel/${postId}`)}>
                        Open →
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}