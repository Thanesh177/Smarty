import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Bookmark, Heart, Layers, MessageCircle, RefreshCw, Send, Share2 } from 'lucide-react';
import { postApi } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import LearningJourneyPanel from '../components/learning/LearningJourneyPanel';
import PostAuthor from '../components/PostAuthor';
import { getPostAuthorUsername } from '../lib/postAuthor';
import { normalizePostResponse } from '../lib/postResponse';
import { postReadingStats } from '../lib/postDraft';
import { getPostVideoUrl } from '../lib/videoFeed';
import { contentTopics } from '../lib/communityContent';
import './ReelDetailPage.css';

export default function ReelDetailPage() {
  const { reelId } = useParams(), { user } = useAuth();
  return <SinglePost key={String(user?.sub || user?.userId || user?.id || 'guest') + ':' + reelId} reelId={reelId} user={user} />;
}
function SinglePost({ reelId, user }) {
  const navigate = useNavigate(), mounted = useRef(true), lock = useRef(new Set()), media = useRef(null), commentsVersion = useRef(0);
  const [post, setPost] = useState(null), [loading, setLoading] = useState(true), [loadError, setLoadError] = useState('');
  const [attempt, setAttempt] = useState(0), [comments, setComments] = useState([]), [commentsLoading, setCommentsLoading] = useState(true);
  const [commentsError, setCommentsError] = useState(''), [comment, setComment] = useState(''), [status, setStatus] = useState('');
  const [busy, setBusy] = useState({}), [mediaError, setMediaError] = useState(false);
  const loadComments = useCallback(async () => {
    const version = ++commentsVersion.current;
    setCommentsLoading(true); setCommentsError('');
    try { const result = await postApi.getComments(reelId); if (mounted.current && version === commentsVersion.current) setComments(Array.isArray(result) ? result : result?.comments || []); }
    catch { if (mounted.current && version === commentsVersion.current) setCommentsError('The discussion could not load.'); }
    finally { if (mounted.current && version === commentsVersion.current) setCommentsLoading(false); }
  }, [reelId]);
  useEffect(() => {
    mounted.current = true; let canceled = false;
    setLoading(true); setLoadError('');
    postApi.getSingleReel(reelId).then(result => {
      if (canceled) return;
      if (!result || !(result.id || result.reelId || result.postId || result.title)) throw new Error('Unavailable');
      setPost({ ...result, liked: Boolean(result.liked ?? result.isLiked), saved: Boolean(result.saved ?? result.isSaved ?? result.bookmarked ?? result.isBookmarked ?? result.savedByCurrentUser) }); setLoading(false); void loadComments();
    }).catch(error => {
      if (!canceled) { setLoadError([403,404,410].includes(error?.response?.status) ? 'This post is private or no longer available.' : 'This post could not load. Please try again.'); setLoading(false); }
    });
    return () => { canceled = true; mounted.current = false; media.current?.pause(); };
  }, [reelId, attempt, loadComments]);
  useEffect(() => {
    const video = media.current;
    if (!video) return undefined;
    const pause = () => { if (document.visibilityState === 'hidden') video.pause(); };
    const observer = new IntersectionObserver(([entry]) => { if (!entry.isIntersecting) video.pause(); });
    observer.observe(video); document.addEventListener('visibilitychange', pause);
    return () => { video.pause(); observer.disconnect(); document.removeEventListener('visibilitychange', pause); };
  }, [post?.videoUrl]);
  const requireUser = () => {
    if (user) return true;
    navigate('/login', { state: { from: { pathname: '/reel/' + encodeURIComponent(reelId) } } }); return false;
  };
  const action = async (kind, callback) => {
    if (!requireUser() || lock.current.has(kind)) return;
    lock.current.add(kind); setBusy(value => ({ ...value, [kind]: true })); setStatus('');
    try { await callback(); }
    catch { if (mounted.current) setStatus(kind === 'comment' ? 'Your comment was not sent. Your text is still here.' : 'Could not update this ' + (kind === 'save' ? 'bookmark' : 'like') + '. Please try again.'); }
    finally { lock.current.delete(kind); if (mounted.current) setBusy(value => ({ ...value, [kind]: false })); }
  };
  const toggleLike = () => action('like', async () => {
    const result = normalizePostResponse(await postApi.toggleLike(reelId));
    if (!mounted.current) return;
    setPost(previous => ({ ...previous, liked: typeof result.liked === 'boolean' ? result.liked : !previous.liked,
      likes: typeof result.likes === 'number' ? result.likes : Math.max(0, Number(previous.likes || 0) + (previous.liked ? -1 : 1)) }));
  });
  const toggleSave = () => action('save', async () => {
    const result = normalizePostResponse(await postApi.toggleSave(reelId));
    if (!mounted.current) return;
    setPost(previous => ({ ...previous, saved: typeof result.saved === 'boolean' ? result.saved : !previous.saved }));
    window.dispatchEvent(new Event('saved-posts-updated'));
  });
  const share = async () => {
    try {
      if (navigator.share) await navigator.share({ title: post?.title || 'A Smarty idea', url: window.location.href });
      else { await navigator.clipboard.writeText(window.location.href); if (mounted.current) setStatus('Post link copied.'); }
    } catch (error) { if (error?.name !== 'AbortError' && mounted.current) setStatus('Could not share this post. Please try again.'); }
  };
  const submitComment = event => {
    event.preventDefault(); const text = comment.trim(); if (!text) return;
    void action('comment', async () => {
      const result = normalizePostResponse(await postApi.addComment({ reelId, comment: text, text }));
      if (!mounted.current) return;
      const item = result.item || (result.comment && typeof result.comment === 'object' ? result.comment : null);
      // An older discussion request must not erase a newly accepted comment.
      commentsVersion.current += 1; setCommentsLoading(false); setCommentsError('');
      setComments(previous => [item || { id: 'local-' + Date.now(), username: getPostAuthorUsername(null, user), userId: user?.sub || user?.userId || user?.id, comment: text }, ...previous]);
      setComment(''); setStatus('Comment posted.');
    });
  };
  const topic = contentTopics(post)[0] || 'Smarty';
  const image = getPostVideoUrl({ videoUrl: post?.imageUrl || post?.photoUrl || post?.thumbnail || post?.coverImage || post?.image || post?.mediaUrl || '' });
  const video = getPostVideoUrl(post), hasMedia = Boolean(image || video), minutes = postReadingStats(post?.body || '').minutes;
  return <main className="reel-detail-page single-post-page" aria-labelledby="single-post-title">
    <nav className="single-post-nav" aria-label="Post navigation"><Link to="/feed?topic=All"><Layers size={16}/>Feed</Link><Link to="/feed?topic=All" className="single-post-brand">Smarty</Link><Link to="/saved" aria-label="Saved posts"><Bookmark size={17}/></Link></nav>
    {loading ? <div className="single-post-skeleton" role="status" aria-label="Loading post"><i/><i/><i/><i/></div> : loadError ? <section className="single-post-state" role="alert"><h1 id="single-post-title">An idea worth coming back to.</h1><p>{loadError}</p><button type="button" onClick={() => setAttempt(value => value + 1)}><RefreshCw size={16}/>Try again</button></section> : <>
      <header className="single-post-heading"><Link className="single-post-topic" to={'/feed?topic=' + encodeURIComponent(topic)}>{topic}</Link><h1 id="single-post-title">{post.title || 'An idea to explore'}</h1><div className="reel-author-row"><PostAuthor post={post}/><span>{minutes} min read</span>{post.visibility === 'private' && <span>Private post</span>}</div></header>
      <div className={'single-post-layout' + (hasMedia ? ' has-media' : '')}>
        <article className="single-post-reading" aria-label="Post content">{String(post.body || post.description || '').split(/\n\s*\n/).filter(Boolean).map((paragraph,index) => <p key={index}>{paragraph}</p>)}</article>
        {hasMedia && <aside className="single-post-media" aria-label="Post attachment">{mediaError ? <p>The attachment is unavailable. You can still read the post.</p> : video ? <video ref={media} src={video} poster={getPostVideoUrl({ videoUrl: post.thumbUrl || image }) || undefined} controls playsInline preload="metadata" onError={() => setMediaError(true)}/> : <img src={image} alt={post.title || 'Post attachment'} decoding="async" onError={() => setMediaError(true)}/>}</aside>}
      </div>
      <div className="single-post-actions" role="group" aria-label="Post actions"><button type="button" aria-label={post.liked ? 'Unlike post' : 'Like post'} aria-pressed={Boolean(post.liked)} disabled={busy.like} onClick={toggleLike}><Heart size={18} fill={post.liked ? 'currentColor' : 'none'}/>{Number(post.likes || 0)}<span>Likes</span></button><button type="button" aria-pressed={Boolean(post.saved)} disabled={busy.save} onClick={toggleSave}><Bookmark size={18} fill={post.saved ? 'currentColor' : 'none'}/>{post.saved ? 'Saved' : 'Save'}</button><button type="button" onClick={share}><Share2 size={17}/>Share</button><Link to={'/comments/' + encodeURIComponent(reelId)} state={{ post }}><MessageCircle size={17}/>Discuss</Link></div>
      {status && <p className="single-post-notice" role="status">{status}</p>}
      <LearningJourneyPanel post={post} postId={reelId} stage="read" creatorName={getPostAuthorUsername(post)}/>
      <section className="single-post-discussion" aria-labelledby="single-post-discussion-title"><header><div><small>OTHER PERSPECTIVES</small><h2 id="single-post-discussion-title">The conversation</h2></div><Link to={'/comments/' + encodeURIComponent(reelId)} state={{ post }}>View discussion</Link></header>
        <form className="single-post-comment-form" onSubmit={submitComment}><label htmlFor="single-post-comment">Add a thought or a question</label><div><textarea id="single-post-comment" placeholder="What did this make you think about?" value={comment} maxLength={2000} rows={2} disabled={busy.comment} onChange={event => setComment(event.target.value)}/><button type="submit" disabled={!comment.trim() || busy.comment} aria-label="Post comment"><Send size={18}/></button></div></form>
        {commentsLoading ? <p role="status">Loading the conversation…</p> : commentsError ? <div role="alert"><p>{commentsError}</p><button type="button" onClick={loadComments}>Try again</button></div> : comments.length ? <div className="single-post-comments">{comments.slice(0,4).map((item,index) => <article key={item.id || item.commentId || index}><PostAuthor post={item} resolve={false}/><p>{item.comment || item.text || item.body}</p></article>)}</div> : <p className="single-post-empty">A good question can start a great conversation.</p>}
      </section>
    </>}
  </main>;
}
