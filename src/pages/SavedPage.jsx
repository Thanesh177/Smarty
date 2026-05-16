import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { postApi } from '../api/client';
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
const SavedCard = memo(function SavedCard({
  post,
  onOpen,
  onLike,
  onSave,
}) {
  const postId = post.id || post.reelId;
  const image = getPostImage(post);

  return (
    <article className="saved-card">
      <button
        className="saved-card-media"
        type="button"
        onClick={() => onOpen(postId)}
      >
        {post.videoUrl ? (
          <video
            src={post.videoUrl}
            muted
            playsInline
            preload="none"
          />
        ) : image ? (
          <img
            src={image}
            alt={post.title || 'Saved post'}
            loading="lazy"
            decoding="async"
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
          onClick={() => onOpen(postId)}
        >
          {post.title || 'Untitled post'}
        </button>

        <p>{post.body || post.description || 'No description available.'}</p>

        <div className="saved-card-actions">
          <button type="button" onClick={() => onLike(postId)}>
            ❤️ {post.likes || 0}
          </button>

          <button type="button" onClick={() => onSave(postId)}>
            ✅ Saved
          </button>

          <button type="button" onClick={() => onOpen(postId)}>
            Open →
          </button>
        </div>
      </div>
    </article>
  );
});
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

        const hasToken = Boolean(
          localStorage.getItem('eduscroll_access_token') ||
          localStorage.getItem('accessToken') ||
          localStorage.getItem('idToken') ||
          sessionStorage.getItem('eduscroll_access_token')
        );

        if (!hasToken) {
          setError('Please log in to view saved posts.');
          setLoading(false);
          return;
        }

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

        const status = err?.response?.status;

        if (!mountedRef.current) return;

        if (status === 401 || status === 403) {
          setError('Please log in again to view saved posts.');
          return;
        }

        setError('Failed to load saved content.');
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
    if (!Array.isArray(posts) || posts.length === 0) {
      return ['All'];
    }

    const uniqueTopics = new Set();

    for (const post of posts) {
      if (!post?.topic) continue;
      uniqueTopics.add(post.topic.trim());
    }

    return ['All', ...Array.from(uniqueTopics).sort((a, b) => a.localeCompare(b))];
  }, [posts]);

  const filteredPosts = useMemo(() => {
    if (!Array.isArray(posts) || posts.length === 0) return [];

    const normalizedQuery = query.trim().toLowerCase();

    return posts.filter((post) => {
      const matchesTopic = activeTopic === 'All' || post.topic === activeTopic;
      if (!matchesTopic) return false;

      if (!normalizedQuery) return true;

      const text = `${post.title || ''} ${post.body || ''} ${post.description || ''} ${post.topic || ''}`.toLowerCase();

      return text.includes(normalizedQuery);
    });
  }, [posts, activeTopic, query]);

  const handleLike = useCallback(async (postId) => {
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
  }, []);

  const handleSave = useCallback(async (postId) => {
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
  }, []);

  const handleOpen = useCallback(
    (postId) => {
      navigate(`/reel/${postId}`);
    },
    [navigate]
  );

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
            {Array.from({ length: 4 }).map((_, index) => (
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
            {filteredPosts.map((post) => (
              <SavedCard
                key={post.id || post.reelId}
                post={post}
                onOpen={handleOpen}
                onLike={handleLike}
                onSave={handleSave}
              />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}