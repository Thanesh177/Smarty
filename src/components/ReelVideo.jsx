import { memo, useEffect, useRef, useState } from 'react';
import { Bookmark, Maximize, MessageCircle, MoreHorizontal, Pause, Play, RefreshCw, Volume2, VolumeX } from 'lucide-react';
import { Link } from 'react-router-dom';
import PostAuthor from './PostAuthor';
import { formatVideoTime, getPostVideoUrl, getVideoPostId } from '../lib/videoFeed';

export default memo(function ReelVideo({ post, active, nearby, muted = false, onMute, onSave, onSafety, saved, busy }) {
  const videoRef = useRef(null);
  const activeRef = useRef(active);
  activeRef.current = active;
  const [playing, setPlaying] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [failed, setFailed] = useState(false);
  const [duration, setDuration] = useState(0);
  const [position, setPosition] = useState(0);
  const [retry, setRetry] = useState(0);
  const id = getVideoPostId(post);
  const title = post.title || 'Community video';
  const source = getPostVideoUrl(post);
  const poster = getPostVideoUrl({ videoUrl: post.thumbUrl || post.imageUrl });

  const preparePreview = video => {
    if (!poster && video.paused && video.readyState >= 1 && video.currentTime === 0 && Number.isFinite(video.duration) && video.duration > 0) {
      video.currentTime = Math.min(.01, video.duration / 2);
    }
  };

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return undefined;
    video.muted = muted;
    // Every clip starts on a preview. Sound-enabled playback needs a gesture.
    if (!active) video.pause();
    preparePreview(video);
    const hidden = () => { if (document.visibilityState === 'hidden') video.pause(); };
    const pause = () => video.pause();
    document.addEventListener('visibilitychange', hidden);
    window.addEventListener('pagehide', pause);
    return () => {
      video.pause();
      document.removeEventListener('visibilitychange', hidden);
      window.removeEventListener('pagehide', pause);
    };
  }, [active, nearby, retry, source, poster]);

  useEffect(() => { if (videoRef.current) videoRef.current.muted = muted; }, [muted]);

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
    const video = videoRef.current;
    if (!video || !active || failed) return;
    if (!video.paused) { video.pause(); return; }
    setWaiting(true);
    video.muted = muted;
    video.play()?.then(() => { if (!activeRef.current || document.visibilityState === 'hidden') video.pause(); })
      .catch(() => { setPlaying(false); setWaiting(false); });
  };

  const toggleSound = () => {
    const video = videoRef.current;
    if (video) video.muted = !muted;
    onMute(!muted);
    // Keep this inside the gesture, including on iOS with sound enabled.
    if (video && active && !video.paused) video.play()?.catch(() => setPlaying(false));
  };

  const fullscreen = () => {
    const video = videoRef.current;
    if (video?.webkitEnterFullscreen) video.webkitEnterFullscreen();
    else video?.requestFullscreen?.()?.catch(() => {});
  };

  return <article className={'reel-video' + (active ? ' is-active' : '')} data-video-id={id} aria-label={title}>
    <div className="reel-video-stage">
      {nearby ? <video key={retry} ref={videoRef} src={source} poster={poster || undefined}
        playsInline loop muted={muted} preload={active ? 'auto' : 'metadata'} aria-label={title}
        onPlaying={event => {
          if (!activeRef.current || document.visibilityState === 'hidden') { event.currentTarget.pause(); return; }
          setPlaying(true); setWaiting(false);
        }} onPause={() => { setPlaying(false); setWaiting(false); }}
        onWaiting={() => setWaiting(true)} onCanPlay={() => setWaiting(false)}
        onLoadedMetadata={event => {
          const video = event.currentTarget;
          setDuration(video.duration); setFailed(false);
          // Reveal a real first frame on mobile Safari without a poster.
          preparePreview(video);
        }}
        onLoadedData={event => preparePreview(event.currentTarget)}
        onTimeUpdate={event => setPosition(Math.floor(event.currentTarget.currentTime))}
        onError={() => { setFailed(true); setWaiting(false); setPlaying(false); }} />
        : <div className="reel-video-placeholder" aria-hidden="true">{poster && <img src={poster} alt="" loading="lazy" />}<Play size={30} /></div>}
      {!failed && <button type="button" className="reel-video-tap" onClick={play} tabIndex={active ? 0 : -1}
        aria-label={playing ? 'Pause video' : 'Play video'} aria-pressed={playing}>
        {!playing && !waiting && <span><Play size={30} fill="currentColor" /><small>{muted ? 'Tap to play' : 'Play with sound'}</small></span>}
      </button>}
      {waiting && active && !failed && <span className="reel-video-buffer" role="status"><span />Loading video…</span>}
      {failed && <div className="reel-video-error" role="status"><Play size={26} /><strong>This video couldn’t play.</strong>
        <p>It may be unavailable or use a format this device can’t play.</p>
        <button type="button" onClick={() => { setFailed(false); setWaiting(false); setRetry(value => value + 1); }}><RefreshCw size={16} />Try again</button>
      </div>}
      <div className="reel-video-top"><span>{post.topic || 'Video'}</span><button type="button" onClick={toggleSound} aria-label={muted ? 'Turn sound on' : 'Mute video'}>{muted ? <VolumeX size={19} /> : <Volume2 size={19} />}</button></div>
      <div className="reel-video-bottom">
        <div className="reel-video-copy">
          <PostAuthor post={post} className="reel-video-author" resolve={nearby} />
          <h2>{title}</h2>
          {post.body && <details className="reel-video-caption"><summary>About this video</summary><p>{post.body}</p></details>}
        </div>
        <div className="reel-video-actions" role="group" aria-label="Video actions">
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
