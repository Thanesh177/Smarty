import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import useFeed from '../hooks/useFeed';
import { postApi } from '../api/client';
import './FeedPage.css';

const normalizeTopic = (value) =>
  String(value || '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-');

export default function FeedPage() {
  const { topic } = useParams();
  const { posts, loading, error, likePost, savePost } = useFeed();
const navigate = useNavigate();
  const [selectedTopic, setSelectedTopic] = useState('All');
  const [commentText, setCommentText] = useState({});
  const [commentsOpen, setCommentsOpen] = useState({});
  const [comments, setComments] = useState({});
  const [loadingComments, setLoadingComments] = useState({});
  const [toast, setToast] = useState('');

const visiblePosts = useMemo(() => {
  return (posts || [])
    .filter((post) => {
      const visibility = String(post.visibility || 'public').toLowerCase();

      return (
        visibility === 'public' ||
        visibility === 'published' ||
        visibility === '' ||
        visibility === 'null'
      );
    })
    .sort((a, b) => {
      const timeA = Number(a.createdAt || a.updatedAt || a.timestamp || 0);
      const timeB = Number(b.createdAt || b.updatedAt || b.timestamp || 0);

      return timeB - timeA;
    });
}, [posts]);

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

  const showToast = (message) => {
    setToast(message);
    setTimeout(() => setToast(''), 1800);
  };

  const loadComments = async (postId) => {
    setLoadingComments((prev) => ({ ...prev, [postId]: true }));

    try {
      const data = await postApi.getComments(postId);

      setComments((prev) => ({
        ...prev,
        [postId]: Array.isArray(data) ? data : [],
      }));
    } catch (err) {
      console.error('Load comments failed:', err);
      showToast('Failed to load comments');
    } finally {
      setLoadingComments((prev) => ({ ...prev, [postId]: false }));
    }
  };

  const toggleComments = async (postId) => {
    const isOpen = commentsOpen[postId];

    if (isOpen) {
      setCommentsOpen((prev) => ({ ...prev, [postId]: false }));
      return;
    }

    setCommentsOpen((prev) => ({ ...prev, [postId]: true }));

    if (!comments[postId]) {
      await loadComments(postId);
    }
  };

  const submitComment = async (postId) => {
    const text = commentText[postId]?.trim();
    if (!text) return;

    try {
      await postApi.addComment({
        reelId: postId,
        id: postId,
        postId,
        comment: text,
        text,
        body: text,
      });

      const newComment = {
        id: crypto.randomUUID(),
        comment: text,
        text,
        body: text,
        author: 'You',
      };

      setComments((prev) => ({
        ...prev,
        [postId]: [newComment, ...(prev[postId] || [])],
      }));

      setCommentText((prev) => ({ ...prev, [postId]: '' }));
      setCommentsOpen((prev) => ({ ...prev, [postId]: true }));
      showToast('Comment posted 💬');
    } catch (err) {
      console.error('Comment failed:', err);
      showToast('Comment failed');
    }
  };

  const handleSave = async (postId) => {
    try {
      await savePost(postId);
      showToast('Saved successfully 🔖');
    } catch (err) {
      console.error('Save failed:', err);
      showToast('Save failed');
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

      {loading && <p className="feed-status">Loading feed...</p>}
      {error && <p className="feed-status error">{error}</p>}

      {!loading && !error && filteredPosts.length === 0 && (
        <p className="feed-status">No posts found for this topic.</p>
      )}

      <section className="snap-feed">
        {filteredPosts.map((post) => {
const postId = post.reelId || post.id;
          const creatorId = post.authorId || post.userId || post.creatorId;

          return (
<article
  className={`snap-post ${!post.imageUrl && !post.videoUrl ? 'no-media' : ''}`}
  key={postId}
>              {(post.videoUrl || post.imageUrl) && (
                <div className="mini-media">
                  {post.videoUrl ? (
                    <video src={post.videoUrl} controls playsInline />
                  ) : (
                    <img src={post.imageUrl} alt={post.title || 'Post media'} />
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
                      @{post.author || post.creatorName || 'Creator'}
                    </Link>
                  </div>
                )}

                <h1>{post.title}</h1>
                <p>{post.body}</p>

                <div className="post-actions">
                  <button type="button" onClick={() => handleLike(postId)}>
                    ❤️ {post.likes ?? 0}
                  </button>

                  <button type="button" onClick={() => handleSave(postId)}>
                    🔖 Save
                  </button>

                  <button
  type="button"
  onClick={() => navigate(`/comments/${postId}`)}
>
  💬 Comments
</button>
                </div>

                {commentsOpen[postId] && (
                  <div className="comment-wrap">
                    {loadingComments[postId] && (
                      <p className="comment-loading">Loading...</p>
                    )}

                    {comments[postId]?.map((item, index) => (
                      <div className="comment-item" key={item.id || item.commentId || index}>
                        <strong>{item.author || item.user || item.username || 'User'}</strong>
                        <p>{item.comment || item.text || item.body}</p>
                      </div>
                    ))}

                    <div className="comment-box">
                      <input
                        placeholder="Add a comment..."
                        value={commentText[postId] || ''}
                        onChange={(e) =>
                          setCommentText((prev) => ({
                            ...prev,
                            [postId]: e.target.value,
                          }))
                        }
                      />

                      <button type="button" onClick={() => submitComment(postId)}>
                        Post
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </article>
          );
        })}
      </section>
    </main>
  );
}