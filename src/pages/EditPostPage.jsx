import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Check, Eye, Globe2, ImagePlus, Lock, PenLine, RefreshCw, Save, Search, Trash2, X } from 'lucide-react';
import { postApi } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { useActionConfirmation } from '../components/ActionConfirmation';
import { MAIN_TOPIC_LABELS } from '../data/topicTaxonomy';
import { cleanPostTopic, POST_LIMITS, postReadingStats, validatePostMedia } from '../lib/postDraft';
import { normalizePostResponse } from '../lib/postResponse';
import { editPostError, editPostForm, editPostPayload, invalidateEditedFeed, normalizeEditUpload, postForEditing } from '../lib/postEditing';
import { validateVideoUpload } from '../lib/videoFeed';
import './CreatePostComposer.css';
import './EditPostPage.css';

const errorMessage = (err, fallback) => err?.response?.status === 403
  ? 'You do not have permission to change this post.'
  : err?.response?.status === 404 ? 'This post is no longer available.' : fallback;

export default function EditPostPage() {
  const { reelId } = useParams();
  const { user } = useAuth();
  const account = user?.userId || user?.sub || user?.id || '';
  // An old request must not update a different post or a different account.
  return <PostEditor key={`${account}:${reelId}`} id={reelId} account={account} />;
}

function PostEditor({ id, account }) {
  const navigate = useNavigate();
  const confirm = useActionConfirmation();
  const [post, setPost] = useState(null);
  const [form, setForm] = useState(null);
  const [topics, setTopics] = useState(MAIN_TOPIC_LABELS);
  const [topicOpen, setTopicOpen] = useState(false);
  const [topicIndex, setTopicIndex] = useState(-1);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const [view, setView] = useState('write');
  const [file, setFile] = useState(null);
  const [fileUrl, setFileUrl] = useState('');
  const [removeMedia, setRemoveMedia] = useState(false);
  const [videoPlayable, setVideoPlayable] = useState(false);
  const [mediaError, setMediaError] = useState('');
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState('');
  const [progress, setProgress] = useState(0);
  const mounted = useRef(false);
  const operation = useRef(false);
  const loadVersion = useRef(0);
  const xhrRef = useRef(null);
  const uploadCache = useRef(null);
  const fileInput = useRef(null);
  const topicInput = useRef(null);
  const originalForm = useMemo(() => post ? editPostForm(post) : null, [post]);
  const dirty = Boolean(form && originalForm && (file || removeMedia || Object.keys(form).some(key => form[key] !== originalForm[key])));
  const video = file ? file.type.startsWith('video/') : !removeMedia && Boolean(form?.videoUrl);
  const imageUrl = file ? file.type.startsWith('image/') ? fileUrl : '' : removeMedia ? '' : form?.imageUrl;
  const videoUrl = file ? video ? fileUrl : '' : removeMedia ? '' : form?.videoUrl;
  const stats = postReadingStats(form?.body || '');
  const validation = form ? editPostError(form, video) : '';
  const choices = useMemo(() => [...new Set([originalForm?.topic, ...topics].filter(Boolean))]
    .filter(topic => topic.toLowerCase().includes((form?.topic || '').trim().toLowerCase())).slice(0, 6), [form?.topic, originalForm?.topic, topics]);
  // A failed preview of existing media must not prevent text-only corrections.
  const canSave = dirty && !validation && !busy && (!file || ((!video || videoPlayable) && !mediaError));

  const load = useCallback(async () => {
    const version = ++loadVersion.current;
    setLoading(true); setLoadError('');
    try {
      const current = postForEditing(await postApi.getSingleReel(id));
      if (!mounted.current || version !== loadVersion.current) return;
      setPost(current); setForm(editPostForm(current));
    } catch (err) {
      if (mounted.current && version === loadVersion.current) setLoadError(errorMessage(err, 'We could not load this post. Check your connection and try again.'));
    } finally {
      if (mounted.current && version === loadVersion.current) setLoading(false);
    }
  }, [id]);
  useEffect(() => {
    mounted.current = true; load();
    return () => { mounted.current = false; loadVersion.current += 1; xhrRef.current?.abort(); };
  }, [load]);
  useEffect(() => {
    let active = true;
    // Suggestions are optional: a topic-service failure cannot block editing.
    postApi.getTopics().then(response => {
      const value = Array.isArray(response) ? response : normalizePostResponse(response);
      const items = Array.isArray(value) ? value : value.topics || value.items || [];
      const names = items.map(item => cleanPostTopic(typeof item === 'string' ? item : item?.topic || item?.name || item?.title)).filter(Boolean);
      if (active && names.length) setTopics([...new Set(names)]);
    }).catch(() => {});
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (!file) { setFileUrl(''); return; }
    const url = URL.createObjectURL(file); setFileUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  useEffect(() => {
    if (!dirty) return;
    const warn = event => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const change = (key, value) => { setForm(current => ({ ...current, [key]: value })); setError(''); setSaved(false); };
  const chooseTopic = topic => { change('topic', cleanPostTopic(topic)); setTopicOpen(false); setTopicIndex(-1); topicInput.current?.focus(); };
  const selectFile = selected => {
    if (!selected || busy) return;
    const problem = validatePostMedia(selected) || (selected.type.startsWith('video/') ? validateVideoUpload(selected) : '');
    if (problem) { setError(problem); return; }
    setFile(selected); setRemoveMedia(false); setVideoPlayable(false); setMediaError(''); setSaved(false); setError(''); uploadCache.current = null;
  };
  const restoreMedia = () => { setFile(null); setRemoveMedia(false); setMediaError(''); setSaved(false); uploadCache.current = null; };
  const leave = async () => {
    if (busy || operation.current) return;
    if (dirty && !await confirm({ title: 'Discard changes?', description: 'Your unsaved edits will be lost. The published post will stay unchanged.', confirmLabel: 'Discard changes', cancelLabel: 'Keep editing' })) return;
    if (mounted.current) navigate('/profile');
  };

  const uploadFile = async () => {
    if (!file) return null;
    if (uploadCache.current?.file === file) return uploadCache.current.result;
    setStage('Preparing attachment…');
    const result = normalizeEditUpload(await postApi.getUploadUrl({ fileName: file.name, fileType: file.type }));
    if (!mounted.current) throw new Error('Upload cancelled.');
    if (!result.uploadUrl || (!result.fileUrl && !result.key)) throw new Error('Could not prepare the attachment. Please try again.');
    setStage('Uploading attachment…');
    await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest(); xhrRef.current = xhr;
      const fail = message => { xhrRef.current = null; reject(new Error(message)); };
      xhr.upload.onprogress = event => { if (mounted.current && event.lengthComputable) setProgress(Math.round(event.loaded / event.total * 100)); };
      xhr.onload = () => { xhrRef.current = null; xhr.status >= 200 && xhr.status < 300 ? resolve() : fail('Upload failed. Please try again.'); };
      xhr.onerror = () => fail('Upload interrupted. Check your connection and try again.');
      xhr.onabort = () => fail('Upload cancelled.');
      xhr.ontimeout = () => fail('Upload timed out. Try a smaller file or a stronger connection.');
      xhr.open('PUT', result.uploadUrl); xhr.timeout = 180000; xhr.setRequestHeader('Content-Type', file.type); xhr.send(file);
    });
    uploadCache.current = { file, result };
    return result;
  };
  const submit = async event => {
    event.preventDefault();
    if (operation.current || !canSave) return;
    operation.current = true; setBusy(true); setError(''); setSaved(false); setProgress(0); setTopicOpen(false); setStage('Saving changes…');
    try {
      const upload = await uploadFile();
      if (!mounted.current) return;
      const payload = editPostPayload(id, post, form, { file, upload, removeMedia });
      setStage('Saving changes…');
      normalizePostResponse(await postApi.updatePost(payload));
      if (!mounted.current) return;
      const updated = { ...post, ...payload };
      setPost(updated); setForm(editPostForm(updated)); setFile(null); setRemoveMedia(false); setMediaError(''); uploadCache.current = null; setSaved(true);
      invalidateEditedFeed(account);
      window.dispatchEvent(new Event('smarty-global-refresh'));
    } catch (err) {
      if (mounted.current) setError(errorMessage(err, err?.message?.replace('published', 'updated').replace('publishing', 'update') || 'Could not save. Your changes are still here; please try again.'));
    } finally {
      operation.current = false;
      if (mounted.current) { setBusy(false); setStage(''); }
    }
  };
  const deletePost = async () => {
    if (operation.current || busy) return;
    // Lock before the dialog opens, so a delayed confirmation cannot race a save.
    operation.current = true;
    const approved = await confirm({ title: 'Delete post?', description: 'This permanently removes the published post and its content. This cannot be undone.', confirmLabel: 'Delete post' });
    if (!approved || !mounted.current) { operation.current = false; return; }
    setBusy(true); setError(''); setStage('Deleting post…');
    try {
      normalizePostResponse(await postApi.deletePost({ ...post, id, reelId: id, postId: id }));
      if (mounted.current) { setDeleted(true); setFile(null); setRemoveMedia(false); setForm(editPostForm(post)); invalidateEditedFeed(account); window.dispatchEvent(new Event('smarty-global-refresh')); }
    } catch (err) {
      if (mounted.current) setError(errorMessage(err, 'Could not delete this post. Please try again.'));
    } finally {
      operation.current = false;
      if (mounted.current) { setBusy(false); setStage(''); }
    }
  };

  if (loading) return <main className="post-composer post-editor" aria-busy="true"><div className="edit-loading" role="status"><span>Opening your post…</span><div /><div /><div /></div></main>;
  if (loadError || !form) return <main className="post-composer post-editor"><section className="edit-empty"><PenLine size={24} /><h1>We couldn’t open this post.</h1><p role="alert">{loadError || 'This post is no longer available.'}</p><button type="button" className="composer-primary" onClick={load}><RefreshCw size={16} />Try again</button><Link to="/profile">Back to my posts</Link></section></main>;
  if (deleted) return <main className="post-composer post-editor"><section className="composer-success"><span className="composer-success-mark"><Check size={24} /></span><h1>Post deleted.</h1><p>Your post has been removed.</p><Link to="/profile" className="composer-primary">Back to my posts</Link></section></main>;
  return <main className="post-composer post-editor" aria-labelledby="edit-heading">
    <header className="composer-heading"><div><span className="composer-kicker"><PenLine size={14} />EDIT POST</span><h1 id="edit-heading">Edit your post.</h1><p>Make a change. Preview it before saving.</p></div><span className={'composer-draft' + (saved ? ' is-saved' : '')}><span aria-hidden="true" />{busy ? stage : saved ? 'Changes saved' : dirty ? 'Unsaved changes' : 'Up to date'}</span></header>
    <form className="composer-layout" onSubmit={submit} aria-busy={busy}>
      <section className="composer-paper" aria-label="Post editor">
        <div className="composer-paper-bar"><div className="composer-view-switch" role="group" aria-label="Editor view"><button type="button" aria-pressed={view === 'write'} onClick={() => setView('write')}><PenLine size={15} />Write</button><button type="button" aria-pressed={view === 'preview'} onClick={() => setView('preview')}><Eye size={15} />Preview</button></div><span className="composer-read-time">{stats.words} words · {stats.minutes} min read</span></div>
        {view === 'write' ? <div className="composer-writing"><div className="composer-label-row"><label htmlFor="edit-title">Headline</label><span>{form.title.length}/{POST_LIMITS.title}</span></div><textarea id="edit-title" className="composer-title" rows={2} maxLength={POST_LIMITS.title} value={form.title} disabled={busy} onChange={event => change('title', event.target.value.replace(/\n/g, ' '))} /><div className="composer-label-row"><label htmlFor="edit-body">{video ? 'Caption · optional' : 'The idea'}</label><span>{form.body.length.toLocaleString()}/{POST_LIMITS.body.toLocaleString()}</span></div><textarea id="edit-body" className="composer-body" rows={12} maxLength={POST_LIMITS.body} value={form.body} disabled={busy} placeholder="Make one interesting idea easy to understand." onChange={event => change('body', event.target.value)} /></div>
          : <article className="composer-preview" aria-label="Post preview"><span className="composer-kicker">{form.topic} · {form.visibility === 'private' ? 'ONLY YOU' : 'PUBLIC'}</span><h2>{form.title || 'Your headline'}</h2><p>{form.body || (video ? 'No caption added.' : 'Your content will appear here.')}</p></article>}
        <div className="composer-attachment"><input ref={fileInput} type="file" hidden aria-label="Replace attachment" accept="image/*,video/mp4,video/quicktime,video/webm,video/x-m4v" disabled={busy} onChange={event => { selectFile(event.target.files?.[0]); event.target.value = ''; }} />
          {(imageUrl || videoUrl) && <div className="composer-attachment-preview">{videoUrl && <video key={videoUrl} src={videoUrl} controls playsInline preload="metadata" onLoadedMetadata={event => { if (file) setVideoPlayable(Number.isFinite(event.currentTarget.duration) && event.currentTarget.duration > 0); setMediaError(''); }} onError={() => setMediaError(file ? 'This device cannot preview the video. Try an MP4 with H.264 video and AAC audio.' : 'The saved video could not be previewed. You can still edit its text or replace the file.')} />}{imageUrl && <img key={imageUrl} src={imageUrl} alt={file ? 'New attachment preview' : 'Current post attachment'} onError={() => setMediaError(file ? 'This image could not be previewed. Choose another image.' : 'The saved image could not be previewed. You can still edit its text or replace the file.')} />}</div>}
          <div className="edit-media-row"><div><strong>{file ? file.name : removeMedia ? 'Attachment will be removed' : imageUrl || videoUrl ? 'Current attachment' : 'No attachment'}</strong><small>{file ? 'Replaces the current media when you save.' : 'Images up to 12 MB · videos up to 250 MB'}</small></div><button type="button" className="composer-quiet" disabled={busy} onClick={() => fileInput.current?.click()}><ImagePlus size={16} />{imageUrl || videoUrl ? 'Replace' : 'Add media'}</button>{(file || removeMedia) ? <button type="button" className="composer-icon" aria-label="Restore original attachment" disabled={busy} onClick={restoreMedia}><RefreshCw size={16} /></button> : (imageUrl || videoUrl) && <button type="button" className="composer-icon" aria-label="Remove attachment" disabled={busy} onClick={() => { setRemoveMedia(true); setMediaError(''); setSaved(false); }}><X size={16} /></button>}</div>
          {mediaError && <p className="edit-media-error" role="status">{mediaError}</p>}
        </div>
      </section>
      <aside className="composer-details"><div className="composer-details-heading"><h2>Post settings</h2><span>YOUR IDEA</span></div>
        <div className="composer-setting composer-topic-shell" onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setTopicOpen(false); }}><label htmlFor="edit-topic">Topic</label><div className="composer-topic-input"><Search size={16} /><input ref={topicInput} id="edit-topic" role="combobox" aria-autocomplete="list" aria-expanded={topicOpen} aria-controls={topicOpen ? 'edit-topic-options' : undefined} aria-activedescendant={topicOpen && choices[topicIndex] ? 'edit-topic-' + topicIndex : undefined} autoComplete="off" maxLength={POST_LIMITS.topic} value={form.topic} disabled={busy} placeholder="Find or add a topic" onFocus={() => setTopicOpen(true)} onChange={event => { change('topic', event.target.value.replace(/[\u0000-\u001f\u007f]/g, '')); setTopicOpen(true); setTopicIndex(-1); }} onKeyDown={event => { if (event.key === 'Escape') { setTopicOpen(false); event.stopPropagation(); } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); setTopicOpen(true); setTopicIndex(index => choices.length ? (index + (event.key === 'ArrowDown' ? 1 : -1) + choices.length) % choices.length : -1); } else if (event.key === 'Enter') { event.preventDefault(); if (topicOpen && choices[topicIndex]) chooseTopic(choices[topicIndex]); else setTopicOpen(false); } }} /></div>
          {topicOpen && choices.length > 0 && <div className="composer-topic-menu" id="edit-topic-options" role="listbox" aria-label="Matching topics">{choices.map((topic, index) => <button key={topic} id={'edit-topic-' + index} type="button" role="option" aria-selected={index === topicIndex} onClick={() => chooseTopic(topic)}>{topic}{topic === form.topic && <Check size={14} />}</button>)}</div>}<p>Search existing topics, or type a new one.</p></div>
        <fieldset className="composer-setting composer-audience"><legend>Who can see it</legend><div><button type="button" aria-pressed={form.visibility === 'public'} disabled={busy} onClick={() => change('visibility', 'public')}><Globe2 size={15} />Public</button><button type="button" aria-pressed={form.visibility === 'private'} disabled={busy} onClick={() => change('visibility', 'private')}><Lock size={15} />Only me</button></div><p>{form.visibility === 'private' ? 'Only you can see this post.' : 'Visible to the Smarty community.'}</p></fieldset>
        <div className="composer-publish-area">{error && <p className="composer-error" role="alert">{error}</p>}{dirty && validation && <p className="composer-publish-note">{validation}</p>}{busy && <div className="composer-progress" role="status"><span>{stage}</span>{stage === 'Uploading attachment…' && <progress max="100" value={progress} aria-label="Attachment upload progress" />}</div>}{saved && <p className="edit-saved" role="status"><Check size={16} />Your changes are saved.</p>}
          <button className="composer-primary" type="submit" disabled={!canSave}><Save size={16} />{busy ? 'Please wait…' : 'Save changes'}</button><button type="button" className="edit-cancel composer-quiet" disabled={busy} onClick={leave}>Back to my posts</button>{saved && <Link className="edit-view-post" to={'/reel/' + encodeURIComponent(id)}>View updated post</Link>}
        </div><div className="edit-danger"><button type="button" className="composer-quiet" disabled={busy} onClick={deletePost}><Trash2 size={15} />Delete post</button><p>Permanently removes this post.</p></div>
      </aside>
    </form>
  </main>;
}
