import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { postApi } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import './CommentsPage.css';

const displayName = (item) => {
  const raw =
    item.username ||
    item.email ||
    item.author ||
    item.user ||
    item.name ||
    'User';

  const value = String(raw).trim();
  return value.includes('@') ? value.split('@')[0] : value || 'User';
};

export default function CommentsPage() {
  const { reelId } = useParams();
  const navigate = useNavigate();
  const inputRef = useRef(null);
  const bottomRef = useRef(null);
  const { user } = useAuth();

  const currentUserId = user?.id || user?.userId || user?.sub;

  const [comments, setComments] = useState([]);
  const [text, setText] = useState('');
  const [replyingTo, setReplyingTo] = useState(null);
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editingText, setEditingText] = useState('');
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [toast, setToast] = useState('');

  useEffect(() => {
    loadComments();
    setTimeout(() => inputRef.current?.focus(), 300);
  }, [reelId]);

  useEffect(() => {
    if (!loading) scrollToBottom(false);
  }, [loading]);

  const scrollToBottom = (smooth = true) => {
    setTimeout(() => {
      bottomRef.current?.scrollIntoView({
        behavior: smooth ? 'smooth' : 'auto',
        block: 'end',
      });
    }, 80);
  };

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 1600);
  };

  const getCommentId = (item, index) =>
    item.commentId || item.id || `${item.createdAt || 'comment'}-${index}`;

  const isMine = (item) =>
    Boolean(item.userId && currentUserId && item.userId === currentUserId);

  const loadComments = async () => {
    try {
      setLoading(true);

      const data = await postApi.getComments(reelId);

      const sorted = Array.isArray(data)
        ? [...data].sort(
            (a, b) => Number(a.createdAt || 0) - Number(b.createdAt || 0)
          )
        : [];

      setComments(sorted);
    } catch (err) {
      console.error(err);
      showToast('Failed to load comments');
    } finally {
      setLoading(false);
    }
  };

  const submit = async () => {
    const cleanText = text.trim();
    if (!cleanText || posting) return;

    try {
      setPosting(true);

      const finalText = replyingTo
        ? `@${replyingTo.name} ${cleanText}`
        : cleanText;

      const saved = await postApi.addComment({
        reelId,
        comment: finalText,
        text: finalText,
        body: finalText,
        parentCommentId: replyingTo?.id || '',
      });

      const optimistic = {
        commentId: saved?.commentId || crypto.randomUUID(),
        userId: saved?.userId || currentUserId,
        username:
          saved?.username ||
          user?.username ||
          user?.name ||
          user?.email ||
          'You',
        email: saved?.email || user?.email || '',
        text: saved?.text || finalText,
        createdAt: saved?.createdAt || Date.now(),
        parentCommentId: replyingTo?.id || '',
      };

      setComments((prev) => [...prev, optimistic]);
      setText('');
      setReplyingTo(null);
      showToast(replyingTo ? 'Reply posted' : 'Comment posted');
      scrollToBottom(true);
    } catch (err) {
      console.error(err);
      showToast('Failed to post');
    } finally {
      setPosting(false);
    }
  };

  const editComment = async (item) => {
    const cleanText = editingText.trim();
    if (!cleanText) return;

    try {
      const updated = await postApi.editComment({
        reelId,
        commentId: item.commentId,
        text: cleanText,
      });

      setComments((prev) =>
        prev.map((comment) =>
          comment.commentId === item.commentId
            ? {
                ...comment,
                text: updated.text || updated.comment?.text || cleanText,
                updatedAt: Date.now(),
              }
            : comment
        )
      );

      setEditingCommentId(null);
      setEditingText('');
      showToast('Comment updated');
    } catch (err) {
      console.error(err);
      showToast('Failed to edit comment');
    }
  };

  const deleteComment = async (item) => {
    const ok = window.confirm('Delete this comment?');
    if (!ok) return;

    try {
      await postApi.deleteComment({
        reelId,
        commentId: item.commentId,
      });

      setComments((prev) =>
        prev.filter((comment) => comment.commentId !== item.commentId)
      );

      showToast('Comment deleted');
    } catch (err) {
      console.error(err);
      showToast('Failed to delete comment');
    }
  };

  const startReply = (item, index) => {
    const name = displayName(item);

    setReplyingTo({
      id: getCommentId(item, index),
      name,
    });

    setText('');
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const cancelReply = () => {
    setReplyingTo(null);
    setText('');
  };

  const initials = (name) =>
    String(name || 'U').trim().slice(0, 1).toUpperCase();

  return (
    <main className="comments-page">
      {toast && <div className="comment-toast">{toast}</div>}

      <header className="comments-topbar">
        <button type="button" className="icon-btn" onClick={() => navigate(-1)}>
          ←
        </button>

        <div className="comments-title-wrap">
          <h1>Comments</h1>
          <span>{comments.length} replies</span>
        </div>

        <button
          type="button"
          className="icon-btn"
          onClick={() => inputRef.current?.focus()}
        >
          ✎
        </button>
      </header>

      <section className="comments-body">
        {loading ? (
          <div className="comments-loading">
            <div className="loader-ring" />
            <p>Loading discussion...</p>
          </div>
        ) : comments.length === 0 ? (
          <div className="comments-empty">
            <div className="empty-bubble">💬</div>
            <h3>No comments yet</h3>
            <p>Start the conversation with something thoughtful.</p>
          </div>
        ) : (
          <div className="comments-list">
            {comments.map((item, index) => {
              const commentId = getCommentId(item, index);
              const name = displayName(item);
              const textValue = item.text || item.comment || item.body || '';
              const mine = isMine(item);

              return (
                <article
                  key={commentId}
                  className={mine ? 'comment-row mine' : 'comment-row'}
                >
                  {!mine && <div className="avatar">{initials(name)}</div>}

                  <div className={mine ? 'comment-bubble mine' : 'comment-bubble'}>
                    <div className="comment-head">
                      <button
                        type="button"
                        className="comment-username"
                        onClick={() => item.userId && navigate(`/creator/${item.userId}`)}
                      >
                        {mine ? 'You' : `@${name}`}
                      </button>
                    </div>

                    {editingCommentId === commentId ? (
                      <div className="comment-edit-box">
                        <input
                          value={editingText}
                          onChange={(e) => setEditingText(e.target.value)}
                          autoFocus
                        />

                        <button type="button" onClick={() => editComment(item)}>
                          Save
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setEditingCommentId(null);
                            setEditingText('');
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <p>{textValue}</p>
                    )}

                    <div className="comment-actions">
                      <button type="button" onClick={() => startReply(item, index)}>
                        Reply
                      </button>

                      {mine && (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingCommentId(commentId);
                              setEditingText(textValue);
                            }}
                          >
                            Edit
                          </button>

                          <button type="button" onClick={() => deleteComment(item)}>
                            Delete
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {mine && <div className="avatar mine-avatar">Y</div>}
                </article>
              );
            })}

            <div ref={bottomRef} />
          </div>
        )}
      </section>

      {replyingTo && (
        <div className="replying-bar">
          <span>Replying to @{replyingTo.name}</span>
          <button type="button" onClick={cancelReply}>
            Cancel
          </button>
        </div>
      )}

      <footer className="comment-compose">
        <div className="compose-avatar">Y</div>

        <input
          ref={inputRef}
          placeholder={
            replyingTo
              ? `Reply to ${replyingTo.name}...`
              : 'Write something smart...'
          }
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
        />

        <button
          type="button"
          className="send-btn"
          disabled={posting || !text.trim()}
          onClick={submit}
        >
          {posting ? '...' : replyingTo ? 'Reply' : 'Post'}
        </button>
      </footer>
    </main>
  );
}