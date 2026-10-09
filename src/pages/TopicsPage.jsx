import { memo, useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowUpRight, Search, X } from "lucide-react";
import { MAIN_TOPICS, getMainTopicDefinition } from "../data/topicTaxonomy";
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
          {topic.feedOnly ? "Swipe to explore" : topic.acceptsUnknownTopics ? "Open subjects" : `${topic.topics.length} subjects`}
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
  const [search, setSearch] = useState('');
  const topics = useMemo(() => {
    const query = search.trim().toLowerCase();
    const matched = getMainTopicDefinition(query);
    return MAIN_TOPICS.map((topic, order) => ({ ...topic, order })).filter((topic) =>
      !query || topic.id === matched?.id || [topic.label, topic.description, ...topic.topics].join(' ').toLowerCase().includes(query)
    );
  }, [search]);

  const handleNavigate = useCallback(
    (topic) => {
      navigate(`/feed?topic=${encodeURIComponent(topic)}`);
    },
    [navigate]
  );

  return (
    <main className="feed-topics-page is-topic-directory">
      <section className="feed-topics-hero">
        <p className="feed-topics-kicker">Follow your curiosity</p>
        <h1>Find something that draws you in.</h1>
        <p>
          Start with an interest. Discover the details, questions, and connections within it.
        </p>
      </section>

      <div className="topic-directory-tools">
        <label className="topic-directory-search">
          <Search size={18} aria-hidden="true" />
          <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Find a subject. Try AI, sleep, history…" aria-label="Find a subject" />
          {search && <button type="button" onClick={() => setSearch('')} aria-label="Clear subject search"><X size={17} /></button>}
        </label>
        <span role="status">{topics.length} {topics.length === 1 ? 'topic' : 'topics'}</span>
        <button type="button" className="topic-directory-all" onClick={() => handleNavigate('All')}>All posts <ArrowUpRight size={17} /></button>
      </div>
      <section className="feed-topics-grid" aria-label="Learning topics">
        {topics.map((topic) => (
          <TopicCard
            key={topic.id}
            topic={topic}
            onNavigate={handleNavigate}
          />
        ))}
      </section>
      {topics.length === 0 && <div className="topic-directory-empty"><h2>No topics found.</h2><p>Try a broader subject, or explore the full collection.</p><button type="button" onClick={() => setSearch('')}>Show all topics</button></div>}
    </main>
  );
}
