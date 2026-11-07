import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { Bookmark, Maximize, MessageCircle, MoreHorizontal, Pause, Play, RefreshCw, Volume2, VolumeX } from 'lucide-react';
import { Link } from 'react-router-dom';
import PostAuthor from './PostAuthor';
import { formatVideoTime, getPostVideoUrl, getVideoPostId } from '../lib/videoFeed';
import { hasBufferedOpening, hasPlaybackHeadroom, startReelPlayback } from '../lib/reelPlayback';
import NativeDownloadButton from './NativeDownloadButton';

export default memo(function ReelVideo({ post, active, nearby, preloadNext = 'none', muted = false, onMute, onSave, onSafety, onReload, saved, busy, reducedMotion, chromeHidden, onReveal, onPlayingChange, onHeadroom, onSkip }) {
  const videoRef = useRef(null);
  const activeRef = useRef(active);
  activeRef.current = active;
  const mutedRef = useRef(muted);
  mutedRef.current = muted;
  const playRequest = useRef(0);
  const [playing, setPlaying] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [failed, setFailed] = useState(false);
  const [duration, setDuration] = useState(0);
  const [position, setPosition] = useState(0);
  const [retry, setRetry] = useState(0);
  const [ready, setReady] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [failureMessage, setFailureMessage] = useState('');
  const [soundOff, setSoundOff] = useState(muted);
  const [openingBuffered, setOpeningBuffered] = useState(false);
  const openingReported = useRef(false);
  const mounted = useRef(true);
  const autoRenewed = useRef(false);
  const reloadLock = useRef(false);
  const reloadRef = useRef(onReload);
  reloadRef.current = onReload;
  const headroomReported = useRef(false);
  const id = getVideoPostId(post);
  const title = post.title || 'Community video';
  const source = getPostVideoUrl(post);
  const poster = getPostVideoUrl({ videoUrl: post.thumbUrl || post.imageUrl });

  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    setPlaying(false); setWaiting(false); setFailed(false); setReady(videoRef.current?.readyState >= 2);
    setDuration(0); setPosition(0); setFailureMessage('');
    openingReported.current = false;
    setOpeningBuffered(false);
  }, [source, retry, nearby]);

  const reloadSource = useCallback(async () => {
    if (reloadLock.current) return;
    reloadLock.current = true;
    setRefreshing(true);
    videoRef.current?.pause();
    try {
      // Media links can expire while an article remains in the feed cache.
      // Ask for current media rather than retrying an expired link forever.
      if (reloadRef.current) {
        const fresh = await reloadRef.current(id);
        if (!getPostVideoUrl(fresh)) throw new Error('Unavailable');
      }
      if (mounted.current) { setFailed(false); setWaiting(false); setReady(false); setRetry(value => value + 1); }
    } catch {
      if (mounted.current) { setFailed(true); setFailureMessage('The video could not be refreshed. Check your connection and try again.'); }
    } finally {
      reloadLock.current = false;
      if (mounted.current) setRefreshing(false);
    }
  }, [id]);

  const beginPlayback = useCallback((video, withMute, allowMutedFallback) => {
    const request = ++playRequest.current;
    const canPlayHere = () => activeRef.current && videoRef.current === video && document.visibilityState !== 'hidden';
    const isCurrent = () => playRequest.current === request && canPlayHere();
    setWaiting(video.readyState < 3);
    void startReelPlayback(video, { muted: withMute, allowMutedFallback, isCurrent }).then(started => {
      if (!canPlayHere()) video.pause();
      if (!isCurrent()) return;
      setSoundOff(video.muted);
      if (!started) { setPlaying(false); setWaiting(false); }
    });
  }, []);

  useEffect(() => {
    if (!active || !nearby || failed || refreshing || (ready && !waiting)) return undefined;
    const timer = window.setTimeout(() => {
      videoRef.current?.pause();
      setWaiting(false); setFailed(true);
      setFailureMessage('This video is taking too long to load. Check your connection or try the next video.');
    }, 18000);
    return () => window.clearTimeout(timer);
  }, [active, nearby, ready, waiting, failed, refreshing, retry, source]);

  const preparePreview = video => {
    if (!poster && video.paused && video.readyState >= 1 && video.currentTime === 0 && Number.isFinite(video.duration) && video.duration > 0) {
      video.currentTime = Math.min(.01, video.duration / 2);
    }
  };

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !active) return undefined;
    if (failed && reloadRef.current && video.error && !autoRenewed.current) {
      autoRenewed.current = true;
      void reloadSource();
    } else if (!reducedMotion && !failed && !refreshing) {
      beginPlayback(video, mutedRef.current, true);
    }
    const pause = () => { playRequest.current += 1; video.pause(); };
    const hidden = () => { if (document.visibilityState === 'hidden') pause(); };
    document.addEventListener('visibilitychange', hidden);
    window.addEventListener('pagehide', pause);
    return () => {
      pause();
      document.removeEventListener('visibilitychange', hidden);
      window.removeEventListener('pagehide', pause);
    };
  }, [active, nearby, retry, source, failed, refreshing, reducedMotion, beginPlayback, reloadSource]);
  useEffect(() => { headroomReported.current = false; }, [active, retry, source]);
  useEffect(() => { if (active) onPlayingChange?.(id, playing && !waiting); }, [active, id, playing, waiting, onPlayingChange]);

  // Release the decoder and download when a distant video leaves the window.
  useEffect(() => {
    const video = videoRef.current;
    return () => {
      if (!video) return;
      video.pause();
      // StrictMode rehearses effects without removing the element. Only
      // release a genuinely detached player, not the next active rehearsal.
      queueMicrotask(() => { if (!video.isConnected) { video.removeAttribute('src'); video.load(); } });
    };
  }, [nearby, retry]);

  const play = () => {
    onReveal?.();
    if (chromeHidden) return;
    const video = videoRef.current;
    if (!video || !active || failed) return;
    if (!video.paused) { playRequest.current += 1; video.pause(); return; }
    beginPlayback(video, video.muted, true);
  };

  const toggleSound = () => {
    const video = videoRef.current;
    if (!video || !active) return;
    const next = !video.muted;
    video.muted = next;
    setSoundOff(next);
    onMute(next);
    // Retry inside this exact tap if the browser required a gesture.
    if (!next && !failed) beginPlayback(video, false, false);
  };

  const fullscreen = () => {
    const video = videoRef.current;
    if (video?.webkitEnterFullscreen) video.webkitEnterFullscreen();
    else video?.requestFullscreen?.()?.catch(() => {});
  };

  const trackBuffer = video => {
    if (activeRef.current) {
      if (!headroomReported.current && hasPlaybackHeadroom(video)) {
        headroomReported.current = true;
        onHeadroom?.(id);
      }
    } else if (preloadNext === 'auto' && !openingReported.current && hasBufferedOpening(video)) {
      openingReported.current = true;
      setOpeningBuffered(true);
    }
  };

  return <article className={'reel-video' + (active ? ' is-active' : '')} data-video-id={id} aria-label={title} aria-hidden={!active} inert={!active ? '' : undefined}>
    <div className={'reel-video-stage' + (playing ? ' is-playing' : '')} aria-busy={active && (!ready || waiting || refreshing) && !failed}>
      {nearby ? <video key={retry} ref={videoRef} src={source} poster={poster || undefined}
        playsInline loop muted={soundOff || !active} preload={active ? 'auto' : openingBuffered && preloadNext === 'auto' ? 'metadata' : preloadNext} aria-label={title}
        onPlaying={event => {
          if (!activeRef.current || document.visibilityState === 'hidden') { event.currentTarget.pause(); return; }
          setPlaying(true); setWaiting(false); setReady(true);
          trackBuffer(event.currentTarget);
        }} onPause={() => { setPlaying(false); setWaiting(false); }}
        onVolumeChange={event => { if (activeRef.current) setSoundOff(event.currentTarget.muted); }}
        onWaiting={() => { if (activeRef.current) setWaiting(true); }} onCanPlay={() => { setReady(true); setWaiting(false); }}
        onLoadedMetadata={event => {
          const video = event.currentTarget;
          setDuration(video.duration); setFailed(false);
          // Reveal a real first frame on mobile Safari without a poster.
          if (reducedMotion) preparePreview(video);
        }}
        onProgress={event => trackBuffer(event.currentTarget)}
        onLoadedData={event => { setReady(true); trackBuffer(event.currentTarget); }}
        onTimeUpdate={event => {
          const video = event.currentTarget;
          setPosition(Math.floor(video.currentTime * 4) / 4);
          trackBuffer(video);
        }}
        onError={() => {
          setFailed(true); setWaiting(false); setPlaying(false);
          setFailureMessage('It may be unavailable or use a format this device cannot play.');
          if (activeRef.current && onReload && !autoRenewed.current) { autoRenewed.current = true; reloadSource(); }
        }} />
        : <div className="reel-video-placeholder" aria-hidden="true">{poster && <img src={poster} alt="" loading="lazy" />}<Play size={30} /></div>}
      {!failed && !refreshing && <button type="button" className="reel-video-tap" onClick={play} tabIndex={active ? 0 : -1}
        aria-label={chromeHidden ? 'Show video controls' : playing ? 'Pause video' : 'Play video'} aria-pressed={chromeHidden ? undefined : playing}>
        {!playing && !waiting && ready && <span><Play size={28} fill="currentColor" /><small>{soundOff ? 'Play video' : 'Play with sound'}</small></span>}
      </button>}
      {active && (refreshing || ((!ready || waiting) && !failed)) && <span className="reel-video-buffer" role="status"><span />{refreshing ? 'Reconnecting video…' : 'Buffering video…'}</span>}
      {failed && !refreshing && <div className="reel-video-error" role="status"><Play size={26} /><strong>This video couldn’t play.</strong>
        <p>{failureMessage || 'Check your connection and try again.'}</p>
        <div className="reel-video-recovery">
          <button type="button" onClick={reloadSource}><RefreshCw size={16} />Retry video</button>
          {onSkip && <button type="button" onClick={onSkip}>Next video</button>}
        </div>
      </div>}
      <div className="reel-video-top"><span>{post.topic || 'Video'}</span><button type="button" onClick={toggleSound} aria-label={soundOff ? 'Turn sound on' : 'Mute video'}>{soundOff ? <VolumeX size={19} /> : <Volume2 size={19} />}</button></div>
      <div className="reel-video-bottom">
        <div className="reel-video-copy">
          <PostAuthor post={post} className="reel-video-author" resolve={nearby} />
          <h2>{title}</h2>
          {post.body && <details className="reel-video-caption"><summary>About this video</summary><p>{post.body}</p></details>}
        </div>
        <div className="reel-video-actions" role="group" aria-label="Video actions">
          {post.downloadAllowed !== false && <NativeDownloadButton iconOnly label="Download video" payload={{kind:'video',sourceId:id,title,url:source}}/>}
          <button type="button" onClick={() => onSave(post, saved)} disabled={busy} aria-label={saved ? 'Unsave video' : 'Save video'} aria-pressed={saved}><Bookmark size={21} fill={saved ? 'currentColor' : 'none'} /></button>
          <Link to={'/comments/' + encodeURIComponent(id)} state={{ post }} aria-label="View video comments"><MessageCircle size={21} /></Link>
          <button type="button" onClick={fullscreen} aria-label="View fullscreen"><Maximize size={20} /></button>
          <button type="button" onClick={() => onSafety(post)} aria-label="Video safety options"><MoreHorizontal size={21} /></button>
        </div>
        <div className="reel-video-playback">
          <button type="button" onClick={play} disabled={failed} aria-label={playing ? 'Pause video' : 'Play video'}>{playing ? <Pause size={16} /> : <Play size={16} />}</button>
          <input type="range" min="0" max={Number.isFinite(duration) ? duration : 0} step="0.1" value={Math.min(position, Number.isFinite(duration) ? duration : 0)}
            disabled={!active || !duration || failed} aria-label="Seek video" aria-valuetext={formatVideoTime(position) + ' of ' + formatVideoTime(duration)}
            onChange={event => { if (videoRef.current) videoRef.current.currentTime = Number(event.target.value); setPosition(Number(event.target.value)); }} />
          <span>{formatVideoTime(position)} / {formatVideoTime(duration)}</span>
        </div>
      </div>
    </div>
  </article>;
});
