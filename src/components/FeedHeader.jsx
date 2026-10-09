import { useId } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { getFeedView } from '../lib/feedViews';
import { MAIN_TOPIC_LABELS } from '../data/topicTaxonomy';
import FeedTopicPicker from './FeedTopicPicker';

// Equal side columns keep the name centered regardless of the selected topic.
export default function FeedHeader({ topic, onSelect, onBack, status = '' }) {
  const statusId = useId();
  const hasSharedHeader = Boolean(getFeedView(useLocation()));
  const selected = String(topic || 'All').trim();
  const choices = [...new Set(['All', ...MAIN_TOPIC_LABELS, selected])];
  const title = selected === 'All' ? 'Your feed' : selected;

  // Keep the page title and loading announcements accessible without a second row.
  if (hasSharedHeader) return <div className="feed-view-route-label">
    <h1>{title}</h1>{status && <p id={statusId} role="status">{status}</p>}
  </div>;

  return (
    <header className="feed-inner-header">
      <div className="feed-inner-heading">
        <h1 className="feed-header-sr-only">{title}</h1>
        <FeedTopicPicker selected={selected} choices={choices} onSelect={onSelect} onBrowse={onBack} />
      </div>
      <Link className="feed-header-brand" to="/feed?topic=All" aria-label="Smarty — all posts">Smarty</Link>
      {status && <p id={statusId} className="feed-header-sr-only" role="status">{status}</p>}
    </header>
  );
}
