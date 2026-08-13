import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { chatApi, postApi } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { getUserScopedStorageKey } from '../lib/userScopedStorage';
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

const initials = (name) =>
  String(name || 'U').trim().slice(0, 1).toUpperCase();

const getCommentDate = (value) => {
  if (!value) return '';

  const numericValue = Number(value);
  const date = Number.isFinite(numericValue)
    ? new Date(numericValue < 1e12 ? numericValue * 1000 : numericValue)
    : new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
};

const formatCommentTime = (value) => {
  const date = getCommentDate(value);
  if (!date) return '';

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
};

const CommentRow = memo(function CommentRow({
  item,
  index,
  commentId,
  name,
  textValue,
  mine,
  editing,
  editingText,
  processingCommentId,
  onCreatorOpen,
  onEditingTextChange,
  onSaveEdit,
  onCancelEdit,
  onReply,
  onStartEdit,
  onDelete,
  onReport,
  onBlock,
}) {
  const ownerId = item.userId || item.authorId || item.senderId;
  const disabledCreator = mine || !ownerId;
  const commentDate = getCommentDate(item.updatedAt || item.createdAt);
  const commentTime = formatCommentTime(item.updatedAt || item.createdAt);

  return (
    <article className={mine ? 'comment-row mine' : 'comment-row'}>
      {!mine && (
        <button
          type="button"
          className="avatar avatar-button"
          aria-label={`Open ${name}'s profile`}
          disabled={!ownerId}
          onClick={() => onCreatorOpen(ownerId, false)}
        >
          {initials(name)}
        </button>
      )}

      <div className={mine ? 'comment-bubble mine' : 'comment-bubble'}>
        <div className="comment-head">
          <button
            type="button"
            className="comment-username"
            disabled={disabledCreator}
            onClick={() => onCreatorOpen(ownerId, mine)}
          >
            {mine ? 'You' : `@${name}`}
          </button>

          {commentTime && (
            <time dateTime={commentDate?.toISOString()}>
              {item.updatedAt ? 'Edited · ' : ''}{commentTime}
            </time>
          )}
        </div>

        {editing ? (
          <div className="comment-edit-box">
            <input
              value={editingText}
              disabled={processingCommentId === commentId}
              autoComplete="off"
              onChange={onEditingTextChange}
              autoFocus
            />

            <button
              type="button"
              disabled={processingCommentId === commentId || !editingText.trim()}
              onClick={() => onSaveEdit(item, index)}
            >
              {processingCommentId === commentId ? 'Saving...' : 'Save'}
            </button>

            <button
              type="button"
              disabled={processingCommentId === commentId}
              onClick={onCancelEdit}
            >
              Cancel
            </button>
          </div>
        ) : (
          <p>{textValue}</p>
        )}

        <div className="comment-actions">
          <button type="button" onClick={() => onReply(item, index)}>
            Reply
          </button>

          {mine && (
            <>
              <button
                type="button"
                onClick={() => onStartEdit(commentId, textValue)}
              >
                Edit
              </button>

              <button
                type="button"
                disabled={processingCommentId === commentId}
                onClick={() => onDelete(item, index)}
              >
                {processingCommentId === commentId ? 'Deleting...' : 'Delete'}
              </button>
            </>
          )}

          {!mine && ownerId && (
            <>
              <button
                type="button"
                onClick={() => onReport(item, index)}
              >
                Report
              </button>

              <button
                type="button"
                onClick={() => onBlock(item, index)}
              >
                Block
              </button>
            </>
          )}
        </div>
      </div>

      {mine && (
        <button
          type="button"
          className="avatar mine-avatar avatar-button"
          aria-label="Open your profile"
          onClick={() => onCreatorOpen(ownerId, true)}
        >
          {initials(name)}
        </button>
      )}
    </article>
  );
});

export default function CommentsPage() {
  const { reelId } = useParams();
  const navigate = useNavigate();
  const inputRef = useRef(null);
  const bottomRef = useRef(null);
  const mountedRef = useRef(true);
  const focusTimerRef = useRef(null);
  const scrollTimerRef = useRef(null);
  const toastTimerRef = useRef(null);
  const { user } = useAuth();

  const currentUserId = useMemo(
    () => user?.id || user?.userId || user?.sub,
    [user]
  );

  const currentUserInitial = useMemo(
    () => initials(user?.username || user?.name || user?.email || 'You'),
    [user]
  );

  const blockedCreatorsKey = useMemo(
    () => getUserScopedStorageKey('smarty_blocked_creators_v1', currentUserId),
    [currentUserId]
  );

  const [comments, setComments] = useState([]);
  const [text, setText] = useState('');
  const [replyingTo, setReplyingTo] = useState(null);
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editingText, setEditingText] = useState('');
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [processingCommentId, setProcessingCommentId] = useState('');
  const [toast, setToast] = useState('');
  const [moderationTarget, setModerationTarget] = useState(null);
  const [moderationReason, setModerationReason] = useState('');
  const [moderationSubmitting, setModerationSubmitting] = useState(false);

  const scrollToBottom = useCallback((smooth = true) => {
    if (scrollTimerRef.current) window.clearTimeout(scrollTimerRef.current);

    scrollTimerRef.current = window.setTimeout(() => {
      if (!mountedRef.current) return;
      bottomRef.current?.scrollIntoView({
        behavior: smooth ? 'smooth' : 'auto',
        block: 'end',
      });
    }, 60);
  }, []);

  const showToast = useCallback((msg) => {
    if (!mountedRef.current) return;

    setToast(msg);

    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => {
      if (mountedRef.current) setToast('');
    }, 1400);
  }, []);

  const getCommentId = useCallback(
    (item, index) => item.commentId || item.id || `${item.createdAt || 'comment'}-${index}`,
    []
  );

  const isMine = useCallback((item) => {
    const ownerId = item.userId || item.authorId || item.senderId;
    return Boolean(ownerId && currentUserId && ownerId === currentUserId);
  }, [currentUserId]);

  const loadComments = useCallback(async () => {
    try {
      setLoading(true);

      const data = await postApi.getComments(reelId);
      if (!mountedRef.current) return;

      const rawComments = Array.isArray(data?.comments)
        ? data.comments
        : Array.isArray(data)
          ? data
          : [];

      const sorted = [...rawComments].sort(
        (a, b) => Number(a.createdAt || 0) - Number(b.createdAt || 0)
      );

      let blockedIds = new Set();

      try {
        blockedIds = new Set(
          JSON.parse(localStorage.getItem(blockedCreatorsKey) || '[]')
        );
      } catch {
        blockedIds = new Set();
      }

      setComments(sorted.filter((comment) => {
        const ownerId = String(
          comment.userId || comment.authorId || comment.senderId || ''
        ).trim();
        return !ownerId || !blockedIds.has(ownerId);
      }));
    } catch (err) {
      console.error(err);
      showToast('Failed to load comments');
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [blockedCreatorsKey, reelId, showToast]);

  useEffect(() => {
    mountedRef.current = true;
    loadComments();

    if (focusTimerRef.current) window.clearTimeout(focusTimerRef.current);
    focusTimerRef.current = window.setTimeout(() => {
      if (mountedRef.current) inputRef.current?.focus();
    }, 250);

    return () => {
      mountedRef.current = false;
      if (focusTimerRef.current) window.clearTimeout(focusTimerRef.current);
      if (scrollTimerRef.current) window.clearTimeout(scrollTimerRef.current);
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    };
  }, [loadComments]);

  useEffect(() => {
    if (!loading) scrollToBottom(false);
  }, [loading, scrollToBottom]);

  const submit = useCallback(async () => {
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
        parentCommentId: replyingTo?.id || undefined,
      });

      const optimistic = {
        commentId: saved?.commentId || saved?.id || `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        userId: saved?.userId || currentUserId,
        username:
          saved?.username ||
          user?.username ||
          user?.name ||
          user?.email ||
          'You',
        email: saved?.email || user?.email || '',
        text: saved?.text || saved?.comment || saved?.body || finalText,
        createdAt: saved?.createdAt || Date.now(),
        parentCommentId: replyingTo?.id || '',
      };

      if (!mountedRef.current) return;
      setComments((prev) => [...prev, optimistic]);
      setText('');
      setReplyingTo(null);
      showToast(replyingTo ? 'Reply posted' : 'Comment posted');
      scrollToBottom(true);
    } catch (err) {
      console.error(err);
      showToast('Failed to post');
    } finally {
      if (mountedRef.current) setPosting(false);
    }
  }, [currentUserId, posting, reelId, replyingTo, scrollToBottom, showToast, text, user]);

  const editComment = useCallback(async (item, index) => {
    const cleanText = editingText.trim();
    const commentId = item.commentId || item.id || getCommentId(item, index);

    if (!cleanText || !commentId || processingCommentId) return;

    try {
      setProcessingCommentId(commentId);

      const updated = await postApi.editComment({
        reelId,
        commentId,
        text: cleanText,
      });

      if (!mountedRef.current) return;

      setComments((prev) =>
        prev.map((comment, commentIndex) =>
          getCommentId(comment, commentIndex) === commentId
            ? {
                ...comment,
                text: updated?.text || updated?.comment?.text || updated?.comment || cleanText,
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
    } finally {
      if (mountedRef.current) setProcessingCommentId('');
    }
  }, [editingText, getCommentId, processingCommentId, reelId, showToast]);

  const deleteComment = useCallback(async (item, index) => {
    const commentId = item.commentId || item.id || getCommentId(item, index);
    if (!commentId || processingCommentId) return;

    const ok = window.confirm('Delete this comment?');
    if (!ok) return;

    try {
      setProcessingCommentId(commentId);

      await postApi.deleteComment({
        reelId,
        commentId,
      });

      if (!mountedRef.current) return;

      setComments((prev) =>
        prev.filter((comment, commentIndex) => getCommentId(comment, commentIndex) !== commentId)
      );

      showToast('Comment deleted');
    } catch (err) {
      console.error(err);
      showToast('Failed to delete comment');
    } finally {
      if (mountedRef.current) setProcessingCommentId('');
    }
  }, [getCommentId, processingCommentId, reelId, showToast]);

  const openModerationDialog = useCallback((mode, item, index) => {
    const ownerId = String(
      item.userId || item.authorId || item.senderId || ''
    ).trim();

    if (!ownerId) {
      showToast('This user could not be identified');
      return;
    }

    setModerationReason('');
    setModerationTarget({
      mode,
      ownerId,
      commentId: getCommentId(item, index),
      name: displayName(item),
      text: item.text || item.comment || item.body || '',
    });
  }, [getCommentId, showToast]);

  const closeModerationDialog = useCallback(() => {
    if (moderationSubmitting) return;
    setModerationTarget(null);
    setModerationReason('');
  }, [moderationSubmitting]);

  const submitModerationAction = useCallback(async () => {
    if (!moderationTarget || !moderationReason || moderationSubmitting) return;

    setModerationSubmitting(true);

    const context = {
      reportedUserId: moderationTarget.ownerId,
      postId: reelId,
      commentId: moderationTarget.commentId,
      contentId: moderationTarget.commentId,
      contentType: 'comment',
      source: moderationTarget.mode === 'block'
        ? 'comment-block-action'
        : 'comment-report-action',
      reason: moderationReason,
    };

    try {
      if (moderationTarget.mode === 'report') {
        await chatApi.reportUser(context);
        showToast('Comment reported. Thank you for helping keep Smarty safe.');
      } else {
        await chatApi.blockUser(moderationTarget.ownerId, context);

        try {
          const blockedIds = new Set(
            JSON.parse(localStorage.getItem(blockedCreatorsKey) || '[]')
          );
          blockedIds.add(moderationTarget.ownerId);
          localStorage.setItem(blockedCreatorsKey, JSON.stringify([...blockedIds]));
        } catch {
          // The current discussion still updates when storage is unavailable.
        }

        setComments((current) => current.filter((comment) => {
          const ownerId = String(
            comment.userId || comment.authorId || comment.senderId || ''
          ).trim();
          return ownerId !== moderationTarget.ownerId;
        }));

        showToast(`${moderationTarget.name} was blocked and removed.`);
      }

      setModerationTarget(null);
      setModerationReason('');
    } catch (error) {
      console.error('Comment moderation failed:', error);
      showToast(error?.message || 'Could not complete that safety action.');
    } finally {
      if (mountedRef.current) setModerationSubmitting(false);
    }
  }, [
    blockedCreatorsKey,
    moderationReason,
    moderationSubmitting,
    moderationTarget,
    reelId,
    showToast,
  ]);

  const startReply = useCallback((item, index) => {
    const name = displayName(item);

    setReplyingTo({
      id: getCommentId(item, index),
      name,
    });

    setText('');
    if (focusTimerRef.current) window.clearTimeout(focusTimerRef.current);
    focusTimerRef.current = window.setTimeout(() => {
      if (mountedRef.current) inputRef.current?.focus();
    }, 80);
  }, [getCommentId]);

  const cancelReply = useCallback(() => {
    setReplyingTo(null);
    setText('');
  }, []);

  const goBack = useCallback(() => {
    navigate(-1);
  }, [navigate]);

  const focusInput = useCallback(() => {
    inputRef.current?.focus();
  }, []);

  const handleTextChange = useCallback((e) => {
    setText(e.target.value);
  }, []);

  const handleEditingTextChange = useCallback((e) => {
    setEditingText(e.target.value);
  }, []);

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        submit();
      }
    },
    [submit]
  );

  const openCreator = useCallback(
    (ownerId, mine) => {
      if (mine) {
        navigate('/profile');
        return;
      }

      if (ownerId) navigate(`/creator/${ownerId}`);
    },
    [navigate]
  );

  const cancelEdit = useCallback(() => {
    setEditingCommentId(null);
    setEditingText('');
  }, []);

  const startEdit = useCallback((commentId, value) => {
    setEditingCommentId(commentId);
    setEditingText(value);
  }, []);

  const renderedComments = useMemo(
    () => comments.map((item, index) => {
      const commentId = getCommentId(item, index);
      const name = displayName(item);
      const textValue = item.text || item.comment || item.body || '';
      const mine = isMine(item);

      return (
        <CommentRow
          key={commentId}
          item={item}
          index={index}
          commentId={commentId}
          name={name}
          textValue={textValue}
          mine={mine}
          editing={editingCommentId === commentId}
          editingText={editingText}
          processingCommentId={processingCommentId}
          onCreatorOpen={openCreator}
          onEditingTextChange={handleEditingTextChange}
          onSaveEdit={editComment}
          onCancelEdit={cancelEdit}
          onReply={startReply}
          onStartEdit={startEdit}
          onDelete={deleteComment}
          onReport={(comment, commentIndex) =>
            openModerationDialog('report', comment, commentIndex)
          }
          onBlock={(comment, commentIndex) =>
            openModerationDialog('block', comment, commentIndex)
          }
        />
      );
    }),
    [
      cancelEdit,
      comments,
      deleteComment,
      editComment,
      editingCommentId,
      editingText,
      getCommentId,
      handleEditingTextChange,
      isMine,
      openModerationDialog,
      openCreator,
      processingCommentId,
      startEdit,
      startReply,
    ]
  );

  const canSend = useMemo(
    () => Boolean(!posting && text.trim()),
    [posting, text]
  );

  return (
    <main className="comments-page">
      {toast && <div className="comment-toast">{toast}</div>}

      <header className="comments-topbar">
        <button type="button" className="icon-btn" aria-label="Go back" onClick={goBack}>
          ←
        </button>

        <div className="comments-title-wrap">
          <h1>Comments</h1>
          <span>{comments.length} {comments.length === 1 ? 'comment' : 'comments'}</span>
        </div>

        <button
          type="button"
          className="icon-btn"
          aria-label="Write a comment"
          onClick={focusInput}
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
            {renderedComments}

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
        <button
          type="button"
          className="compose-avatar avatar-button"
          aria-label="Open your profile"
          onClick={() => navigate('/profile')}
        >
          {currentUserInitial}
        </button>

        <textarea
          ref={inputRef}
          rows={1}
          aria-label={replyingTo ? `Reply to ${replyingTo.name}` : 'Write a comment'}
          placeholder={
            replyingTo
              ? `Reply to ${replyingTo.name}...`
              : 'Write something smart...'
          }
          value={text}
          autoComplete="off"
          disabled={posting}
          onChange={handleTextChange}
          onKeyDown={handleKeyDown}
        />

        <button
          type="button"
          className="send-btn"
          disabled={!canSend}
          onClick={submit}
        >
          {posting ? '...' : replyingTo ? 'Reply' : 'Post'}
        </button>
      </footer>

      {moderationTarget && (
        <div
          className="comment-moderation-backdrop"
          role="presentation"
          onClick={closeModerationDialog}
        >
          <section
            className="comment-moderation-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="comment-moderation-title"
            onClick={(event) => event.stopPropagation()}
          >
            <span className="comment-moderation-kicker">Safety action</span>
            <h2 id="comment-moderation-title">
              {moderationTarget.mode === 'report'
                ? 'Report this comment?'
                : `Block ${moderationTarget.name}?`}
            </h2>
            <p>
              {moderationTarget.mode === 'report'
                ? 'Tell us why this comment should be reviewed.'
                : 'Their comments and posts will be removed from your view immediately.'}
            </p>

            <label>
              Reason
              <select
                value={moderationReason}
                disabled={moderationSubmitting}
                onChange={(event) => setModerationReason(event.target.value)}
              >
                <option value="">Choose a reason</option>
                <option value="Harassment or bullying">Harassment or bullying</option>
                <option value="Hate or abusive content">Hate or abusive content</option>
                <option value="Sexual or violent content">Sexual or violent content</option>
                <option value="Spam or misleading content">Spam or misleading content</option>
                <option value="Other objectionable content">Other objectionable content</option>
              </select>
            </label>

            <div className="comment-moderation-actions">
              <button
                type="button"
                disabled={moderationSubmitting}
                onClick={closeModerationDialog}
              >
                Cancel
              </button>
              <button
                type="button"
                className="primary"
                disabled={!moderationReason || moderationSubmitting}
                onClick={submitModerationAction}
              >
                {moderationSubmitting
                  ? 'Please wait...'
                  : moderationTarget.mode === 'report'
                    ? 'Submit report'
                    : 'Block user'}
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
