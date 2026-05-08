import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import imageCompression from 'browser-image-compression';
import { postApi } from '../api/client';
import './CreatePostPage.css';

const STAGES = [
  'Preparing files',
  'Compressing image',
  'Uploading image',
  'Uploading video',
  'Publishing post',
  'Success',
];

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
        id: crypto.randomUUID(),
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

  const handleTopicModeChange = useCallback((event) => {
    setTopicMode(event.target.value);
  }, []);

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
    <main className="create-page">
      {submitting && (
        <div className="upload-loader">
          <div className="upload-orb-wrap">
            <div className="upload-orb">
              <span>{uploadStage === 'Success' ? '✓' : '↑'}</span>
            </div>

            <div className="orbit orbit-one"></div>
            <div className="orbit orbit-two"></div>
            <div className="spark spark-1"></div>
            <div className="spark spark-2"></div>
            <div className="spark spark-3"></div>
          </div>

          <h3>{uploadStage || 'Working...'}</h3>

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
          <span className="create-pill">Create reel</span>
          <h1>Share something worth scrolling for.</h1>
          <p>
            Turn a useful idea, fact, insight, or explanation into a short
            educational post for the Smarty feed.
          </p>
        </div>
      </section>

      <section className="create-layout">
        <form className="create-form" onSubmit={submit}>
          <div className="form-section">
            <label>Topic</label>

            <div className="topic-row">
              <select
                value={topicMode}
                disabled={submitting}
                onChange={handleTopicModeChange}
              >
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
                  placeholder="Example: Neuroscience, Space, Finance..."
                  value={form.customTopic}
                  disabled={submitting}
                  onChange={handleCustomTopicChange}
                />
              )}
            </div>
          </div>

          <div className="form-section">
            <label>Headline</label>
            <input
              placeholder="Example: Your brain predicts the world before you see it"
              value={form.title}
              disabled={submitting}
              onChange={handleTitleChange}
            />
          </div>

          <div className="form-section">
            <label>Content</label>
            <textarea
              rows="11"
              placeholder="Write a short, engaging educational post..."
              value={form.body}
              disabled={submitting}
              onChange={handleBodyChange}
            />
          </div>

          <div className="form-section">
            <label>Media</label>

            <div className="media-upload-grid">
              <label className="upload-card">
                <span>Image</span>

                <input
                  type="file"
                  accept="image/*"
                  disabled={submitting}
                  onChange={handleImageFileChange}
                />

                {imageFile ? (
                  <>
                    <small>{imageFile.name}</small>
                    <img
                      src={imagePreviewUrl}
                      alt="Selected preview"
                      className="image-preview"
                      loading="lazy"
                      decoding="async"
                      fetchPriority="low"
                      sizes="(max-width: 768px) 92vw, 640px"
                    />
                  </>
                ) : (
                  <small>Upload image</small>
                )}
              </label>

              <label className="upload-card">
                <span>Video</span>

                <input
                  type="file"
                  accept="video/*"
                  disabled={submitting}
                  onChange={handleVideoFileChange}
                />

                <small>{videoFile ? videoFile.name : 'Upload video'}</small>
              </label>
            </div>
          </div>

          <div className="bottom-row">
            <div className="form-section visibility-box">
              <label>Visibility</label>

              <div className="visibility-toggle">
                <button
                  type="button"
                  className={form.visibility === 'public' ? 'active' : ''}
                  disabled={submitting}
                  onClick={setPublicVisibility}
                >
                   Public
                </button>

                <button
                  type="button"
                  className={form.visibility === 'private' ? 'active' : ''}
                  disabled={submitting}
                  onClick={setPrivateVisibility}
                >
                   Private
                </button>
              </div>
            </div>

            <button
              className="primary-btn publish-btn"
              disabled={!canSubmit}
              type="submit"
            >
              {submitting ? 'Publishing...' : 'Publish reel'}
            </button>
          </div>

          {status && <p className="status">{status}</p>}
        </form>

        <aside className="create-side">
          <h3>Writing tips</h3>

          <div className="tip-card">
            <span>Hook</span>
            <p>Start with a surprising idea or a question people want answered.</p>
          </div>

          <div className="tip-card">
            <span>Clarity</span>
            <p>Use simple explanations. One post should teach one strong idea.</p>
          </div>

          <div className="tip-card">
            <span>Value</span>
            <p>End with something practical, memorable, or worth sharing.</p>
          </div>
        </aside>
      </section>
    </main>
  );
}