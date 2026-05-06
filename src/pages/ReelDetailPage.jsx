import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

const ReelMedia = memo(function ReelMedia({ post, image }) {
  if (post.videoUrl) {
    return (
      <video
        src={post.videoUrl}
        controls
        playsInline
        preload="metadata"
      />
    );
  }

  if (image) {
    return (
      <img
        src={image}
        alt={post.title || 'Post'}
        loading="eager"
        decoding="async"
        fetchPriority="high"
      />
    );
  }

  return (
    <div className="reel-media-placeholder">
      {post.topic?.[0] || 'S'}
    </div>
  );
});

const CommentItem = memo(function CommentItem({ item, index }) {
  return (
    <div className="reel-comment">
      <strong>{item.author || item.user || item.username || 'User'}</strong>
      <p>{item.comment || item.text || item.body}</p>
    </div>
  );
});

export default function ReelDetailPage() {
  const { reelId } = useParams();
  const navigate = useNavigate();
  const mountedRef = useRef(true);

  const [post, setPost] = useState(null);
  const [comments, setComments] = useState([]);
  const [comment, setComment] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const image = useMemo(() => getPostImage(post), [post]);

  useEffect(() => {
    mountedRef.current = true;

    async function loadPost() {
      try {
        setLoading(true);
        setStatus('');

        const postData = await postApi.getSingleReel(reelId);
        if (!mountedRef.current) return;
        setPost(postData || null);
        setLoading(false);

        if (!postData) return;

        try {
          const commentsData = await postApi.getComments(reelId);
          if (!mountedRef.current) return;

          const loadedComments = Array.isArray(commentsData?.comments)
            ? commentsData.comments
            : Array.isArray(commentsData)
              ? commentsData
              : [];

          setComments(loadedComments);
        } catch (commentsErr) {
          console.error('Failed to load comments:', commentsErr);
          if (mountedRef.current) setComments([]);
        }
      } catch (err) {
        console.error(err);
        if (mountedRef.current) {
          setStatus('Failed to load post.');
          setLoading(false);
        }
      }
    }

    loadPost();

    return () => {
      mountedRef.current = false;
    };
  }, [reelId]);

const handleLike = useCallback(async () => {
  if (!post) return;

  try {
    await postApi.toggleLike(reelId);
    if (!mountedRef.current) return;

    setPost((prev) => {
      if (!prev) return prev;
      const wasLiked = Boolean(prev.liked);

      return {
        ...prev,
        likes: Math.max(0, Number(prev.likes || 0) + (wasLiked ? -1 : 1)),
        liked: !wasLiked,
      };
    });
  } catch (err) {
    console.error('Like failed:', err);
    if (mountedRef.current) setStatus('Like failed.');
  }
}, [post, reelId]);

const handleShare = useCallback(async () => {
  const currentLink = window.location.href;

  if (navigator.share) {
    try {
      await navigator.share({
        title: post?.title || 'Smarty Post',
        text: post?.title || '',
        url: currentLink,
      });
      return;
    } catch (err) {
      if (err?.name === 'AbortError') return;
    }
  }

  try {
    await navigator.clipboard.writeText(currentLink);
    if (mountedRef.current) setStatus('Link copied to clipboard.');
  } catch (err) {
    console.error('Share failed:', err);
    if (mountedRef.current) setStatus('Could not copy link.');
  }
}, [post]);

const handleSave = useCallback(async () => {
  if (!post) return;

  try {
    await postApi.toggleSave(reelId);
    if (!mountedRef.current) return;

    setPost((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        saved: !Boolean(prev.saved),
      };
    });

    setStatus(Boolean(post.saved) ? 'Removed from saved.' : 'Saved successfully.');
  } catch (err) {
    console.error('Save failed:', err);
    if (mountedRef.current) setStatus('Save failed.');
  }
}, [post, reelId]);

  const handleComment = useCallback(async (e) => {
    e.preventDefault();

    const cleanComment = comment.trim();
    if (!cleanComment) return;

    const tempComment = {
      id: `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      author: 'You',
      comment: cleanComment,
      createdAt: Date.now(),
    };

    setComments((prev) => [tempComment, ...prev]);
    setComment('');

    try {
      await postApi.addComment({
        reelId,
        comment: cleanComment,
        text: cleanComment,
      });
    } catch (err) {
      console.error('Comment failed:', err);
      if (!mountedRef.current) return;
      setComments((prev) => prev.filter((item) => item.id !== tempComment.id));
      setComment(cleanComment);
      setStatus('Comment failed.');
    }
  }, [comment, reelId]);

  const renderedComments = useMemo(() => {
    if (comments.length === 0) {
      return <p className="empty-comments">No comments yet.</p>;
    }

    return comments.map((item, index) => (
      <CommentItem
        key={item.id || item.commentId || `${item.createdAt || 'comment'}-${index}`}
        item={item}
        index={index}
      />
    ));
  }, [comments]);

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
          <ReelMedia post={post} image={image} />
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
            <button onClick={handleSave}>{post.saved ? '✅ Saved' : '🔖 Save'}</button>
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
              <button type="submit" disabled={!comment.trim()}>Post</button>
            </form>

            <div className="reel-comment-list">
              {renderedComments}
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}