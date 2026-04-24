import { useMemo, useState } from 'react';
import useFeed from '../hooks/useFeed';
import { postApi } from '../api/client';
import './FeedPage.css';

export default function FeedPage() {
  const { posts, loading, error, likePost, savePost } = useFeed();

  const [selectedTopic, setSelectedTopic] = useState('All');
  const [commentText, setCommentText] = useState({});
  const [commentsOpen, setCommentsOpen] = useState({});

  const topics = useMemo(() => {
    const list = posts.map((post) => post.topic).filter(Boolean);
    return ['All', ...new Set(list)];
  }, [posts]);

  const filteredPosts = useMemo(() => {
    if (selectedTopic === 'All') return posts;
    return posts.filter((post) => post.topic === selectedTopic);
  }, [posts, selectedTopic]);

  const submitComment = async (postId) => {
    const text = commentText[postId]?.trim();
    if (!text) return;

    await postApi.addComment({
      reelId: postId,
      comment: text,
      text,
    });

    setCommentText((prev) => ({ ...prev, [postId]: '' }));
    setCommentsOpen((prev) => ({ ...prev, [postId]: true }));
  };

  return (
    <main className="snap-feed-page">
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
                <h1>{post.title}</h1>
                <p>{post.body}</p>

                <div className="post-actions">
                  <button type="button" onClick={() => likePost(postId)}>
                    ❤️ {post.likes ?? 0}
                  </button>

                  <button type="button" onClick={() => savePost(postId)}>
                    🔖 Save
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setCommentsOpen((prev) => ({
                        ...prev,
                        [postId]: !prev[postId],
                      }))
                    }
                  >
                    💬 Comment
                  </button>
                </div>

                {commentsOpen[postId] && (
                  <div className="comment-box">
                    <input
                      placeholder="Add a thoughtful comment..."
                      value={commentText[postId] || ''}
                      onChange={(event) =>
                        setCommentText((prev) => ({
                          ...prev,
                          [postId]: event.target.value,
                        }))
                      }
                    />

                    <button type="button" onClick={() => submitComment(postId)}>
                      Post
                    </button>
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