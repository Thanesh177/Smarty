import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowDown, ArrowUp, Flag, LoaderCircle, Plus, RefreshCw, UserX, Video, X } from 'lucide-react';
import FeedHeader from '../components/FeedHeader';
import ReelVideo from '../components/ReelVideo';
import { useAuth } from '../contexts/AuthContext';
import useFeed from '../hooks/useFeed';
import { chatApi } from '../api/client';
import { getMostVisibleVideo, getVideoCreatorId, getVideoCreatorName, getVideoPostId, getVideoPosts } from '../lib/videoFeed';
import './VideoTopicPage.css';

const REASONS = ['Harassment or bullying', 'Hate speech', 'Sexual or explicit content', 'Violence or threats', 'Spam or scam', 'Other objectionable content'];

function VideoSafetyDialog({ post, busy, error, onClose, onSubmit }) {
  const ref = useRef(null);
  const [mode, setMode] = useState('report');
  const [reason, setReason] = useState('');
  const id = useId();
  useEffect(() => { const panel = ref.current; panel.showModal(); return () => panel.close(); }, []);
  return <dialog ref={ref} className="video-safety-dialog" aria-labelledby={id} onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}>
    <header><div><small>KEEP SMARTY WELCOMING</small><h2 id={id}>{mode === 'block' ? 'Block this creator' : 'Report this video'}</h2></div><button type="button" onClick={onClose} disabled={busy} aria-label="Close safety options"><X size={19} /></button></header>
    <p>{mode === 'block' ? 'Their posts will be removed from your feed. This video will also be sent for review.' : 'Send this video to the moderation team. A successful report removes it from your feed while it is reviewed.'}</p>
    <div className="video-safety-modes"><button type="button" aria-pressed={mode === 'report'} onClick={() => setMode('report')} disabled={busy}><Flag size={16} />Report</button>
      {getVideoCreatorId(post) && <button type="button" aria-pressed={mode === 'block'} onClick={() => setMode('block')} disabled={busy}><UserX size={16} />Block creator</button>}</div>
    <label htmlFor={id + '-reason'}>Reason</label><select id={id + '-reason'} value={reason} onChange={event => setReason(event.target.value)} disabled={busy}><option value="">Choose a reason</option>{REASONS.map(value => <option key={value}>{value}</option>)}</select>
    {error && <p role="alert" className="video-safety-error">{error}</p>}
    <footer><button type="button" disabled={busy} onClick={onClose}>Cancel</button><button type="button" disabled={!reason || busy} onClick={() => onSubmit(mode, reason)}>{busy ? 'Sending…' : mode === 'block' ? 'Block and report' : 'Send report'}</button></footer>
  </dialog>;
}

export default function VideoTopicPage(props) {
  const { user } = useAuth();
  const account = String(user?.userId || user?.sub || user?.id || 'guest');
  // Mount a fresh player for each account; in-flight guest data cannot migrate.
  return <VideoFeed key={account} {...props} account={account} user={user} />;
}

function VideoFeed({ onOpenSearch, account, user }) {
  const navigate = useNavigate();
  const { posts, loading, loadingMore, error, nextCursor, loadMore, refreshFeed, savePost, hidePost, blockCreator } = useFeed();
  const videos = useMemo(() => getVideoPosts(posts), [posts]);
  const rootRef = useRef(null);
  const sentinelRef = useRef(null);
  const loadLock = useRef(false);
  const scans = useRef(0);
  const previousVideoCount = useRef(0);
  const visitedCursors = useRef(new Set());
  const mounted = useRef(true);
  const [activeId, setActiveId] = useState('');
  const [muted, setMuted] = useState(false);
  const [visible, setVisible] = useState(() => document.visibilityState !== 'hidden');
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState('');
  const [safety, setSafety] = useState(null);
  const [safetyBusy, setSafetyBusy] = useState(false);
  const [safetyError, setSafetyError] = useState('');
  const activeIndex = Math.max(0, videos.findIndex(post => getVideoPostId(post) === activeId));
  const canLoad = Boolean(nextCursor) && !loading && !loadingMore && !error;

  useEffect(() => {
    mounted.current = true;
    const visibility = () => setVisible(document.visibilityState !== 'hidden');
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const motion = () => setReducedMotion(preference.matches);
    document.addEventListener('visibilitychange', visibility);
    preference.addEventListener('change', motion);
    return () => { mounted.current = false; document.removeEventListener('visibilitychange', visibility); preference.removeEventListener('change', motion); };
  }, []);
  useEffect(() => {
    if (!notice) return undefined;
    const timer = window.setTimeout(() => setNotice(''), 3500);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || !videos.length) { setActiveId(''); return undefined; }
    const ratios = new Map();
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        const ratio = entry.isIntersecting ? entry.intersectionRatio : 0;
        ratios.set(entry.target.dataset.videoId, ratio);
        // Pause at the visibility boundary, before React commits.
        if (ratio < .5) entry.target.querySelector('video')?.pause();
      });
      setActiveId(getMostVisibleVideo(ratios));
    }, { root, threshold: [0, 0.25, 0.5, 0.75, 1] });
    root.querySelectorAll('[data-video-id]').forEach(element => observer.observe(element));
    return () => observer.disconnect();
  }, [videos]);

  useEffect(() => {
    if (videos.length > previousVideoCount.current) scans.current = 0;
    previousVideoCount.current = videos.length;
  }, [videos.length]);

  const fetchMore = useCallback(async (manual = false) => {
    if (!nextCursor || loading || loadingMore || (!manual && error) || loadLock.current) return;
    const cursor = typeof nextCursor === 'string' ? nextCursor : JSON.stringify(nextCursor);
    if (manual) { scans.current = 0; if (error) visitedCursors.current.delete(cursor); }
    if (visitedCursors.current.has(cursor)) return;
    loadLock.current = true;
    visitedCursors.current.add(cursor);
    scans.current += 1;
    try { await loadMore(); } finally { loadLock.current = false; }
  }, [loading, loadingMore, error, loadMore, nextCursor]);

  // Existing servers page through mixed posts. Bound empty searches rather
  // than fetching an entire archive invisibly when no video exists yet.
  useEffect(() => { if (!videos.length && scans.current < 3) fetchMore(); }, [videos.length, fetchMore, posts.length]);
  useEffect(() => {
    if (!videos.length || !canLoad) return undefined;
    const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting && scans.current < 3) fetchMore(); }, { root: rootRef.current, rootMargin: '240px 0px' });
    if (sentinelRef.current) observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [canLoad, fetchMore, videos.length, posts.length]);

  const retryFeed = () => { scans.current = 0; visitedCursors.current.clear(); refreshFeed(); };
  const move = direction => {
    const root = rootRef.current;
    if (direction > 0 && activeIndex === videos.length - 1 && nextCursor) { fetchMore(true); return; }
    const index = Math.min(videos.length - 1, Math.max(0, activeIndex + direction));
    const target = root?.querySelectorAll('[data-video-id]')[index];
    if (target) root.scrollTo({ top: root.scrollTop + target.getBoundingClientRect().top - root.getBoundingClientRect().top, behavior: reducedMotion ? 'auto' : 'smooth' });
    else if (direction > 0) fetchMore();
  };
  const requireLogin = () => { if (user) return true; navigate('/login', { state: { from: { pathname: '/feed', search: '?topic=Video' } } }); return false; };
  const save = async (post, saved) => {
    if (!requireLogin() || saving) return;
    const id = getVideoPostId(post); setSaving(id);
    try { await savePost(id, saved); if (mounted.current) setNotice(saved ? 'Video removed from saved.' : 'Video saved.'); }
    catch { if (mounted.current) setNotice('Couldn’t save this video. Please try again.'); }
    finally { if (mounted.current) setSaving(''); }
  };
  const openSafety = post => { if (requireLogin()) { setSafetyError(''); setSafety(post); } };
  const submitSafety = async (mode, reason) => {
    if (safetyBusy || !safety || !reason) return;
    const post = safety, postId = getVideoPostId(post), creatorId = getVideoCreatorId(post);
    if (mode === 'block' && creatorId === account) { setSafetyError('You cannot block yourself.'); return; }
    setSafetyBusy(true); setSafetyError('');
    const context = { postId, contentId: postId, contentType: 'post', source: 'video-feed', reason,
      contentSnapshot: { title: post.title, body: post.body, topic: post.topic, videoUrl: post.videoUrl, creatorName: getVideoCreatorName(post) } };
    try {
      if (mode === 'block') { await chatApi.blockUser(creatorId, context); if (mounted.current) blockCreator(creatorId); }
      else { await chatApi.reportUser({ ...context, reportedUserId: creatorId }); if (mounted.current) hidePost(postId); }
      if (mounted.current) { setSafety(null); setNotice(mode === 'block' ? 'Creator blocked. Their videos are hidden.' : 'Video reported and hidden while it is reviewed.'); }
    } catch { if (mounted.current) setSafetyError('Couldn’t send this request. Please try again.'); }
    finally { if (mounted.current) setSafetyBusy(false); }
  };

  return <main className="video-topic-page has-inner-feed">
    <FeedHeader topic="Video" onBack={() => navigate('/topics')} onOpenSearch={onOpenSearch}
      onSelect={topic => navigate('/feed?topic=' + encodeURIComponent(topic))} status={loading ? 'Loading videos' : `${videos.length} videos loaded`} />
    <div className="video-topic-tools"><span><Video size={15} />Ideas in motion</span><Link to="/create?topic=Video&type=video"><Plus size={16} />Upload video</Link></div>
    <section ref={rootRef} className="video-topic-scroll" aria-label="Video feed" tabIndex={0} onKeyDown={event => {
      if (event.target !== event.currentTarget || !['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp'].includes(event.key)) return;
      event.preventDefault(); move(['ArrowDown', 'PageDown'].includes(event.key) ? 1 : -1);
    }}>
      {videos.map((post, index) => <ReelVideo key={getVideoPostId(post)} post={post}
        active={getVideoPostId(post) === activeId && visible && !safety} nearby={Math.abs(index - activeIndex) <= 1}
        muted={muted} onMute={setMuted} onSave={save} onSafety={openSafety} busy={saving === getVideoPostId(post)}
        saved={Boolean(post.saved || post.isSaved || post.bookmarked || post.isBookmarked || post.savedByCurrentUser)} reducedMotion={reducedMotion} />)}
      {!videos.length && <div className="video-topic-state">
        <Video size={28} /><h2>{loading || loadingMore ? 'Finding videos…' : error ? 'Videos couldn’t load.' : nextCursor ? 'Keep exploring.' : 'A new way to share what you know.'}</h2>
        <p>{error ? 'Check your connection and try again.' : loading || loadingMore ? 'Bringing community ideas into view.' : nextCursor ? 'No videos in the newest posts. Look through older posts or share one of your own.' : 'Upload a video about something you learned. Community videos from every topic appear here.'}</p>
        {loading || loadingMore ? <LoaderCircle className="video-loading-icon" size={23} /> : error ? <button type="button" onClick={retryFeed}><RefreshCw size={16} />Try again</button> : <><Link to="/create?topic=Video&type=video"><Plus size={17} />Upload a video</Link>{nextCursor && <button type="button" onClick={() => fetchMore(true)}>Look for older videos</button>}</>}
      </div>}
      {videos.length > 0 && <div ref={sentinelRef} className="video-topic-end" role="status">
        {loadingMore ? <><LoaderCircle size={18} className="video-loading-icon" />Loading more videos…</> : error ? <><span>More videos couldn’t load.</span><button type="button" onClick={() => fetchMore(true)}>Try again</button></> : nextCursor ? <button type="button" onClick={() => fetchMore(true)}>Load more videos</button> : <><span>You’re all caught up.</span><Link to="/create?topic=Video&type=video">Share a video <Plus size={15} /></Link></>}
      </div>}
    </section>
    {videos.length > 1 && <nav className="video-topic-navigation" aria-label="Video navigation"><button type="button" disabled={activeIndex === 0} onClick={() => move(-1)} aria-label="Previous video"><ArrowUp size={19} /></button><span>{activeIndex + 1} / {videos.length}{nextCursor ? '+' : ''}</span><button type="button" disabled={activeIndex === videos.length - 1 && !nextCursor} onClick={() => move(1)} aria-label="Next video"><ArrowDown size={19} /></button></nav>}
    {notice && <div className="video-topic-notice" role="status">{notice}</div>}
    {safety && <VideoSafetyDialog post={safety} busy={safetyBusy} error={safetyError} onClose={() => { if (!safetyBusy) setSafety(null); }} onSubmit={submitSafety} />}
  </main>;
}
