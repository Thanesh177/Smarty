import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import useFeed from "../hooks/useFeed";
import "./TopicsPage.css";

const slugify = (value) =>
  String(value || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-");

export default function TopicsPage() {
  const navigate = useNavigate();
  const { posts, loading, error } = useFeed();

  const topics = useMemo(() => {
    const list = posts.map((post) => post.topic).filter(Boolean);
    return [...new Set(list)];
  }, [posts]);

  return (
    <main className="feed-topics-page">
      <section className="feed-topics-hero">
        <p className="feed-topics-kicker">SMARTY TOPICS</p>
        <h1>Explore Topics</h1>
        <p>Choose a topic to see only posts from that category.</p>
      </section>

      {loading && <p className="feed-topics-status">Loading topics...</p>}
      {error && <p className="feed-topics-status error">{error}</p>}

      {!loading && !error && topics.length === 0 && (
        <p className="feed-topics-status">No topics found yet.</p>
      )}

      <section className="feed-topics-grid">
        {topics.map((topic) => (
          <button
            key={topic}
            type="button"
            className="feed-topic-card"
            onClick={() => navigate(`/feed/${slugify(topic)}`)}
          >
            <span className="feed-topic-icon">#</span>
            <strong>{topic}</strong>
            <small>View posts →</small>
          </button>
        ))}
      </section>
    </main>
  );
}