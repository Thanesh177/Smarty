import { useEffect, useMemo, useState } from 'react';
import { postApi } from '../api/client';
import './CreatePostPage.css';

const STAGES = [
  'Preparing files',
  'Uploading image',
  'Uploading video',
  'Publishing post',
  'Success',
];

export default function CreatePostPage() {
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

  useEffect(() => {
    postApi.getTopics().then((data) => {
      const topicList = Array.isArray(data)
        ? data
            .map((item) =>
              typeof item === 'string' ? item : item.topic || item.name || item.title
            )
            .filter(Boolean)
        : [];

      setTopics(topicList);

      if (topicList.length > 0) {
        setForm((prev) => ({ ...prev, topic: topicList[0] }));
      }
    });
  }, []);

  const selectedTopic = useMemo(() => {
    return topicMode === 'custom' ? form.customTopic.trim() : form.topic;
  }, [topicMode, form.customTopic, form.topic]);

  const uploadFile = async (file, onProgress) => {
    if (!file) return '';

    const uploadData = await postApi.getUploadUrl({
      fileName: file.name,
      fileType: file.type,
    });

    await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percent = Math.round((event.loaded / event.total) * 100);
          onProgress(percent);
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) resolve();
        else reject(new Error(`Upload failed: ${xhr.status}`));
      };

      xhr.onerror = () => reject(new Error('Upload failed'));

      xhr.open('PUT', uploadData.uploadUrl);
      xhr.setRequestHeader('Content-Type', file.type);
      xhr.send(file);
    });

    return uploadData.fileUrl;
  };

  const resetForm = () => {
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
  };

  const submit = async (event) => {
    event.preventDefault();
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
      let videoUrl = '';

      if (imageFile) {
        setUploadStage('Uploading image');
        setUploadProgress(0);
        imageUrl = await uploadFile(imageFile, setUploadProgress);
      }

      if (videoFile) {
        setUploadStage('Uploading video');
        setUploadProgress(0);
        videoUrl = await uploadFile(videoFile, setUploadProgress);
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
        videoUrl,
      });

      setUploadStage('Success');
      setUploadProgress(100);
      setStatus('Post created successfully.');
      resetForm();

      setTimeout(() => {
        setSubmitting(false);
        setUploadStage('');
        setUploadProgress(0);
      }, 1200);
    } catch (err) {
      console.error('Create post failed:', err);
      setStatus('Failed to publish.');
      setSubmitting(false);
      setUploadStage('');
      setUploadProgress(0);
    }
  };

  const activeStageIndex = STAGES.indexOf(uploadStage);

  return (
    <main className="create-page">
      {submitting && (
        <div className="upload-loader">
          <div className="upload-orb-wrap">
            <div className="upload-orb">
              {uploadStage === 'Success' ? '✓' : '↑'}
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
            Turn a useful idea, fact, insight, or explanation into a short educational post
            for the Smarty feed.
          </p>
        </div>
      </section>

      <section className="create-layout">
        <form className="create-form" onSubmit={submit}>
          <div className="form-section">
            <label>Topic</label>

            <div className="topic-row">
              <select value={topicMode} onChange={(e) => setTopicMode(e.target.value)}>
                <option value="existing">Choose topic</option>
                <option value="custom">Custom topic</option>
              </select>

              {topicMode === 'existing' ? (
                <select
                  value={form.topic}
                  onChange={(e) => setForm({ ...form, topic: e.target.value })}
                >
                  {topics.length === 0 ? (
                    <option value="">No topics found</option>
                  ) : (
                    topics.map((topic) => (
                      <option key={topic} value={topic}>
                        {topic}
                      </option>
                    ))
                  )}
                </select>
              ) : (
                <input
                  placeholder="Example: Neuroscience, Space, Finance..."
                  value={form.customTopic}
                  onChange={(e) => setForm({ ...form, customTopic: e.target.value })}
                />
              )}
            </div>
          </div>

          <div className="form-section">
            <label>Headline</label>
            <input
              placeholder="Example: Your brain predicts the world before you see it"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </div>

          <div className="form-section">
            <label>Content</label>
            <textarea
              rows="11"
              placeholder="Write a short, engaging educational post..."
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
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
                  onChange={(e) => setImageFile(e.target.files?.[0] || null)}
                />
                <small>{imageFile ? imageFile.name : 'Upload image'}</small>
              </label>

              <label className="upload-card">
                <span>Video</span>
                <input
                  type="file"
                  accept="video/*"
                  onChange={(e) => setVideoFile(e.target.files?.[0] || null)}
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
                  onClick={() => setForm({ ...form, visibility: 'public' })}
                >
                  🌍 Public
                </button>

                <button
                  type="button"
                  className={form.visibility === 'private' ? 'active' : ''}
                  onClick={() => setForm({ ...form, visibility: 'private' })}
                >
                  🔒 Private
                </button>
              </div>
            </div>

            <button className="primary-btn publish-btn" disabled={submitting} type="submit">
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