import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { postApi } from '../api/client';
import './CreatePostPage.css';

export default function EditPostPage() {
  const { reelId } = useParams();
  const navigate = useNavigate();
  const mountedRef = useRef(true);
  const navigateTimerRef = useRef(null);
  const activeUploadRef = useRef(null);

  const [topics, setTopics] = useState([]);
  const [topicMode, setTopicMode] = useState('existing');

  const [form, setForm] = useState({
    topic: '',
    customTopic: '',
    title: '',
    body: '',
    visibility: 'public',
    imageUrl: '',
    videoUrl: '',
  });

  const [imageFile, setImageFile] = useState(null);
  const [videoFile, setVideoFile] = useState(null);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [status, setStatus] = useState('');
  const [uploadStage, setUploadStage] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);

  const loadPage = useCallback(async () => {
    try {
      setLoading(true);

      const [topicData, post] = await Promise.all([
        postApi.getTopics(),
        postApi.getSingleReel(reelId),
      ]);
      if (!mountedRef.current) return;

      const topicList = Array.isArray(topicData)
        ? Array.from(
            new Set(
              topicData
                .map((item) =>
                  typeof item === 'string' ? item : item.topic || item.name || item.title
                )
                .filter(Boolean)
                .map((item) => String(item).trim())
            )
          )
        : [];

      setTopics(topicList);

      setForm({
        topic: post?.topic || topicList[0] || '',
        customTopic: '',
        title: post?.title || '',
        body: post?.body || '',
        visibility: post?.visibility || 'public',
        imageUrl: post?.imageUrl || '',
        videoUrl: post?.videoUrl || '',
      });
    } catch (err) {
      console.error(err);
      if (mountedRef.current) setStatus('Could not load post.');
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [reelId]);

  useEffect(() => {
    mountedRef.current = true;
    loadPage();

    return () => {
      mountedRef.current = false;
      if (navigateTimerRef.current) {
        window.clearTimeout(navigateTimerRef.current);
      }
      if (activeUploadRef.current) {
        activeUploadRef.current.abort();
      }
    };
  }, [loadPage]);

  const deletePost = useCallback(async () => {
    const confirmDelete = window.confirm(
      'Delete this post permanently? This cannot be undone.'
    );

    if (!confirmDelete) return;
    if (submitting) return;

    try {
      setSubmitting(true);
      setUploadStage('Deleting post');
      setUploadProgress(80);

      await postApi.deletePost(reelId);

      setUploadStage('Deleted');
      setUploadProgress(100);

      navigateTimerRef.current = window.setTimeout(() => {
        if (mountedRef.current) navigate('/profile');
      }, 500);
    } catch (err) {
      console.error('Delete failed:', err);
      if (mountedRef.current) {
        setStatus('Failed to delete post.');
        setSubmitting(false);
        setUploadStage('');
        setUploadProgress(0);
      }
    }
  }, [navigate, reelId, submitting]);

  const uploadFile = useCallback(async (file, onProgress) => {
    if (!file) return '';

    const uploadData = await postApi.getUploadUrl({
      fileName: file.name,
      fileType: file.type,
    });

    await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      activeUploadRef.current = xhr;

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percent = Math.round((event.loaded / event.total) * 100);
          onProgress(percent);
        }
      };

      xhr.onload = () => {
        activeUploadRef.current = null;
        if (xhr.status >= 200 && xhr.status < 300) resolve();
        else reject(new Error(`Upload failed: ${xhr.status}`));
      };

      xhr.onerror = () => {
        activeUploadRef.current = null;
        reject(new Error('Upload failed'));
      };

      xhr.onabort = () => {
        activeUploadRef.current = null;
        reject(new Error('Upload cancelled'));
      };

      xhr.open('PUT', uploadData.uploadUrl);
      xhr.setRequestHeader('Content-Type', file.type);
      xhr.send(file);
    });

    return uploadData.fileUrl;
  }, []);

  const submit = useCallback(async (event) => {
    event.preventDefault();
    if (submitting) return;

    const topic = selectedTopic;
    const title = form.title.trim();
    const body = form.body.trim();

    if (!topic || !title || !body) {
      setStatus('Please fill topic, title, and content.');
      return;
    }

    try {
      setSubmitting(true);
      setStatus('');
      setUploadStage('Preparing update');
      setUploadProgress(5);

      let imageUrl = form.imageUrl;
      let videoUrl = form.videoUrl;

      if (imageFile) {
        setUploadStage('Uploading new image');
        setUploadProgress(0);
        imageUrl = await uploadFile(imageFile, setUploadProgress);
        if (!mountedRef.current) return;
      }

      if (videoFile) {
        setUploadStage('Uploading new video');
        setUploadProgress(0);
        videoUrl = await uploadFile(videoFile, setUploadProgress);
        if (!mountedRef.current) return;
      }

      setUploadStage('Updating post');
      setUploadProgress(90);

      await postApi.updatePost({
        id: reelId,
        reelId,
        topic,
        title,
        body,
        visibility: form.visibility,
        imageUrl,
        videoUrl,
      });
      if (!mountedRef.current) return;

      setUploadStage('Success');
      setUploadProgress(100);
      setStatus('Post updated successfully.');

      navigateTimerRef.current = window.setTimeout(() => {
        if (mountedRef.current) navigate(`/reel/${reelId}`);
      }, 500);
    } catch (err) {
      console.error(err);
      if (mountedRef.current) {
        setStatus(err?.message === 'Upload cancelled' ? 'Upload cancelled.' : 'Failed to update post.');
        setSubmitting(false);
        setUploadStage('');
        setUploadProgress(0);
      }
    }
  }, [form, imageFile, navigate, reelId, selectedTopic, submitting, uploadFile, videoFile]);

  const handleTopicModeChange = useCallback((event) => {
    setTopicMode(event.target.value);
  }, []);

  const handleTopicChange = useCallback((event) => {
    setForm((current) => ({ ...current, topic: event.target.value }));
  }, []);

  const handleCustomTopicChange = useCallback((event) => {
    setForm((current) => ({ ...current, customTopic: event.target.value }));
  }, []);

  const handleImageFileChange = useCallback((event) => {
    const file = event.target.files?.[0] || null;
    setImageFile(file);
    if (file) setVideoFile(null);
  }, []);

  const handleVideoFileChange = useCallback((event) => {
    const file = event.target.files?.[0] || null;
    setVideoFile(file);
    if (file) setImageFile(null);
  }, []);

  const handleTitleChange = useCallback((event) => {
    setForm((current) => ({ ...current, title: event.target.value }));
  }, []);

  const handleBodyChange = useCallback((event) => {
    setForm((current) => ({ ...current, body: event.target.value }));
  }, []);

  const setPublicVisibility = useCallback(() => {
    setForm((current) => ({ ...current, visibility: 'public' }));
  }, []);

  const setPrivateVisibility = useCallback(() => {
    setForm((current) => ({ ...current, visibility: 'private' }));
  }, []);

  const selectedTopic = useMemo(() => {
    return topicMode === 'custom' ? form.customTopic.trim() : form.topic;
  }, [topicMode, form.customTopic, form.topic]);

  const canSubmit = useMemo(
    () => Boolean(!submitting && selectedTopic && form.title.trim() && form.body.trim()),
    [form.body, form.title, selectedTopic, submitting]
  );

  const renderedTopicOptions = useMemo(() => {
    if (topics.length === 0) {
      return <option value={form.topic}>{form.topic || 'No topics found'}</option>;
    }

    return topics.map((topic) => (
      <option key={topic} value={topic}>
        {topic}
      </option>
    ));
  }, [form.topic, topics]);

  if (loading) {
    return (
      <main className="create-page">
        <p className="status">Loading post...</p>
      </main>
    );
  }

  return (
    <main className="create-page">
      {submitting && (
        <div className="upload-loader">
          <div className="upload-orb-wrap">
            <div className="upload-orb">
              <span>{uploadStage === 'Success' ? '✓' : '↑'}</span>
            </div>
            <div className="orbit orbit-one"></div>
            <div className="orbit orbit-two"></div>
          </div>

          <h3>{uploadStage}</h3>

          <div className="progress-track">
            <div style={{ width: `${uploadProgress}%` }} />
          </div>

          <p className="progress-text">{uploadProgress}%</p>

          <div className="current-stage-card">
            <span>{uploadStage === 'Success' ? '✓' : '•'}</span>
            <strong>{uploadStage || 'Working...'}</strong>
          </div>
        </div>
      )}

      <section className="create-hero">
        <div>
          <span className="create-pill">Edit reel</span>
          <h1>Refine your post.</h1>
          <p>Update the topic, content, visibility, image, or video for your existing post.</p>
        </div>
      </section>

      <section className="create-layout">
        <form className="create-form" onSubmit={submit}>
          <div className="top-row-grid">
            <div className="form-section">
              <label>Topic</label>

              <div className="topic-row">
                <select value={topicMode} disabled={submitting} onChange={handleTopicModeChange}>
                  <option value="existing">Choose topic</option>
                  <option value="custom">Custom topic</option>
                </select>

                {topicMode === 'existing' ? (
                  <select
                    value={form.topic}
                    disabled={submitting}
                    onChange={handleTopicChange}
                  >
                    {renderedTopicOptions}
                  </select>
                ) : (
                  <input
                    placeholder="Custom topic"
                    value={form.customTopic}
                    disabled={submitting}
                    onChange={handleCustomTopicChange}
                  />
                )}
              </div>
            </div>

            <div className="form-section">
              <label>Replace Media</label>

              <div className="media-scroll-row">
                <label className="mini-upload-card">
                  <small>{imageFile ? imageFile.name : 'New image'}</small>
                  <input
                    type="file"
                    accept="image/*"
                    disabled={submitting}
                    onChange={handleImageFileChange}
                  />
                </label>

                <label className="mini-upload-card">
                  <small>{videoFile ? videoFile.name : 'New video'}</small>
                  <input
                    type="file"
                    accept="video/*"
                    disabled={submitting}
                    onChange={handleVideoFileChange}
                  />
                </label>
              </div>
            </div>
          </div>

          <div className="edit-preview-row">
            {form.imageUrl && (
              <div className="edit-preview-card">
                <span>Current image</span>
                <img
                  src={form.imageUrl}
                  alt="Current post"
                  loading="lazy"
                  decoding="async"
                  fetchPriority="auto"
                />
              </div>
            )}

            {form.videoUrl && (
              <div className="edit-preview-card">
                <span>Current video</span>
                <video src={form.videoUrl} controls preload="metadata" />
              </div>
            )}
          </div>

          <div className="form-section">
            <label>Headline</label>
            <input
              value={form.title}
              disabled={submitting}
              onChange={handleTitleChange}
            />
          </div>

          <div className="form-section">
            <label>Content</label>
            <textarea
              rows="10"
              value={form.body}
              disabled={submitting}
              onChange={handleBodyChange}
            />
          </div>

          <div className="bottom-row">
            <div className="form-section visibility-box">
              <label>Visibility</label>

              <div className="visibility-toggle">
                <button
                  type="button"
                  disabled={submitting}
                  className={form.visibility === 'public' ? 'active' : ''}
                  onClick={setPublicVisibility}
                >
                  🌍 Public
                </button>

                <button
                  type="button"
                  disabled={submitting}
                  className={form.visibility === 'private' ? 'active' : ''}
                  onClick={setPrivateVisibility}
                >
                  🔒 Private
                </button>
              </div>
            </div>

            <div className="edit-action-row">
              <button className="primary-btn publish-btn" disabled={!canSubmit} type="submit">
                {submitting ? 'Updating...' : 'Update reel'}
              </button>

              <button
                className="delete-post-btn"
                disabled={submitting}
                type="button"
                onClick={deletePost}
              >
                Delete
              </button>
            </div>
          </div>

          

          {status && <p className="status">{status}</p>}
        </form>

        <aside className="create-side">
          <h3>Edit tips</h3>

          <div className="tip-card">
            <span>Improve clarity</span>
            <p>Make the first sentence stronger and easier to understand.</p>
          </div>

          <div className="tip-card">
            <span>Refresh media</span>
            <p>Add a stronger image or video to make the post more engaging.</p>
          </div>

          <div className="tip-card">
            <span>Control access</span>
            <p>Switch between public and private depending on who should see it.</p>
          </div>
        </aside>
      </section>
    </main>
  );
}