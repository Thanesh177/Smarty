import { memo, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import useFeed from "../hooks/useFeed";
import "./TopicsPage.css";

const slugify = (value) =>
  encodeURIComponent(
    String(value || "")
      .toLowerCase()
      .trim()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "")
  );

const topicSorter = new Intl.Collator(undefined, {
  sensitivity: "base",
  numeric: true,
});

const TopicCard = memo(function TopicCard({ topic, onNavigate }) {
  const handleClick = useCallback(() => {
    onNavigate(topic);
  }, [onNavigate, topic]);

  return (
    <button
      type="button"
      className="feed-topic-card"
      onClick={handleClick}
      aria-label={`View posts about ${topic}`}
    >
      <span className="feed-topic-icon" aria-hidden="true">#</span>
      <strong>{topic}</strong>
      <small>View posts</small>
    </button>
  );
});

export default function TopicsPage() {
  const navigate = useNavigate();
  const { posts, loading, error } = useFeed();

  const topics = useMemo(() => {
    if (!Array.isArray(posts) || posts.length === 0) return [];

    const uniqueTopics = new Set();

    for (const post of posts) {
      const topic = String(post?.topic || "").trim();
      if (!topic) continue;
      uniqueTopics.add(topic);
    }

    return Array.from(uniqueTopics).sort(topicSorter.compare);
  }, [posts]);

  const handleNavigate = useCallback(
    (topic) => {
      const slug = slugify(topic);
      if (!slug) return;
      navigate(`/feed/${slug}`);
    },
    [navigate]
  );

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
          <TopicCard
            key={topic}
            topic={topic}
            onNavigate={handleNavigate}
          />
        ))}
      </section>
    </main>
  );
}