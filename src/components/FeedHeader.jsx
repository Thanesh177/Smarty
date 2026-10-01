import { useId } from 'react';
import { BookOpen, ChevronDown, Compass, Cpu, FlaskConical, Globe2, HeartPulse, Landmark, LayoutGrid, Leaf, Newspaper, Palette, TrendingUp, UsersRound, Wrench } from 'lucide-react';
import { MAIN_TOPIC_LABELS } from '../data/topicTaxonomy';

const TOPIC_ICONS = {
  All: BookOpen, News: Newspaper, Technology: Cpu, Engineering: Wrench,
  'Science & Mathematics': FlaskConical, 'Life Sciences': Leaf,
  'Earth & Space': Globe2, 'Mind & Health': HeartPulse,
  'Money & Business': TrendingUp, 'Food & Agriculture': Leaf,
  History: Landmark, 'Society & Ideas': UsersRound, 'Arts & Design': Palette,
};

// Native topic selection keeps the header compact and works with touch,
// keyboard, and screen readers without a second scrolling navigation row.
export default function FeedHeader({ topic, onSelect, onBack, status = '' }) {
  const statusId = useId();
  const selected = String(topic || 'All').trim();
  const choices = [...new Set(['All', ...MAIN_TOPIC_LABELS, selected])];
  const title = selected === 'All' ? 'All posts' : selected;
  const TopicIcon = TOPIC_ICONS[selected] || Compass;

  return (
    <header className="feed-inner-header">
      <div className="feed-inner-heading">
        <button type="button" className="feed-inner-back" onClick={onBack} aria-label="Browse all topics" title="Browse all topics">
          <LayoutGrid size={18} strokeWidth={1.7} aria-hidden="true" />
        </button>
        <div className="feed-inner-title feed-topic-switch">
          <h1 className="feed-header-sr-only">{title}</h1>
          <span className="feed-topic-current" key={selected} aria-hidden="true">
            <TopicIcon size={18} strokeWidth={1.7} />
            <span>{title}</span>
          </span>
          <select
            className="feed-topic-select"
            aria-label="Change feed topic"
            aria-describedby={status ? statusId : undefined}
            title={title}
            value={selected}
            onChange={(event) => onSelect(event.target.value)}
          >
            {choices.map((choice) => <option key={choice} value={choice}>{choice === 'All' ? 'All posts' : choice}</option>)}
          </select>
          <ChevronDown size={15} strokeWidth={1.8} aria-hidden="true" />
        </div>
      </div>
      {status && <p id={statusId} className="feed-header-sr-only" role="status">{status}</p>}
    </header>
  );
}
