import { memo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import { MAIN_TOPICS } from "../data/topicTaxonomy";
import "./TopicsPage.css";

const TopicCard = memo(function TopicCard({ topic, onNavigate }) {
  const handleClick = useCallback(() => {
    onNavigate(topic.label);
  }, [onNavigate, topic]);

  return (
    <button
      type="button"
      className="feed-topic-card"
      onClick={handleClick}
      aria-label={`View posts about ${topic.label}`}
    >
      <span className="feed-topic-card-topline">
        <span className="feed-topic-index" aria-hidden="true">
          {String(topic.order + 1).padStart(2, "0")}
        </span>
        <span className="feed-topic-count">
          {topic.acceptsUnknownTopics ? "Open subjects" : `${topic.topics.length} subjects`}
        </span>
      </span>
      <span className="feed-topic-card-copy">
        <small>{topic.eyebrow}</small>
        <strong>{topic.label}</strong>
        <span>{topic.description}</span>
      </span>
      <span className="feed-topic-card-footer">
        <span>{topic.topics.slice(0, 3).join(" · ")}</span>
        <ArrowUpRight size={18} strokeWidth={1.8} aria-hidden="true" />
      </span>
    </button>
  );
});

export default function TopicsPage() {
  const navigate = useNavigate();

  const handleNavigate = useCallback(
    (topic) => {
      navigate(`/feed?topic=${encodeURIComponent(topic)}`);
    },
    [navigate]
  );

  return (
    <main className="feed-topics-page">
      <section className="feed-topics-hero">
        <p className="feed-topics-kicker">SMARTY TOPICS</p>
        <h1>Choose a world to explore.</h1>
        <p>
          Start with a broad interest. Smarty brings the related subjects and
          specific posts together inside one focused feed.
        </p>
      </section>

      <section className="feed-topics-grid">
        {MAIN_TOPICS.map((topic, order) => (
          <TopicCard
            key={topic.id}
            topic={{ ...topic, order }}
            onNavigate={handleNavigate}
          />
        ))}
      </section>
    </main>
  );
}
