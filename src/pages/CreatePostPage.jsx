import { useState } from 'react';
import { postApi } from '../api/client';

export default function CreatePostPage() {
  const [form, setForm] = useState({ topic: '', title: '', body: '' });
  const [status, setStatus] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setStatus('');

    try {
      await postApi.createPost(form);
      setStatus('Post created successfully.');
      setForm({ topic: '', title: '', body: '' });
    } catch {
      setStatus('Create post failed. Check your API endpoint and payload shape.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="panel">
      <h2>Create educational post</h2>
      <form className="create-form" onSubmit={submit}>
        <input
          placeholder="Topic"
          value={form.topic}
          onChange={(e) => setForm({ ...form, topic: e.target.value })}
        />
        <input
          placeholder="Headline"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
        />
        <textarea
          rows="8"
          placeholder="Write the educational content..."
          value={form.body}
          onChange={(e) => setForm({ ...form, body: e.target.value })}
        />
        <button className="primary-btn" disabled={submitting} type="submit">
          {submitting ? 'Publishing...' : 'Publish'}
        </button>
      </form>
      {status && <p className="status">{status}</p>}
    </section>
  );
}
