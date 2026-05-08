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

const DEFAULT_TOPICS = [
  "Finance", "Investing", "Personal Finance", "Stock Market", "Trading",
  "Psychology", "Human Behavior", "Decision Making", "Habits", "Motivation",
  "Neuroscience", "Memory", "Learning", "Brain Function",
  "Technology", "Artificial Intelligence", "Cybersecurity", "Software Systems",
  "Business", "Startups", "Entrepreneurship", "Marketing",
  "Economics", "Global Economy", "Consumer Behavior",
  "Health", "Mental Health", "Nutrition", "Sleep", "Fitness",
  "Space", "Astronomy", "Physics", "Gravity", "Black Holes",
  "Climate Change", "Environment", "Sustainability",
  "History", "Ancient Civilizations", "Society", "Culture",
  "Productivity", "Focus", "Self Improvement", "Discipline",
];

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
    const uniqueTopics = new Set(DEFAULT_TOPICS);

    if (Array.isArray(posts)) {
      for (const post of posts) {
        const topic = String(post?.topic || "").trim();
        if (!topic) continue;
        uniqueTopics.add(topic);
      }
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