import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, Check, ChevronLeft, Film, Frame, Globe2, Lock, Upload, X } from 'lucide-react';
import { postApi } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { useActionConfirmation } from '../components/ActionConfirmation';
import AppearanceSwitch from '../components/AppearanceSwitch';
import { VIDEO_TOPICS, getVideoTopic, videoFeedPath } from '../data/videoTopics';
import { EMPTY_POST, POST_LIMITS, hasPostDraft, readPostDraft, savePostDraft } from '../lib/postDraft';
import { normalizePostResponse } from '../lib/postResponse';
import { canPrepareVideo, prepareVideoUpload } from '../lib/prepareVideoUpload';
import { formatVideoTime } from '../lib/videoFeed';
import {
  VIDEO_INPUT_TYPES, captureVideoCover, normalizeVideoUpload, sendVideoAsset, validateStudioVideo, videoPostPayload, videoUploadType,
} from '../lib/videoPublishing';
import './VideoUploadPage.css';

const createRequestId = () => globalThis.crypto?.randomUUID?.() || `post-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
const SIZE = 1024 * 1024;
const stageText = { optimize: 'Preparing video', video: 'Uploading video', cover: 'Uploading cover', publish: 'Publishing video' };
const canCancel = stage => stage && stage !== 'publish';
const formatSize = size => size < SIZE ? `${Math.max(1, Math.round(size / 1024))} KB` : `${(size / SIZE).toFixed(1)} MB`;

function useFileUrl(file) {
  const [entry, setEntry] = useState(null);
  useEffect(() => {
    if (!file) { setEntry(null); return undefined; }
    const url = URL.createObjectURL(file);
    setEntry({ file, url });
    return () => URL.revokeObjectURL(url);
  }, [file]);
  return entry?.file === file ? entry?.url || '' : '';
}

export default function VideoUploadPage() {
  const { user } = useAuth();
  const [params] = useSearchParams();
  const account = user?.sub || user?.userId || user?.id || user?.email || 'guest';
  const fromCategory = getVideoTopic(params.get('category'))?.id || '';
  return <VideoStudio key={account} account={account} fromCategory={fromCategory} />;
}

function VideoStudio({ account, fromCategory }) {
  const navigate = useNavigate();
  const confirm = useActionConfirmation();
  const draftKey = 'video:' + account;
  const [draft, setDraft] = useState(() => {
    const stored = readPostDraft(draftKey);
    return { ...stored, topic: getVideoTopic(stored.topic)?.id || fromCategory };
  });
  const draftRef = useRef(draft);
  const draftTouched = useRef(false);
  const [file, setFile] = useState(null);
  const currentFile = useRef(null);
  const [cover, setCover] = useState(null);
  const [metadata, setMetadata] = useState(null);
  const [rights, setRights] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [stage, setStage] = useState('');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [coverNote, setCoverNote] = useState('');
  const [capturing, setCapturing] = useState(false);
  const [published, setPublished] = useState(null);
  const [saveWarning, setSaveWarning] = useState(false);
  const input = useRef(null);
  const preview = useRef(null);
  const active = useRef(null);
  const uploaded = useRef(new Map());
  const mounted = useRef(false);
  const requestId = useRef(null);
  const successHeading = useRef(null);
  const videoUrl = useFileUrl(file);
  const coverUrl = useFileUrl(cover);
  const topic = getVideoTopic(draft.topic);
  const ready = Boolean(file && metadata && draft.title.trim() && topic && rights);
  const busy = Boolean(stage);
  const backTo = videoFeedPath(fromCategory);

  const persist = () => !draftTouched.current || savePostDraft(draftKey, draftRef.current);
  useEffect(() => {
    mounted.current = true;
    const saveOnLeave = () => { persist(); };
    window.addEventListener('pagehide', saveOnLeave);
    return () => {
      mounted.current = false;
      saveOnLeave();
      active.current?.abort();
      active.current = null;
      window.removeEventListener('pagehide', saveOnLeave);
    };
  }, [draftKey]);
  useEffect(() => {
    if (published) successHeading.current?.focus();
  }, [published]);

  const update = (field, value) => {
    draftRef.current = { ...draftRef.current, [field]: value };
    draftTouched.current = true;
    setDraft(draftRef.current);
    setSaveWarning(!persist());
  };
  const changeFile = next => {
    uploaded.current.clear();
    currentFile.current = next;
    setFile(next); setMetadata(null); setCover(null); setCoverNote(''); setError(''); setRights(false);
  };
  const choose = files => {
    if (active.current || !files?.length) return;
    if (files.length !== 1) { setError('Choose one video at a time.'); return; }
    const picked = files[0];
    const problem = validateStudioVideo(picked);
    if (problem) { setError(problem); return; }
    const type = videoUploadType(picked);
    changeFile(picked.type === type ? picked : new File([picked], picked.name, { type, lastModified: picked.lastModified }));
  };
  const saveCover = async () => {
    const sourceFile = currentFile.current;
    if (!sourceFile || capturing || active.current) return;
    const video = preview.current;
    video?.pause();
    setCapturing(true);
    try {
      const result = await captureVideoCover(video);
      if (mounted.current && currentFile.current === sourceFile) {
        if (cover) uploaded.current.delete(cover);
        setCover(result);
        setCoverNote('Cover selected.');
      }
    } catch (err) {
      if (mounted.current && currentFile.current === sourceFile) setCoverNote(err.message || 'Couldn’t use that frame.');
    } finally {
      if (mounted.current) setCapturing(false);
    }
  };
  const goBack = async () => {
    if (active.current) return;
    if (file && !published && !await confirm({
      title: 'Leave video upload?',
      description: 'Your title, caption and topic stay on this device. You’ll need to choose the video again.',
      cancelLabel: 'Keep editing', confirmLabel: 'Back to videos',
    })) return;
    navigate(backTo, { replace: true });
  };
  const submit = async event => {
    event.preventDefault();
    if (!ready || capturing || active.current) return;
    const run = new AbortController();
    active.current = run;
    const isCurrent = () => mounted.current && active.current === run;
    const check = () => {
      if (!isCurrent() || run.signal.aborted) throw new DOMException('Upload cancelled', 'AbortError');
    };
    const step = value => { check(); setStage(value); setProgress(0); };
    const reportProgress = value => { if (isCurrent() && !run.signal.aborted) setProgress(value); };
    const upload = async (original, asset, kind) => {
      if (uploaded.current.has(original)) return uploaded.current.get(original);
      step(kind);
      const result = normalizeVideoUpload(await postApi.getUploadUrl({ fileName: asset.name, fileType: asset.type }, { signal: run.signal }));
      check();
      await sendVideoAsset(asset, result.uploadUrl, { signal: run.signal, onProgress: reportProgress });
      check();
      uploaded.current.set(original, result);
      return result;
    };
    setError('');
    requestId.current ||= createRequestId();
    try {
      let prepared = file;
      if (!uploaded.current.has(file) && canPrepareVideo(file)) {
        step('optimize');
        prepared = await prepareVideoUpload(file, { signal: run.signal, onProgress: reportProgress });
        check();
      }
      const video = await upload(file, prepared, 'video');
      const image = cover ? await upload(cover, cover, 'cover') : null;
      step('publish');
      normalizePostResponse(await postApi.createPost(videoPostPayload({ id: requestId.current, draft, topic, video, cover: image })));
      if (!isCurrent()) return;
      setPublished({ title: draft.title.trim(), topic, visibility: draft.visibility });
      draftRef.current = { ...EMPTY_POST };
      setSaveWarning(!persist());
      setDraft(draftRef.current);
      changeFile(null);
      requestId.current = null;
    } catch (err) {
      if (isCurrent()) setError(run.signal.aborted ? 'Upload stopped. Your draft is still here.' :
        err?.response ? 'Smarty couldn’t publish the video. Your draft is still here; try again.' : err.message || 'Couldn’t publish the video. Try again.');
    } finally {
      if (isCurrent()) { active.current = null; setStage(''); }
    }
  };

  return <section className="video-studio" aria-labelledby="video-studio-title">
    <header className="video-studio-nav">
      <button type="button" className="video-studio-back" disabled={busy} onClick={goBack}><ChevronLeft size={19} aria-hidden="true" />Back to videos</button>
      <AppearanceSwitch compact />
    </header>
    <div className="video-studio-heading">
      <h1 id="video-studio-title">Upload a video</h1>
      <p>Show how something works, demonstrate an idea, or teach a useful skill.</p>
    </div>
    {published ? <div className="video-studio-success">
      <Check aria-hidden="true" size={29} />
      <h2 tabIndex={-1} ref={successHeading}>{published.visibility === 'private' ? 'Private video saved' : 'Video published'}</h2>
      <p>{published.title}</p>
      <Link className="video-studio-publish" to={published.visibility === 'private' ? '/profile' : videoFeedPath(published.topic.id)}>
        {published.visibility === 'private' ? 'Go to profile' : 'View topic'}<ArrowRight size={17} aria-hidden="true" />
      </Link>
      <button type="button" className="video-studio-quiet" onClick={() => setPublished(null)}>Upload another</button>
    </div> : <form className="video-studio-form" onSubmit={submit} aria-busy={busy}>
      <section className="video-studio-media" aria-label="Video and cover">
        <input type="file" ref={input} accept={VIDEO_INPUT_TYPES} hidden disabled={busy} aria-label="Choose video file"
          onChange={event => { choose(event.target.files); event.target.value = ''; }} />
        <div className={'video-studio-frame' + (dragging ? ' is-dragging' : '')}
          onDragOver={event => { event.preventDefault(); if (!busy) setDragging(true); }}
          onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget)) setDragging(false); }}
          onDrop={event => { event.preventDefault(); setDragging(false); choose(event.dataTransfer.files); }}>
          {videoUrl ? <video key={videoUrl} src={videoUrl} ref={preview} controls playsInline preload="metadata" aria-label="Video preview"
            onLoadedMetadata={event => {
              const player = event.currentTarget;
              if (player.videoWidth && player.videoHeight && Number.isFinite(player.duration) && player.duration > 0) {
                setMetadata({ duration: player.duration, width: player.videoWidth, height: player.videoHeight });
              } else setError('This file has no playable video. Choose another clip.');
            }}
            onError={() => { setMetadata(null); setError('This device couldn’t play the file. Try an H.264 MP4.'); }} />
            : <button type="button" className="video-studio-choose" onClick={() => input.current?.click()}>
              <span><Film size={25} aria-hidden="true" /></span><strong>Choose a video</strong>
              <small>Or drop a file here</small>
            </button>}
        </div>
        <div className="video-studio-file-info">
          {file ? <><div><strong>{file.name}</strong><small>{formatSize(file.size)}{metadata && ` · ${formatVideoTime(metadata.duration)} · ${metadata.width} × ${metadata.height}`}</small></div>
            <button type="button" className="video-studio-quiet" disabled={busy} onClick={() => input.current?.click()}>Replace</button>
            <button type="button" className="video-studio-remove" aria-label="Remove video" disabled={busy} onClick={() => changeFile(null)}><X size={17} aria-hidden="true" /></button></>
            : <small>MP4, MOV, WebM or M4V · up to 250 MB</small>}
        </div>
        {file && <div className="video-studio-cover">
          {coverUrl ? <img src={coverUrl} alt="Selected video cover" /> : <Frame size={20} aria-hidden="true" />}
          <div><strong>Cover frame <small>Optional</small></strong>
            <p>Move to a frame in the preview, then use it as the cover.</p>
            {coverNote && <p role="status">{coverNote}</p>}</div>
          <button type="button" className="video-studio-quiet" disabled={!metadata || busy || capturing} onClick={saveCover}>Use frame</button>
          {cover && <button type="button" className="video-studio-remove" aria-label="Remove cover" disabled={busy} onClick={() => { uploaded.current.delete(cover); setCover(null); setCoverNote(''); }}><X size={16} aria-hidden="true" /></button>}
        </div>}
      </section>
      <div className="video-studio-details">
        <fieldset disabled={busy}>
          <legend>Video details</legend>
          <div className="video-studio-field"><label htmlFor="video-studio-name">Title</label><input required id="video-studio-name" placeholder="What will viewers learn?" maxLength={POST_LIMITS.title} value={draft.title} onChange={e => update('title', e.target.value)} /></div>
          <div className="video-studio-field"><label htmlFor="video-studio-caption">Caption <small>Optional</small></label><textarea id="video-studio-caption" rows={3} placeholder="Add context or credit your sources." maxLength={POST_LIMITS.body} value={draft.body} onChange={e => update('body', e.target.value)} /></div>
          <div className="video-studio-field"><label htmlFor="video-studio-topic">Video topic</label>
            <select required id="video-studio-topic" value={draft.topic} aria-describedby="video-studio-topic-note" onChange={e => update('topic', e.target.value)}>
              <option value="">Choose a topic</option>
              {VIDEO_TOPICS.map(item => <option value={item.id} key={item.id}>{item.label}</option>)}
            </select><small id="video-studio-topic-note">{topic?.detail || 'Viewers can browse by topic in Videos.'}</small></div>
        </fieldset>
        <fieldset className="video-studio-visibility" disabled={busy}>
          <legend>Who can watch?</legend>
          <label><input type="radio" name="video-audience" checked={draft.visibility === 'public'} onChange={() => update('visibility', 'public')} /><Globe2 size={17} aria-hidden="true" />Everyone</label>
          <label><input type="radio" name="video-audience" checked={draft.visibility === 'private'} onChange={() => update('visibility', 'private')} /><Lock size={17} aria-hidden="true" />Only me</label>
        </fieldset>
        <label className="video-studio-rights"><input type="checkbox" required disabled={busy} checked={rights} onChange={e => setRights(e.target.checked)} />I made this video or have permission to share it.</label>
        {error && <p className="video-studio-error" role="alert">{error}</p>}
        {stage && <div className="video-studio-progress" role="status"><span>{stageText[stage]}{stage !== 'publish' && ` · ${progress}%`}</span>
          <progress aria-label={stageText[stage]} max={100} value={stage === 'publish' ? undefined : progress} /></div>}
        <div className="video-studio-actions">
          <button type="submit" className="video-studio-publish" disabled={!ready || busy || capturing}><Upload size={17} aria-hidden="true" />{busy ? 'Working…' : draft.visibility === 'private' ? 'Save privately' : 'Publish video'}</button>
          {canCancel(stage) && <button type="button" className="video-studio-quiet" onClick={() => active.current?.abort()}>Stop upload</button>}
        </div>
        <p className="video-studio-draft" role="status">{saveWarning ? 'This device couldn’t save the text draft.' : hasPostDraft(draft) ? 'Text draft stays on this device. Video and cover aren’t saved in drafts.' : 'Add a playable clip, title and topic to publish.'}</p>
      </div>
    </form>}
  </section>;
}
