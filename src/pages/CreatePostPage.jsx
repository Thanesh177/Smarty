import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import imageCompression from 'browser-image-compression';
import {
  Globe2,
  ImagePlus,
  Lock,
  Send,
  X,
} from 'lucide-react';
import { postApi } from '../api/client';
import './CreatePostPage.css';
const MAX_IMAGE_SIZE_MB = 12;
const MAX_VIDEO_SIZE_MB = 250;
const BYTES_PER_MB = 1024 * 1024;
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
    fileUrl: parsed.fileUrl || parsed.publicUrl || parsed.url || '',
    key: parsed.key || parsed.fileKey || parsed.imageKey || parsed.videoKey || '',
  };
};

const DEFAULT_TOPICS = [
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

  return topicList.length ? topicList : DEFAULT_TOPICS;
};

export default function CreatePostPage() {
  const mountedRef = useRef(true);
  const activeUploadRef = useRef(null);
  const resetTimerRef = useRef(null);
  const mediaInputRef = useRef(null);

  const [topics, setTopics] = useState([]);
  const [topicMode, setTopicMode] = useState('existing');

  const [form, setForm] = useState({
    topic: '',
    customTopic: '',
    title: '',
    body: '',
    visibility: 'public',
  });

  const [uploadStage, setUploadStage] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [imageFile, setImageFile] = useState(null);
  const [videoFile, setVideoFile] = useState(null);
  const [status, setStatus] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const imagePreviewUrl = useMemo(() => {
    if (!imageFile) return '';
    return URL.createObjectURL(imageFile);
  }, [imageFile]);

  useEffect(() => {
    mountedRef.current = true;

    async function loadTopics() {
      try {
        const data = await postApi.getTopics();
        if (!mountedRef.current) return;

        const topicList = normalizeTopicsResponse(data);

        setTopics(topicList);

        if (topicList.length > 0) {
          setForm((prev) => ({ ...prev, topic: prev.topic || topicList[0] }));
        }
      } catch (err) {
        console.error('Failed to load topics:', err);
        if (mountedRef.current) {
          setTopics(DEFAULT_TOPICS);
          setForm((prev) => ({ ...prev, topic: prev.topic || DEFAULT_TOPICS[0] }));
          setStatus('Could not load topics from server. Showing default topics.');
        }
      }
    }

    loadTopics();

    return () => {
      mountedRef.current = false;
      if (activeUploadRef.current) activeUploadRef.current.abort();
      if (resetTimerRef.current) window.clearTimeout(resetTimerRef.current);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    };
  }, [imagePreviewUrl]);

  const selectedTopic = useMemo(() => {
    return topicMode === 'custom' ? form.customTopic.trim() : form.topic;
  }, [topicMode, form.customTopic, form.topic]);

  const uploadFile = useCallback(async (file, onProgress) => {
    if (!file) return { url: '', key: '' };

    const uploadData = normalizeUploadResponse(
      await postApi.getUploadUrl({
        fileName: file.name,
        fileType: file.type || 'application/octet-stream',
      })
    );

    if (!uploadData.uploadUrl) {
      throw new Error('Upload URL was not returned by the server.');
    }

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
      xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
      xhr.send(file);
    });

    return {
      url: uploadData.fileUrl,
      key: uploadData.key,
    };
  }, []);

  const resetForm = useCallback(() => {
    setForm({
      topic: topics[0] || '',
      customTopic: '',
      title: '',
      body: '',
      visibility: 'public',
    });

    setImageFile(null);
    setVideoFile(null);
    setTopicMode('existing');
    setStatus('');
  }, [topics]);

  const submit = useCallback(async (event) => {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setStatus('');
    setUploadProgress(0);

    const topic = selectedTopic;
    const title = form.title.trim();
    const body = form.body.trim();

    if (!topic || !title || !body) {
      setStatus('Please fill topic, headline, and content.');
      setSubmitting(false);
      setUploadStage('');
      return;
    }

    try {
      setUploadStage('Preparing files');
      setUploadProgress(5);

      let imageUrl = '';
      let imageKey = '';
      let thumbUrl = '';
      let thumbKey = '';
      let videoUrl = '';
      let videoKey = '';

      if (imageFile) {
        setUploadStage('Compressing image');
        setUploadProgress(10);

        const compressedImage = await compressImage(imageFile);
        if (!mountedRef.current) return;

        setUploadStage('Uploading image');
        setUploadProgress(0);

        const imageUpload = await uploadFile(compressedImage, setUploadProgress);
        if (!mountedRef.current) return;

        imageUrl = imageUpload.url;
        imageKey = imageUpload.key;
        thumbUrl = imageUpload.url;
        thumbKey = imageUpload.key;
      }

      if (videoFile) {
        setUploadStage('Uploading video');
        setUploadProgress(0);

        const videoUpload = await uploadFile(videoFile, setUploadProgress);
        if (!mountedRef.current) return;

        videoUrl = videoUpload.url;
        videoKey = videoUpload.key;
      }

      setUploadStage('Publishing post');
      setUploadProgress(90);

      await postApi.createPost({
        id: createSafeId(),
        topic,
        title,
        body,
        likes: 0,
        visibility: form.visibility,
        imageUrl,
        imageKey,
        thumbUrl,
        thumbKey,
        videoUrl,
        videoKey,
      });
      if (!mountedRef.current) return;

      setUploadStage('Success');
      setUploadProgress(100);
      setStatus('Post created successfully.');
      resetForm();

      resetTimerRef.current = window.setTimeout(() => {
        if (!mountedRef.current) return;
        setSubmitting(false);
        setUploadStage('');
        setUploadProgress(0);
      }, 800);
    } catch (err) {
      console.error('Create post failed:', err);
      if (mountedRef.current) {
        const message = err?.message === 'Upload cancelled'
          ? 'Upload cancelled.'
          : parseApiErrorMessage(err);

        setStatus(`Failed to publish: ${message}`);
        setSubmitting(false);
        setUploadStage('');
        setUploadProgress(0);
      }
    }
  }, [form, imageFile, resetForm, selectedTopic, submitting, uploadFile, videoFile]);

  const handleTopicChange = useCallback((event) => {
    setForm((current) => ({ ...current, topic: event.target.value }));
  }, []);

  const handleCustomTopicChange = useCallback((event) => {
    setForm((current) => ({ ...current, customTopic: event.target.value }));
  }, []);

  const handleTitleChange = useCallback((event) => {
    setForm((current) => ({ ...current, title: event.target.value }));
  }, []);

  const handleBodyChange = useCallback((event) => {
    setForm((current) => ({ ...current, body: event.target.value }));
  }, []);

  const handleMediaFileChange = useCallback((event) => {
  const file = event.target.files?.[0] || null;

  if (!file) {
    setImageFile(null);
    setVideoFile(null);
    return;
  }

  const fileType = String(file.type || '').toLowerCase();

  if (fileType.startsWith('image/')) {
    if (file.size > MAX_IMAGE_SIZE_MB * BYTES_PER_MB) {
      setStatus(`Image must be smaller than ${MAX_IMAGE_SIZE_MB} MB.`);
      event.target.value = '';
      return;
    }

    setStatus('');
    setImageFile(file);
    setVideoFile(null);
    return;
  }

  if (fileType.startsWith('video/')) {
    if (file.size > MAX_VIDEO_SIZE_MB * BYTES_PER_MB) {
      setStatus(`Video must be smaller than ${MAX_VIDEO_SIZE_MB} MB.`);
      event.target.value = '';
      return;
    }

    setStatus('');
    setVideoFile(file);
    setImageFile(null);
    return;
  }

  setStatus('Please select a valid image or video file.');
  event.target.value = '';
}, []);

const chooseExistingTopic = useCallback(() => {
  setTopicMode('existing');
}, []);

const chooseCustomTopic = useCallback(() => {
  setTopicMode('custom');
}, []);

  const removeMedia = useCallback(() => {
    setImageFile(null);
    setVideoFile(null);
    setStatus('');

    if (mediaInputRef.current) {
      mediaInputRef.current.value = '';
    }
  }, []);

  const setPublicVisibility = useCallback(() => {
    setForm((current) => ({ ...current, visibility: 'public' }));
  }, []);

  const setPrivateVisibility = useCallback(() => {
    setForm((current) => ({ ...current, visibility: 'private' }));
  }, []);

  const renderedTopicOptions = useMemo(() => {
    if (topics.length === 0) {
      return <option value="">No topics found</option>;
    }

    return topics.map((topic) => (
      <option key={topic} value={topic}>
        {topic}
      </option>
    ));
  }, [topics]);

  const canSubmit = useMemo(
    () => Boolean(!submitting && selectedTopic && form.title.trim() && form.body.trim()),
    [form.body, form.title, selectedTopic, submitting]
  );

  return (
    <main className="create-page post-create-page">
      {submitting && (
        <div className="upload-loader post-publish-overlay" role="dialog" aria-modal="true" aria-label="Publishing post">
          <div className="post-publish-card">
            <div className="post-publish-mark" aria-hidden="true">
              {uploadStage === 'Success' ? '✓' : <Send size={20} />}
            </div>
            <div className="post-publish-copy">
              <span>Publishing</span>
              <h3>{uploadStage || 'Preparing your post'}</h3>
            </div>
            <div className="progress-track" aria-hidden="true">
              <div style={{ width: `${uploadProgress}%` }} />
            </div>
            <p className="progress-text">{uploadProgress}% complete</p>
          </div>
        </div>
      )}

      <section className="post-studio">
        <header className="post-studio-header">
          <div>
            <span className="post-studio-eyebrow">New post</span>
            <h1>Create something worth saving.</h1>
            <p>Share one clear idea with the people who want to learn it.</p>
          </div>
          <span className="post-draft-state"><i aria-hidden="true" /> Draft</span>
        </header>

        <form className="create-form post-studio-form" onSubmit={submit}>
          <div className="post-settings-grid">
            <section className="post-setting-card">
              <div className="post-field-heading">
                <label>Topic</label>
                <span>Where it belongs</span>
              </div>
              <div className="topic-mode-toggle post-segmented" role="group" aria-label="Topic source">
                <button
                  type="button"
                  className={topicMode === 'existing' ? 'active' : ''}
                  aria-pressed={topicMode === 'existing'}
                  disabled={submitting}
                  onClick={chooseExistingTopic}
                >
                  Browse
                </button>
                <button
                  type="button"
                  className={topicMode === 'custom' ? 'active' : ''}
                  aria-pressed={topicMode === 'custom'}
                  disabled={submitting}
                  onClick={chooseCustomTopic}
                >
                  Custom
                </button>
              </div>
              <div className="topic-input-row">
                {topicMode === 'existing' ? (
                  <select value={form.topic} disabled={submitting} onChange={handleTopicChange} aria-label="Choose topic">
                    {renderedTopicOptions}
                  </select>
                ) : (
                  <input
                    placeholder="Name your topic"
                    value={form.customTopic}
                    maxLength={60}
                    disabled={submitting}
                    onChange={handleCustomTopicChange}
                  />
                )}
              </div>
            </section>

            <section className="post-setting-card">
              <div className="post-field-heading">
                <label>Audience</label>
                <span>Who can view it</span>
              </div>
              <div className="visibility-toggle post-visibility-toggle">
                <button type="button" className={form.visibility === 'public' ? 'active' : ''} aria-pressed={form.visibility === 'public'} disabled={submitting} onClick={setPublicVisibility}>
                  <Globe2 size={16} /> Public
                </button>
                <button type="button" className={form.visibility === 'private' ? 'active' : ''} aria-pressed={form.visibility === 'private'} disabled={submitting} onClick={setPrivateVisibility}>
                  <Lock size={15} /> Private
                </button>
              </div>
              <p className="post-setting-note">
                {form.visibility === 'public'
                  ? 'Anyone in Smarty can discover this post.'
                  : 'Only you can view this post.'}
              </p>
            </section>
          </div>

          <section className="post-editor">
            <div className="post-field-heading">
              <label htmlFor="post-headline">Headline</label>
              <span>{form.title.length}/140</span>
            </div>
            <input
              id="post-headline"
              className="post-title-input"
              placeholder="A clear headline for your idea"
              value={form.title}
              maxLength={140}
              disabled={submitting}
              onChange={handleTitleChange}
            />

            <div className="post-editor-divider" />

            <div className="post-field-heading">
              <label htmlFor="post-content">Your idea</label>
              <span>{form.body.length}/5000</span>
            </div>
            <textarea
              id="post-content"
              rows="9"
              placeholder="Explain it naturally. Start with what makes it useful, then add the detail people should remember."
              value={form.body}
              maxLength={5000}
              disabled={submitting}
              onChange={handleBodyChange}
            />
          </section>

          <section className="post-media-section">
            <div className="post-field-heading">
              <label>Media</label>
              <span>Optional · image or video</span>
            </div>
            <input
              ref={mediaInputRef}
              id="post-media-input"
              className="post-media-input"
              type="file"
              accept="image/*,video/*"
              disabled={submitting}
              onChange={handleMediaFileChange}
            />

            {!imageFile && !videoFile ? (
              <label className="post-media-empty" htmlFor="post-media-input">
                <span className="post-media-icon"><ImagePlus size={20} /></span>
                <span>
                  <strong>Add a visual</strong>
                  <small>Choose one image or video</small>
                </span>
                <b>Choose file</b>
              </label>
            ) : (
              <div className="post-media-selected">
                {imageFile ? (
                  <img src={imagePreviewUrl} alt="Selected media preview" className="post-media-preview" />
                ) : (
                  <span className="post-video-preview"><ImagePlus size={22} /></span>
                )}
                <div className="post-media-meta">
                  <strong>{imageFile?.name || videoFile?.name}</strong>
                  <small>{imageFile ? 'Image ready' : 'Video ready'}</small>
                </div>
                <button type="button" className="post-media-remove" onClick={removeMedia} disabled={submitting} aria-label="Remove selected media">
                  <X size={17} />
                </button>
              </div>
            )}
          </section>

          <footer className="post-studio-footer">
            <div className="post-footer-message" aria-live="polite">
              {status ? <p className="status">{status}</p> : <p>Your post saves as soon as it is published.</p>}
            </div>
            <button className="primary-btn publish-btn post-publish-button" disabled={!canSubmit} type="submit">
              <Send size={16} />
              {submitting ? 'Publishing' : 'Publish post'}
            </button>
          </footer>
        </form>
      </section>
    </main>
  );
}
