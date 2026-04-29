import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { postApi } from '../api/client';
import './ReelDetailPage.css';
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
export default function ReelDetailPage() {
  const { reelId } = useParams();
  const navigate = useNavigate();

  const [post, setPost] = useState(null);
  const [comments, setComments] = useState([]);
  const [comment, setComment] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadPost() {
      try {
        const [postData, commentsData] = await Promise.all([
          postApi.getSingleReel(reelId),
          postApi.getComments(reelId),
        ]);

        setPost(postData);
        setComments(commentsData || []);
      } catch (err) {
        console.error(err);
        setStatus('Failed to load post.');
      } finally {
        setLoading(false);
      }
    }

    loadPost();
  }, [reelId]);

const handleLike = async () => {

  try {

    await postApi.toggleLike(reelId);

    setPost((prev) => ({

      ...prev,

      likes: Number(prev?.likes || 0) + 1,

      liked: true,

    }));

  } catch (err) {

    console.error('Like failed:', err);

    setStatus('Like failed.');

  }

};

const handleShare = async () => {
  const currentLink = window.location.href;

  if (navigator.share) {
    try {
      await navigator.share({
        title: post?.title || 'Smarty Post',
        text: post?.title || '',
        url: currentLink,
      });
      return;
    } catch {}
  }

  await navigator.clipboard.writeText(currentLink);
  setStatus('Link copied to clipboard.');
};

const handleSave = async () => {

  try {

    await postApi.toggleSave(reelId);

    setPost((prev) => ({

      ...prev,

      saved: true,

    }));

    setStatus('Saved successfully.');

  } catch (err) {

    console.error('Save failed:', err);

    setStatus('Save failed.');

  }

};

  const handleComment = async (e) => {
    e.preventDefault();

    if (!comment.trim()) return;

    await postApi.addComment({
      reelId,
      comment: comment.trim(),
      text: comment.trim(),
    });

    setComments((prev) => [
      {
        id: crypto.randomUUID(),
        author: 'You',
        comment: comment.trim(),
        createdAt: Date.now(),
      },
      ...prev,
    ]);

    setComment('');
  };

  if (loading) {
    return <p className="reel-status">Loading post...</p>;
  }

  if (!post) {
    return <p className="reel-status">Post not found.</p>;
  }

  return (
    <main className="reel-detail-page">
      <button className="reel-back-btn" onClick={() => navigate(-1)}>
        ← Back
      </button>

      <section className="reel-detail-layout">
        <div className="reel-media-panel">
  {post.videoUrl ? (
    <video src={post.videoUrl} controls playsInline />
  ) : getPostImage(post) ? (
    <img src={getPostImage(post)} alt={post.title || 'Post'} />
  ) : (
    <div className="reel-media-placeholder">
      {post.topic?.[0] || 'S'}
    </div>
  )}
</div>

        <div className="reel-content-panel">
          <span className="reel-topic">{post.topic || 'Smarty'}</span>

          <h1>{post.title}</h1>

          <div className="reel-author-row">
            <Link to={`/creator/${post.authorId || post.userId || post.creatorId}`}>
              {post.author || post.creatorName || 'Creator'}
            </Link>
          </div>

          <p className="reel-body">{post.body}</p>

          <div className="reel-actions">
            <button onClick={handleLike}>❤️ {post.likes || 0}</button>
            <button onClick={handleSave}>🔖 Save</button>
            <button onClick={handleShare}>
              🔗 Share
            </button>
          </div>

          {status && <p className="reel-status small">{status}</p>}

          <section className="reel-comments">
            <h3>Comments</h3>

            <form className="reel-comment-form" onSubmit={handleComment}>
              <input
                placeholder="Add a thoughtful comment..."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
              <button type="submit">Post</button>
            </form>

            <div className="reel-comment-list">
              {comments.length === 0 ? (
                <p className="empty-comments">No comments yet.</p>
              ) : (
                comments.map((item, index) => (
                  <div className="reel-comment" key={item.id || item.commentId || index}>
                    <strong>{item.author || item.user || item.username || 'User'}</strong>
                    <p>{item.comment || item.text || item.body}</p>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}