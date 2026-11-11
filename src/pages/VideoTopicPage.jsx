import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowDown, ArrowUp, Flag, Plus, RefreshCw, UserX, Video, X } from 'lucide-react';
import FeedHeader from '../components/FeedHeader';
import ReelVideo from '../components/ReelVideo';
import { useAuth } from '../contexts/AuthContext';
import useFeed from '../hooks/useFeed';
import useVideoChrome from '../hooks/useVideoChrome';
import { chatApi, postApi } from '../api/client';
import { getVideoCreatorId, getVideoCreatorName, getVideoPostId, getVideoPosts, nextVideoPreload, shouldDiscoverMoreVideos, videoFeedWarmPreload, videoIndexAtScroll } from '../lib/videoFeed';
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

function VideoFeed({ onOpenSearch, account, user, selected = true }) {
  const navigate = useNavigate();
  const { posts, loading, refreshing, loadingMore, error, nextCursor, loadMore, refreshFeed, refreshPost, savePost, hidePost, blockCreator } = useFeed({ videoOnly: true });
  const videos = useMemo(() => getVideoPosts(posts), [posts]);
  const rootRef = useRef(null);
  const pageRef = useRef(null);
  const indexRef = useRef(0);
  const heightRef = useRef(0);
  const pendingAdvance = useRef(null);
  const warmLookahead = useRef(false);
  const mounted = useRef(true);
  const wasSelected = useRef(selected);
  const [index, setIndex] = useState(0);
  const [playingId, setPlayingId] = useState('');
  const [bufferedId, setBufferedId] = useState('');
  const [muted, setMuted] = useState(false);
  const [visible, setVisible] = useState(() => document.visibilityState !== 'hidden');
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState('');
  const [safety, setSafety] = useState(null);
  const [safetyBusy, setSafetyBusy] = useState(false);
  const [safetyError, setSafetyError] = useState('');
  const activeIndex = Math.max(0, Math.min(index, videos.length - 1));
  const activeId = getVideoPostId(videos[activeIndex]);
  const connection = navigator.connection;
  const warmMode = !selected && visible ? videoFeedWarmPreload(connection) : 'none';
  const busy = loading || refreshing || loadingMore;
  const looking = busy || Boolean(nextCursor && !error);
  const activePlaying = Boolean(selected && activeId && playingId === activeId && visible && !safety);
  const { idle, reveal } = useVideoChrome(pageRef, activeId, activePlaying);
  const updatePlaying = useCallback((id, playing) => {
    setPlayingId(previous => playing ? id : previous === id ? '' : previous);
  }, []);

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
    const justOpened = selected && !wasSelected.current;
    wasSelected.current = selected;
    if (justOpened && error && !videos.length) void refreshFeed(true);
  }, [error, refreshFeed, selected, videos.length]);

  const scrollToClip = useCallback((clip, smooth = true) => {
    const root = rootRef.current;
    if (!root || !heightRef.current) return;
    root.scrollTo({ top: heightRef.current * clip, behavior: smooth && !reducedMotion ? 'smooth' : 'instant' });
  }, [reducedMotion]);
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!selected || !root) return undefined;
    const measure = () => {
      const height = root.getBoundingClientRect().height;
      if (!height || height === heightRef.current) return;
      heightRef.current = height;
      root.scrollTo({ top: heightRef.current * indexRef.current, behavior: 'instant' });
    };
    heightRef.current = 0;
    measure();
    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(measure);
      observer.observe(root);
      return () => observer.disconnect();
    }
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [selected]);
  useLayoutEffect(() => {
    const lastIndex = Math.max(0, videos.length - 1);
    if (indexRef.current > lastIndex) {
      indexRef.current = lastIndex;
      setIndex(indexRef.current);
      if (selected) scrollToClip(indexRef.current, false);
    }
    if (!selected || pendingAdvance.current === null) return;
    if (videos.length > pendingAdvance.current) {
      const target = pendingAdvance.current;
      pendingAdvance.current = null;
      scrollToClip(target);
    } else if (!nextCursor && !busy) pendingAdvance.current = null;
  }, [videos.length, nextCursor, busy, selected, scrollToClip]);

  // Advance across empty cursor pages at the tail. While hidden, look ahead
  // just once on a fast link if the opening page couldn't fill both players.
  useEffect(() => {
    const warmMore = warmMode === 'auto' && !warmLookahead.current && videos.length < 2 && nextCursor && !busy && !error;
    if (!warmMore && !shouldDiscoverMoreVideos({ selected, visible, hasCursor: Boolean(nextCursor), busy, error, activeIndex, count: videos.length })) return undefined;
    const timer = window.setTimeout(() => {
      if (warmMore) warmLookahead.current = true;
      void loadMore();
    }, 180);
    return () => window.clearTimeout(timer);
  }, [selected, visible, nextCursor, busy, error, activeIndex, videos.length, loadMore, warmMode]);

  const onScroll = event => {
    if (!selected || !heightRef.current) return;
    const root = event.currentTarget;
    const next = videoIndexAtScroll(root.scrollTop, heightRef.current, videos.length);
    if (next === indexRef.current) return;
    root.children[indexRef.current]?.querySelector('video')?.pause();
    indexRef.current = next;
    pendingAdvance.current = null;
    setIndex(next);
  };
  const retryFeed = () => { if (nextCursor) void loadMore(); else void refreshFeed(true); };
  const move = direction => {
    reveal();
    if (direction > 0 && activeIndex === videos.length - 1 && nextCursor) {
      pendingAdvance.current = videos.length;
      if (!busy) void loadMore();
      return;
    }
    scrollToClip(Math.min(videos.length - 1, Math.max(0, activeIndex + direction)));
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
      postApi.invalidateVideoFeed();
      if (mounted.current) { setSafety(null); setNotice(mode === 'block' ? 'Creator blocked. Their videos are hidden.' : 'Video reported and hidden while it is reviewed.'); }
    } catch { if (mounted.current) setSafetyError('Couldn’t send this request. Please try again.'); }
    finally { if (mounted.current) setSafetyBusy(false); }
  };

  return <main ref={pageRef} data-prewarming={!selected ? '' : undefined} aria-hidden={!selected || undefined} inert={!selected ? '' : undefined}
    className={'video-topic-page has-inner-feed' + (idle ? ' is-video-idle' : '')}
    onPointerMove={event => { if (!idle && event.pointerType === 'mouse') reveal(); }}
    onFocusCapture={event => { if (event.target.matches(':focus-visible')) reveal(); }}>
    <FeedHeader topic="Video" onBack={() => navigate('/topics')} onOpenSearch={onOpenSearch}
      onSelect={topic => navigate('/feed?topic=' + encodeURIComponent(topic))} status={loading ? 'Loading videos' : `${videos.length} videos loaded`} />
    <div className="video-topic-tools"><Link to="/create?topic=Video&type=video" aria-label="Upload video"><Plus size={20} /><span>Upload</span></Link></div>
    <section ref={rootRef} className="video-topic-scroll" aria-label="Video feed" tabIndex={0} onScroll={onScroll} onKeyDown={event => {
      if (event.target !== event.currentTarget || !['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp'].includes(event.key)) return;
      event.preventDefault(); move(['ArrowDown', 'PageDown'].includes(event.key) ? 1 : -1);
    }}>
      {videos.map((post, clipIndex) => {
        const id = getVideoPostId(post);
        const isCurrent = clipIndex === activeIndex;
        const isNext = (selected || warmMode === 'auto') && visible && !safety && clipIndex === activeIndex + 1;
        const nearby = isCurrent || isNext || (selected && clipIndex === activeIndex - 1);
        if (!nearby) return <div key={id} className="reel-video reel-video-slot" data-video-id={id} aria-hidden="true" />;
        const nextHint = isNext ? nextVideoPreload(post, connection) : 'none';
        const preload = isCurrent ? warmMode : nextHint === 'auto' && bufferedId !== activeId ? 'metadata' : nextHint;
        return <ReelVideo key={id} post={post}
          active={selected && id === activeId && visible && !safety}
          nearby preloadNext={preload}
          chromeHidden={idle && isCurrent} onReveal={reveal} onPlayingChange={updatePlaying} onHeadroom={isCurrent ? setBufferedId : undefined}
          onSkip={clipIndex < videos.length - 1 || nextCursor ? () => move(1) : undefined}
          muted={muted} onMute={setMuted} onSave={save} onSafety={openSafety} onReload={refreshPost} busy={saving === id}
          saved={Boolean(post.saved || post.isSaved || post.bookmarked || post.isBookmarked || post.savedByCurrentUser)} reducedMotion={reducedMotion} />;
      })}
      {!videos.length && (looking ? <div className="video-topic-preview" aria-busy="true"><span className="feed-view-route-label" role="status">Preparing the video feed</span></div>
        : <div className="video-topic-state">
          <Video size={28} /><h2>{error ? 'Videos couldn’t load.' : 'No videos to show yet'}</h2>
          <p>{error ? 'Check your connection and try again.' : 'Upload a video about something you learned. Community videos from every topic appear here.'}</p>
          {error ? <button type="button" onClick={retryFeed}><RefreshCw size={16} />Try again</button> : <Link to="/create?topic=Video&type=video"><Plus size={17} />Upload a video</Link>}
        </div>)}
    </section>
    {videos.length > 0 && activeIndex >= videos.length - 2 && nextCursor && error && <div className="video-topic-tail" role="status">
      <span>More videos couldn’t load.</span><button type="button" onClick={retryFeed}>Retry</button>
    </div>}
    {(videos.length > 1 || (videos.length > 0 && nextCursor)) && <nav className="video-topic-navigation" aria-label="Video navigation"><button type="button" disabled={activeIndex === 0} onClick={() => move(-1)} aria-label="Previous video"><ArrowUp size={19} /></button><button type="button" disabled={activeIndex === videos.length - 1 && !nextCursor} onClick={() => move(1)} aria-label="Next video"><ArrowDown size={19} /></button></nav>}
    {notice && <div className="video-topic-notice" role="status">{notice}</div>}
    {safety && <VideoSafetyDialog post={safety} busy={safetyBusy} error={safetyError} onClose={() => { if (!safetyBusy) setSafety(null); }} onSubmit={submitSafety} />}
  </main>;
}
