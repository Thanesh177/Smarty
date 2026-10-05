import { useId } from 'react';
import { Link } from 'react-router-dom';
import { Search } from 'lucide-react';
import { MAIN_TOPIC_LABELS } from '../data/topicTaxonomy';
import FeedTopicPicker from './FeedTopicPicker';

// Equal side columns keep the name centered regardless of the selected topic.
export default function FeedHeader({ topic, onSelect, onBack, onOpenSearch, status = '' }) {
  const statusId = useId();
  const selected = String(topic || 'All').trim();
  const choices = [...new Set(['All', ...MAIN_TOPIC_LABELS, selected])];
  const title = selected === 'All' ? 'Your feed' : selected;

  return (
    <header className="feed-inner-header">
      <div className="feed-inner-heading">
        <h1 className="feed-header-sr-only">{title}</h1>
        <FeedTopicPicker selected={selected} choices={choices} onSelect={onSelect} onBrowse={onBack} />
      </div>
      <Link className="feed-header-brand" to="/feed?topic=All" aria-label="Smarty — all posts">Smarty</Link>
      <button type="button" className="feed-header-search" onClick={() => onOpenSearch?.()} aria-label="Search Smarty"><Search size={18} /><span>Search anything</span><kbd>/</kbd></button>
      {status && <p id={statusId} className="feed-header-sr-only" role="status">{status}</p>}
    </header>
  );
}
