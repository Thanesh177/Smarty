import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import imageCompression from 'browser-image-compression';
import {
  ArrowUpRight,
  Eye,
  ChevronDown,
  PenLine,
  Check,
  Globe2,
  ImagePlus,
  Lock,
  Plus,
  Search,
  Send,
  X,
  Video,
} from 'lucide-react';
import { postApi } from '../api/client';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { EMPTY_POST, hasPostDraft, postReadingStats, readPostDraft, savePostDraft, validatePostMedia } from '../lib/postDraft';
import { isVideoTopic, validateVideoUpload } from '../lib/videoFeed';
import { normalizePostResponse } from '../lib/postResponse';
import { getPostAuthorUsername } from '../lib/postAuthor';
import './CreatePostComposer.css';
const createSafeId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `post-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
};

const compressImage = async (file) => {
  const type = String(file?.type || '').toLowerCase();

  if (!file || !type.startsWith('image/')) return file;
  if (type === 'image/gif' || type === 'image/svg+xml') return file;
  if (file.size <= 350 * 1024) return file;

  const options = {
    maxSizeMB: 0.35,
    maxWidthOrHeight: 1200,
    useWebWorker: true,
    fileType: 'image/webp',
    initialQuality: 0.75,
    alwaysKeepResolution: false,
  };

  const compressedBlob = await imageCompression(file, options);

  if (!compressedBlob || compressedBlob.size >= file.size) return file;

  return new File(
    [compressedBlob],
    file.name.replace(/\.[^/.]+$/, '.webp'),
    {
      type: 'image/webp',
      lastModified: Date.now(),
    }
  );
};

const parseApiErrorMessage = (err) => {
  const data = err?.response?.data;

  if (typeof data === 'string') {
    try {
      const parsed = JSON.parse(data);
      return parsed?.message || parsed?.error || data;
    } catch {
      return data;
    }
  }

  return (
    data?.message ||
    data?.error ||
    err?.message ||
    'Something went wrong.'
  );
};


const normalizeUploadResponse = (uploadData = {}) => {
  const parsed = typeof uploadData?.body === 'string'
    ? (() => {
        try {
          return JSON.parse(uploadData.body);
        } catch {
          return uploadData;
        }
      })()
    : uploadData;

  return {
    uploadUrl: parsed.uploadUrl || parsed.url || parsed.presignedUrl || '',
    fileUrl: parsed.fileUrl || parsed.publicUrl || '',
    key: parsed.key || parsed.fileKey || parsed.imageKey || parsed.videoKey || '',
  };
};

const DEFAULT_TOPICS = [
  'Video',
  'Science',
  'Psychology',
  'Health',
  'Technology',
  'Finance',
  'History',
  'Study Tips',
  'General Knowledge',
];

const normalizeTopicsResponse = (data) => {
  const parsed = typeof data?.body === 'string'
    ? (() => {
        try {
          return JSON.parse(data.body);
        } catch {
          return data;
        }
      })()
    : data;

  const rawTopics = Array.isArray(parsed?.topics)
    ? parsed.topics
    : Array.isArray(parsed?.items)
      ? parsed.items
      : Array.isArray(parsed?.data)
        ? parsed.data
        : Array.isArray(parsed)
          ? parsed
          : [];

  const topicList = Array.from(
    new Set(
      rawTopics
        .map((item) => {
          if (typeof item === 'string') return item;
          return (
            item?.topic ||
            item?.topicName ||
            item?.name ||
            item?.title ||
            item?.category ||
            item?.id ||
            ''
          );
        })
        .map((item) => String(item || '').trim())
        .filter(Boolean)
    )
  ).sort((a, b) => a.localeCompare(b));

  return topicList.length ? [...new Set(['Video', ...topicList])] : DEFAULT_TOPICS;
};

const cleanTopic = (value) => String(value || '')
  .replace(/[\u0000-\u001f\u007f]/g, '')
  .replace(/\s+/g, ' ')
  .trim()
  .slice(0, 60);

const topicKey = (value) => cleanTopic(value).toLocaleLowerCase();


export default function CreatePostPage() {
  const { user } = useAuth();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const videoMode = params.get('type') === 'video' || isVideoTopic(params.get('topic'));
  const account = user?.userId || user?.sub || user?.id || user?.email || 'guest';
  return <PostComposer key={`${account}:${videoMode}`} account={account} user={user} videoMode={videoMode} />;
}

function PostComposer({ account, user, videoMode }) {
  const [form, setForm] = useState(() => {
    const draft = readPostDraft(account);
    return videoMode && !draft.topic.trim() ? { ...draft, topic: 'Video' } : draft;
  });
  const [draftState, setDraftState] = useState(() => hasPostDraft(form) ? 'restored' : 'empty');
  const [topics, setTopics] = useState(DEFAULT_TOPICS);
  const [topicState, setTopicState] = useState('loading');
  const [topicOpen, setTopicOpen] = useState(false);
  const [activeTopic, setActiveTopic] = useState(-1);
  const [view, setView] = useState('write');
  const [media, setMedia] = useState(null);
  const [mediaUrl, setMediaUrl] = useState('');
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState('');
  const [mediaError, setMediaError] = useState('');
  const [videoPlayable, setVideoPlayable] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState('');
  const [published, setPublished] = useState(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const mounted = useRef(true);
  const upload = useRef(null);
  const submittingRef = useRef(false);
  const latestForm = useRef(form);
  const saveTimer = useRef(null);
  const pendingSave = useRef(false);
  const topicShell = useRef(null);
  const topicInput = useRef(null);
  const fileInput = useRef(null);
  const bodyInput = useRef(null);
  const successHeading = useRef(null);
  const uploadCache = useRef(null);
  const requestId = useRef(createSafeId());
  const stats = useMemo(() => postReadingStats(form.body), [form.body]);
  const exactTopic = topics.find(topic => topicKey(topic) === topicKey(form.topic));
  const selectedTopic = exactTopic || cleanTopic(form.topic);
  const matches = useMemo(() => topics.filter(topic => topicKey(topic).includes(topicKey(form.topic)))
    .sort((a, b) => Number(topicKey(b).startsWith(topicKey(form.topic))) - Number(topicKey(a).startsWith(topicKey(form.topic))))
    .slice(0, 6), [topics, form.topic]);
  const canCreate = selectedTopic.length >= 2 && !exactTopic;
  const choices = canCreate ? [...matches, selectedTopic] : matches;
  const isVideo = Boolean(media?.type.startsWith('video/'));
  const ready = selectedTopic.length >= 2 && form.title.trim() && (isVideo ? videoPlayable : form.body.trim()) && (!videoMode || isVideo);
  const name = getPostAuthorUsername(null, user);

  const persist = useCallback(() => {
    window.clearTimeout(saveTimer.current);
    if (!pendingSave.current) return;
    const ok = savePostDraft(account, latestForm.current);
    if (ok) pendingSave.current = false;
    if (mounted.current) setDraftState(ok ? hasPostDraft(latestForm.current) ? 'saved' : 'empty' : 'error');
  }, [account]);
  useEffect(() => {
    mounted.current = true;
    const hidden = () => { if (document.visibilityState === 'hidden') persist(); };
    window.addEventListener('pagehide', persist);
    document.addEventListener('visibilitychange', hidden);
    return () => {
      mounted.current = false;
      persist();
      upload.current?.abort();
      window.removeEventListener('pagehide', persist);
      document.removeEventListener('visibilitychange', hidden);
    };
  }, [persist]);
  useEffect(() => {
    let active = true;
    postApi.getTopics().then(data => {
      if (active) { setTopics(normalizeTopicsResponse(data)); setTopicState('ready'); }
    }).catch(() => { if (active) setTopicState('fallback'); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (!media) { setMediaUrl(''); return; }
    const url = URL.createObjectURL(media);
    setMediaUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [media]);
  useEffect(() => {
    const close = event => { if (!topicShell.current?.contains(event.target)) { setTopicOpen(false); setActiveTopic(-1); } };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, []);
  useEffect(() => {
    if (activeTopic >= 0) document.getElementById('composer-topic-' + activeTopic)?.scrollIntoView({ block: 'nearest' });
  }, [activeTopic]);
  useEffect(() => {
    if (!bodyInput.current || view !== 'write') return;
    bodyInput.current.style.height = 'auto';
    bodyInput.current.style.height = Math.min(680, Math.max(240, bodyInput.current.scrollHeight)) + 'px';
  }, [form.body, view]);
  useEffect(() => { if (published) successHeading.current?.focus(); }, [published]);

  const change = (field, value) => {
    latestForm.current = { ...latestForm.current, [field]: value };
    pendingSave.current = true;
    setForm(latestForm.current);
    setError('');
    setDraftState('saving');
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(persist, 450);
  };
  const chooseTopic = topic => {
    change('topic', cleanTopic(topic));
    topicInput.current?.focus();
    setTopicOpen(false);
    setActiveTopic(-1);
  };
  const topicKeys = event => {
    if (['Escape', 'Tab'].includes(event.key)) { setTopicOpen(false); setActiveTopic(-1); }
    if (['ArrowDown', 'ArrowUp'].includes(event.key)) {
      event.preventDefault(); setTopicOpen(true);
      setActiveTopic(current => choices.length ? current < 0 ? event.key === 'ArrowDown' ? 0 : choices.length - 1 : (current + (event.key === 'ArrowDown' ? 1 : -1) + choices.length) % choices.length : -1);
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      if (topicOpen && activeTopic >= 0 && choices[activeTopic]) chooseTopic(choices[activeTopic]);
      else if (selectedTopic.length >= 2) chooseTopic(selectedTopic);
    }
  };
  const selectMedia = files => {
    if (submittingRef.current || !files?.length) return;
    if (files.length > 1) { setMediaError('Add one image or video at a time.'); return; }
    const message = validatePostMedia(files[0]) || ((videoMode || files[0].type.startsWith('video/')) ? validateVideoUpload(files[0]) : '');
    if (message) { setMediaError(message); return; }
    setVideoPlayable(false); setMedia(files[0]); uploadCache.current = null; setMediaError(''); setError('');
  };
  const clearDraft = () => {
    latestForm.current = { ...EMPTY_POST, topic: videoMode ? 'Video' : '' }; setForm(latestForm.current);
    pendingSave.current = true;
    setMedia(null); uploadCache.current = null; requestId.current = createSafeId();
    setError(''); setMediaError(''); setConfirmClear(false); setView('write'); setTopicOpen(false); persist();
  };
  const uploadMedia = async file => {
    if (uploadCache.current?.file === file) return uploadCache.current.result;
    setStage('Preparing attachment…');
    let prepared = file;
    try { prepared = await compressImage(file); } catch { /* Keep the original if this device cannot compress it. */ }
    if (!mounted.current) throw new Error('Upload cancelled.');
    const result = normalizeUploadResponse(await postApi.getUploadUrl({ fileName: prepared.name, fileType: prepared.type }));
    if (!mounted.current) throw new Error('Upload cancelled.');
    if (!result.uploadUrl || (!result.fileUrl && !result.key)) throw new Error('Could not prepare the attachment. Please try again.');
    setStage('Uploading attachment…');
    await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest(); upload.current = xhr;
      xhr.upload.onprogress = event => { if (event.lengthComputable && mounted.current) setProgress(Math.round(event.loaded / event.total * 100)); };
      const fail = message => { upload.current = null; reject(new Error(message)); };
      xhr.onload = () => { upload.current = null; xhr.status >= 200 && xhr.status < 300 ? resolve() : fail('The attachment could not be uploaded. Please try again.'); };
      xhr.onerror = () => fail('Upload interrupted. Check your connection and try again.');
      xhr.ontimeout = () => fail('Upload timed out. Try a smaller file or a stronger connection.');
      xhr.onabort = () => fail('Upload cancelled.');
      xhr.open('PUT', result.uploadUrl); xhr.timeout = 180000;
      xhr.setRequestHeader('Content-Type', prepared.type); xhr.send(prepared);
    });
    uploadCache.current = { file, result };
    return result;
  };
  const submit = async event => {
    event.preventDefault();
    if (submittingRef.current || !ready) return;
    submittingRef.current = true; setSubmitting(true); setTopicOpen(false); setError(''); setProgress(0); setStage('Publishing your post…'); persist();
    try {
      const attachment = media ? await uploadMedia(media) : {};
      if (!mounted.current) return;
      setStage('Publishing your post…');
      const image = media?.type.startsWith('image/');
      const video = media?.type.startsWith('video/');
      const response = await postApi.createPost({
        id: requestId.current, topic: selectedTopic, title: form.title.trim(), body: form.body.trim() || form.title.trim(), likes: 0, visibility: form.visibility,
        imageUrl: image ? attachment.fileUrl : '', imageKey: image ? attachment.key : '',
        thumbUrl: image ? attachment.fileUrl : '', thumbKey: image ? attachment.key : '',
        videoUrl: video ? attachment.fileUrl : '', videoKey: video ? attachment.key : '',
      });
      if (!mounted.current) return;
      normalizePostResponse(response);
      setPublished({ topic: selectedTopic, title: form.title.trim(), visibility: form.visibility, video }); clearDraft();
    } catch (err) {
      if (mounted.current) {
        const message = parseApiErrorMessage(err);
        setError(typeof message === 'string' ? message.slice(0, 300) : 'Could not publish. Your draft is still here; please try again.');
      }
    } finally {
      submittingRef.current = false;
      if (mounted.current) { setSubmitting(false); setStage(''); }
    }
  };
  const draftLabel = { empty: 'A fresh page', saving: 'Saving…', saved: 'Draft saved on this device', restored: 'Draft restored · text only', error: 'Draft could not be saved here' }[draftState];

  return <main className="post-composer" aria-labelledby="composer-heading">
    <header className="composer-heading">
      <div><span className="composer-kicker">{videoMode ? <Video size={14} /> : <PenLine size={14} />}{videoMode ? ' NEW VIDEO' : ' NEW POST'}</span><h1 id="composer-heading">{videoMode ? 'Share an idea in motion.' : 'Share an idea.'}</h1><p>{videoMode ? 'One video. One interesting idea. Let people see how it works.' : 'Something you learned. Something worth passing on.'}</p></div>
      <span className={'composer-draft is-' + draftState}><span aria-hidden="true" />{draftLabel}</span>
    </header>
    {published ? <section className="composer-success">
      <span className="composer-success-mark"><Check size={26} /></span><span className="composer-kicker">{published.visibility === 'private' ? 'SAVED PRIVATELY' : 'PUBLISHED'}</span>
      <h2 tabIndex={-1} ref={successHeading}>Your idea is out of the draft.</h2><p>“{published.title}”</p><span>{published.visibility === 'private' ? 'Only you can see this post.' : 'Shared in ' + published.topic + '.'}</span>
      {draftState === 'error' && <p role="status">Published, but the local draft could not be cleared on this device.</p>}
      <div><Link className="composer-primary" to={published.visibility === 'private' ? '/profile' : '/feed?topic=' + encodeURIComponent(published.video ? 'Video' : published.topic)}>{published.visibility === 'private' ? 'Go to my profile' : published.video ? 'Watch videos' : 'Explore this topic'}<ArrowUpRight size={16} /></Link><button type="button" className="composer-quiet" onClick={() => setPublished(null)}>{videoMode ? 'Add another video' : 'Write another'}</button></div>
    </section> : <form className="composer-layout" onSubmit={submit} aria-busy={submitting}>
      <section className="composer-paper" aria-label="Post editor">
        <div className="composer-paper-bar"><div className="composer-view-switch" role="group" aria-label="Editor view"><button type="button" aria-pressed={view === 'write'} onClick={() => setView('write')}><PenLine size={15} />Write</button><button type="button" aria-pressed={view === 'preview'} onClick={() => { setView('preview'); setTopicOpen(false); }}><Eye size={15} />Preview</button></div><span className="composer-read-time">{stats.words ? stats.minutes + ' min read' : 'Your next good idea'}</span></div>
        {view === 'write' ? <div className="composer-writing" key="write">
          <div className="composer-label-row"><label htmlFor="composer-title">Headline</label><span>{form.title.length}/140</span></div>
          <textarea id="composer-title" className="composer-title" rows={2} placeholder="What did you discover?" maxLength={140} value={form.title} disabled={submitting} onChange={event => change('title', event.target.value.replace(/\n/g, ' '))} />
          <div className="composer-label-row"><label htmlFor="composer-body">{videoMode || isVideo ? 'Caption · optional' : 'The idea'}</label><span>{stats.words} {stats.words === 1 ? 'word' : 'words'}</span></div>
          <textarea id="composer-body" ref={bodyInput} className="composer-body" placeholder={'Start with one interesting idea.\n\nExplain how it works, share an example, or tell us what changed your mind.'} maxLength={5000} value={form.body} disabled={submitting} onChange={event => change('body', event.target.value)} aria-describedby="composer-body-count" />
          <div className="composer-writing-foot"><span>Make it specific. Make it yours.</span><span id="composer-body-count">{form.body.length.toLocaleString()}/5,000</span></div>
        </div> : <article className="composer-preview" key="preview" aria-label="Post preview">
          <div className="composer-author"><span aria-hidden="true">{name.slice(0, 1).toUpperCase()}</span><div><strong>{name}</strong><small>{selectedTopic || 'Choose a topic'} · {form.visibility === 'private' ? 'Only you' : 'Public'}</small></div></div>
          <h2>{form.title.trim() || 'Your headline goes here'}</h2><p className={!form.body.trim() ? 'is-placeholder' : ''}>{form.body.trim() || 'Write your idea to see how it reads.'}</p>
          {mediaUrl && (media?.type.startsWith('image/') ? <img src={mediaUrl} alt="Attached to this post" /> : <video src={mediaUrl} controls playsInline preload="metadata" />)}
          <span className="composer-preview-note">Reading preview · nothing is published yet</span>
        </article>}
        <div className={'composer-attachment' + (dragging ? ' is-dragging' : '')} onDragOver={event => { event.preventDefault(); if (!submitting) setDragging(true); }} onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget)) setDragging(false); }} onDrop={event => { event.preventDefault(); setDragging(false); selectMedia(event.dataTransfer.files); }}>
          <input ref={fileInput} type="file" accept={videoMode ? 'video/mp4,video/quicktime,video/webm,video/x-m4v,.mp4,.mov,.webm,.m4v' : 'image/*,video/mp4,video/quicktime,video/webm,video/x-m4v'} hidden disabled={submitting} onChange={event => { selectMedia(event.target.files); event.target.value = ''; }} aria-label={videoMode ? 'Attach a video' : 'Attach an image or video'} />
          {media ? <><div className="composer-attachment-preview">{media.type.startsWith('image/') ? <img src={mediaUrl} alt="Attachment preview" /> : <video src={mediaUrl} controls playsInline preload="metadata" onLoadedMetadata={event => { setVideoPlayable(Number.isFinite(event.currentTarget.duration) && event.currentTarget.duration > 0); setMediaError(''); }} onError={() => { setVideoPlayable(false); setMediaError('This device cannot preview the video. Try an MP4 with H.264 video and AAC audio.'); }} />}</div><div className="composer-file-row"><div><strong>{media.name}</strong><small>{(media.size / 1024 / 1024).toFixed(1)} MB · Attach again if you leave this page</small></div><button type="button" className="composer-icon" aria-label="Remove attachment" disabled={submitting} onClick={() => { setMedia(null); setVideoPlayable(false); uploadCache.current = null; }}><X size={18} /></button></div></> :
            <button type="button" className="composer-attach-button" disabled={submitting} onClick={() => fileInput.current?.click()}><span className="composer-attach-icon">{videoMode ? <Video size={21} /> : <ImagePlus size={21} />}</span><span><strong>{videoMode ? 'Choose your video' : 'Add an image or video'}</strong><small>{videoMode ? 'Drop a video or choose one from your device' : 'Optional · drop a file or choose one'}</small></span><Plus size={18} /></button>}
          <span className="composer-file-hint">{videoMode ? 'Up to 250 MB · MP4 recommended · only upload videos you can share' : 'Images up to 12 MB · video up to 250 MB'}</span>
          {mediaError && <p className="composer-error" role="alert">{mediaError}</p>}
        </div>
      </section>
      <aside className="composer-details" aria-label="Post details">
        <div className="composer-details-heading"><h2>Post details</h2><span>01 / IDEA</span></div>
        <section className="composer-setting"><label htmlFor="composer-topic">Topic</label><div className="composer-topic-shell" ref={topicShell}>
          <div className="composer-topic-input"><Search size={16} /><input id="composer-topic" ref={topicInput} role="combobox" aria-label="Search or create a topic" aria-autocomplete="list" aria-controls={topicOpen ? 'composer-topics' : undefined} aria-expanded={topicOpen} aria-activedescendant={topicOpen && activeTopic >= 0 ? 'composer-topic-' + activeTopic : undefined} autoComplete="off" placeholder="Find or add a topic" value={form.topic} maxLength={60} disabled={submitting} onFocus={() => setTopicOpen(true)} onBlur={event => { if (!topicShell.current?.contains(event.relatedTarget)) setTopicOpen(false); }} onChange={event => { change('topic', event.target.value.replace(/[\u0000-\u001f\u007f]/g, '')); setTopicOpen(true); setActiveTopic(-1); }} onKeyDown={topicKeys} />{exactTopic && <Check size={15} aria-label="Existing topic" />}</div>
          {topicOpen && <div className="composer-topic-menu" id="composer-topics" role="listbox" aria-label="Topics">{choices.map((topic, index) => <button type="button" role="option" tabIndex={-1} id={'composer-topic-' + index} key={topic} aria-selected={activeTopic === index} onMouseDown={event => event.preventDefault()} onClick={() => chooseTopic(topic)}>{canCreate && index === matches.length ? <><Plus size={14} /><span>Add “{topic}”</span></> : <><span>{topic}</span>{topic === exactTopic && <Check size={14} />}</>}</button>)}{!choices.length && <p>Type at least two characters.</p>}</div>}
        </div><p>{topicState === 'fallback' ? 'Suggestions are offline. You can still enter a topic.' : topicState === 'loading' ? 'Loading topic suggestions…' : canCreate ? 'This topic will be added when you publish.' : 'A specific topic helps the right people find it.'}</p></section>
        <fieldset className="composer-setting composer-audience" disabled={submitting}><legend>Who can see it?</legend><div role="group" aria-label="Post audience"><button type="button" aria-pressed={form.visibility === 'public'} onClick={() => change('visibility', 'public')}><Globe2 size={16} />Everyone</button><button type="button" aria-pressed={form.visibility === 'private'} onClick={() => change('visibility', 'private')}><Lock size={15} />Only me</button></div><p>{form.visibility === 'public' ? 'Visible to everyone in Smarty.' : 'A private note, just for you.'}</p></fieldset>
        <details className="composer-writing-tip"><summary>A little writing help<ChevronDown size={15} /></summary><ol><li>Start with one specific idea.</li><li>Explain it in your own words.</li><li>Add an example and credit your sources.</li></ol></details>
        <div className="composer-publish-area">
          {error && <p className="composer-error" role="alert">{error}</p>}
          {submitting && <div className="composer-progress" role="status"><span>{stage}</span>{stage === 'Uploading attachment…' && <><progress max="100" value={progress} aria-label="Attachment upload progress" /><small>{progress}% uploaded</small></>}</div>}
          <button className="composer-primary" type="submit" disabled={!ready || submitting}><Send size={16} />{submitting ? 'Publishing…' : form.visibility === 'private' ? 'Publish privately' : 'Publish post'}</button>
          <p className="composer-publish-note">{!ready ? videoMode || isVideo ? 'Add a headline, a playable video, and a topic to publish.' : 'Add a headline, your idea, and a topic to publish.' : form.visibility === 'private' ? 'Your private post will appear on your profile.' : 'Share thoughtfully. Keep it useful and respectful.'}</p>
          {(hasPostDraft(form) || media) && !confirmClear && <button type="button" className="composer-clear" disabled={submitting} onClick={() => setConfirmClear(true)}>Clear draft</button>}
          {confirmClear && <div className="composer-confirm" role="group" aria-label="Confirm clearing draft"><p>Remove this draft and its attachment?</p><div><button type="button" className="composer-quiet" disabled={submitting} onClick={() => setConfirmClear(false)}>Keep writing</button><button type="button" className="composer-clear" disabled={submitting} onClick={clearDraft}>Clear draft</button></div></div>}
          <p className="composer-device-note">Text drafts stay on this device. Attachments aren’t saved in drafts.</p>
        </div>
      </aside>
    </form>}
  </main>;
}
