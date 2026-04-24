import { useEffect, useMemo, useState } from 'react';
import { postApi } from '../api/client';
import './CreatePostPage.css';

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

  const [status, setStatus] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    postApi
      .getTopics()
      .then((data) => {
        const topicList = Array.isArray(data)
          ? data
              .map((item) =>
                typeof item === 'string'
                  ? item
                  : item.topic || item.name || item.title
              )
              .filter(Boolean)
          : [];

        setTopics(topicList);

        if (topicList.length > 0) {
          setForm((prev) => ({ ...prev, topic: topicList[0] }));
        }
      })
      .catch((err) => {
        console.error('Failed to load topics:', err);
      });
  }, []);

  const selectedTopic = useMemo(() => {
    return topicMode === 'custom' ? form.customTopic.trim() : form.topic;
  }, [topicMode, form.customTopic, form.topic]);

  const submit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setStatus('');

    try {
      const payload = {
        id: crypto.randomUUID(),
        topic: selectedTopic,
        title: form.title.trim(),
        body: form.body.trim(),
        likes: 0,
        visibility: form.visibility,
      };

      if (!payload.topic || !payload.title || !payload.body) {
        setStatus('Please fill topic, headline, and content.');
        return;
      }

      await postApi.createPost(payload);

      setStatus('Post created successfully.');

      setForm({
        topic: topics[0] || '',
        customTopic: '',
        title: '',
        body: '',
        visibility: 'public',
      });

      setTopicMode('existing');
    } catch (err) {
      console.error('Create post failed:', err);
      setStatus('Create post failed. Check your API endpoint and payload shape.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="create-page">
      <section className="create-hero">
        <div>
          <span className="create-pill">Create reel</span>
          <h1>Share something worth scrolling for.</h1>
          <p>
            Turn a useful idea, fact, insight, or explanation into a short educational post
            for the Smarty feed.
          </p>
        </div>

        <div className="create-stats">
          <div>
            <strong>01</strong>
            <span>Pick a topic</span>
          </div>
          <div>
            <strong>02</strong>
            <span>Write clearly</span>
          </div>
          <div>
            <strong>03</strong>
            <span>Publish instantly</span>
          </div>
        </div>
      </section>

      <section className="create-layout">
        <form className="create-form" onSubmit={submit}>
          <div className="form-section">
            <label>Topic</label>

            <div className="topic-row">
              <select
                value={topicMode}
                onChange={(e) => setTopicMode(e.target.value)}
              >
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
                  onChange={(e) =>
                    setForm({ ...form, customTopic: e.target.value })
                  }
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
              placeholder="Write a short, engaging educational post. Keep it clear, useful, and scroll-friendly..."
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
            />
          </div>

          <div className="bottom-row">
            <div className="form-section visibility-box">
              <label>Visibility</label>
              <select
                value={form.visibility}
                onChange={(e) =>
                  setForm({ ...form, visibility: e.target.value })
                }
              >
                <option value="public">Public</option>
                <option value="private">Private</option>
              </select>
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