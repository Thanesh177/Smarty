import { memo, useMemo, useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import useFeed from "../hooks/useFeed";
import { postApi } from "../api/client";
import "./TopicsPage.css";

const normalizeTopic = (value) =>
  String(value || "")
    .normalize("NFKD")
    .toLowerCase()
    .trim()
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const getTopicValue = (value) => {
  if (value && typeof value === "object") {
    return String(
      value.name ||
        value.label ||
        value.title ||
        value.topic ||
        value.topicName ||
        value.slug ||
        ""
    ).trim();
  }

  return String(value || "").trim();
};

const topicSorter = new Intl.Collator(undefined, {
  sensitivity: "base",
  numeric: true,
});

const uniqueTopicList = (values = []) => {
  const topicsByKey = new Map();

  values.forEach((value) => {
    const topic = getTopicValue(value);
    const key = normalizeTopic(topic);

    if (!topic || !key || topicsByKey.has(key)) return;
    topicsByKey.set(key, topic);
  });

  return Array.from(topicsByKey.values()).sort(topicSorter.compare);
};

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
  const [catalogTopics, setCatalogTopics] = useState([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadTopicCatalog() {
      try {
        setCatalogLoading(true);
        setCatalogError("");

        const data = await postApi.getTopics();
        if (!cancelled) setCatalogTopics(uniqueTopicList(data));
      } catch (catalogLoadError) {
        console.error("Could not load topic catalog:", catalogLoadError);
        if (!cancelled) setCatalogError("Live topics are temporarily unavailable.");
      } finally {
        if (!cancelled) setCatalogLoading(false);
      }
    }

    loadTopicCatalog();

    return () => {
      cancelled = true;
    };
  }, []);

  const topics = useMemo(() => {
    const postTopics = [];

    if (Array.isArray(posts)) {
      for (const post of posts) {
        const rawTopics = [post?.topic, post?.topics, post?.category, post?.categories];

        rawTopics.flat().forEach((value) => {
          if (typeof value === "string" && value.includes(",")) {
            postTopics.push(...value.split(","));
          } else {
            postTopics.push(value);
          }
        });
      }
    }

    const liveTopics = uniqueTopicList([...catalogTopics, ...postTopics]);
    return liveTopics.length > 0 ? liveTopics : DEFAULT_TOPICS;
  }, [catalogTopics, posts]);

  const handleNavigate = useCallback(
    (topic) => {
      const topicValue = getTopicValue(topic);
      if (!topicValue) return;
      navigate(`/feed?topic=${encodeURIComponent(topicValue)}`);
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

      {(loading || catalogLoading) && catalogTopics.length === 0 && (
        <p className="feed-topics-status">Loading topics...</p>
      )}
      {catalogError && error && catalogTopics.length === 0 && (
        <p className="feed-topics-status error">
          We could not refresh topics. Showing the available collection.
        </p>
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
