import { useMemo, useState } from 'react';
// 1. Import Link from react-router-dom
import { Link } from 'react-router-dom'; 
import useFeed from '../hooks/useFeed';
import { postApi } from '../api/client';
import './FeedPage.css';

export default function FeedPage() {
  const { posts, loading, error, likePost, savePost } = useFeed();

  const [selectedTopic, setSelectedTopic] = useState('All');
  const [commentText, setCommentText] = useState({});
  const [commentsOpen, setCommentsOpen] = useState({});
  const [comments, setComments] = useState({});
  const [loadingComments, setLoadingComments] = useState({});
  const [toast, setToast] = useState('');

  // ... (useMemo and handlers remain the same)
  const topics = useMemo(() => {
    const list = posts.map((post) => post.topic).filter(Boolean);
    return ['All', ...new Set(list)];
  }, [posts]);

  const filteredPosts = useMemo(() => {
    if (selectedTopic === 'All') return posts;
    return posts.filter((post) => post.topic === selectedTopic);
  }, [posts, selectedTopic]);

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
      {toast && <div className="success-toast">{toast}</div>}

      <aside className="topic-rail">
        {topics.map((topic) => (
          <button
            key={topic}
            type="button"
            className={selectedTopic === topic ? 'topic-pill active' : 'topic-pill'}
            onClick={() => setSelectedTopic(topic)}
            title={topic}
          >
            <span>{topic[0]}</span>
            <strong>{topic}</strong>
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
          const postId = post.id || post.reelId;

          return (
            <article className="snap-post" key={postId}>
              <div className="mini-media">
                {post.videoUrl ? (
                  <video src={post.videoUrl} controls playsInline />
                ) : post.imageUrl ? (
                  <img src={post.imageUrl} alt={post.title || 'Post media'} />
                ) : (
                  <div className="media-placeholder">{post.topic?.[0] || 'S'}</div>
                )}
              </div>

              <div className="post-content">
                <span className="post-topic">{post.topic || 'Smarty'}</span>

                {/* 2. Added Creator Link here */}
                <div className="post-author">
                  <Link to={`/creator/${post.authorId}`} className="creator-link">
                    @{post.author || 'Creator'}
                  </Link>
                </div>

                <h1>{post.title}</h1>
                <p>{post.body}</p>

                <div className="post-actions">
                  <button type="button" onClick={() => handleLike(postId)}>
                    ❤️ {post.likes ?? 0}
                  </button>
                  <button type="button" onClick={() => handleSave(postId)}>
                    🔖 Save
                  </button>
                  <button type="button" onClick={() => toggleComments(postId)}>
                    💬 Comments
                  </button>
                </div>

                {/* ... (Comments section remains the same) */}
                {commentsOpen[postId] && (
                  <div className="comment-wrap">
                    {loadingComments[postId] && <p className="comment-loading">Loading...</p>}
                    {comments[postId]?.map((item, index) => (
                      <div className="comment-item" key={item.id || index}>
                        <strong>{item.author || item.user || 'User'}</strong>
                        <p>{item.comment || item.text || item.body}</p>
                      </div>
                    ))}
                    <div className="comment-box">
                      <input
                        placeholder="Add a comment..."
                        value={commentText[postId] || ''}
                        onChange={(e) => setCommentText(prev => ({...prev, [postId]: e.target.value}))}
                      />
                      <button onClick={() => submitComment(postId)}>Post</button>
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