import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import useFeed from '../hooks/useFeed';
import './TopicsPage.css';

const slugify = (value) =>
  String(value || '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-');

export default function TopicsPage() {
  const navigate = useNavigate();
  const { posts, loading, error } = useFeed();

  const topics = useMemo(() => {
    const list = posts.map((post) => post.topic).filter(Boolean);
    return [...new Set(list)];
  }, [posts]);

  return (
    <main className="topics-page">
      <h1>Explore Topics</h1>
      <p>Choose a topic to see only posts from that category.</p>

      {loading && <p className="topics-status">Loading topics...</p>}
      {error && <p className="topics-status error">{error}</p>}

      {!loading && !error && topics.length === 0 && (
        <p className="topics-status">No topics found yet.</p>
      )}

      <div className="topics-grid">
        {topics.map((topic) => (
          <button
            key={topic}
            type="button"
            className="topic-card"
            onClick={() => navigate(`/feed/${slugify(topic)}`)}
          >
            <span>#</span>
            {topic}
          </button>
        ))}
      </div>
    </main>
  );
}