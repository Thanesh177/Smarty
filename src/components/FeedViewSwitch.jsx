import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Bookmark, Layers, Newspaper, Play } from 'lucide-react';
import { FEED_VIEWS, getFeedView } from '../lib/feedViews';
import { MAIN_TOPIC_LABELS } from '../data/topicTaxonomy';
import FeedTopicPicker from './FeedTopicPicker';
import './FeedViewSwitch.css';

const icons = { all: Layers, news: Newspaper, video: Play, saved: Bookmark };

// Mounted once above the route outlet so switching views never resets the pill.
export default function FeedViewSwitch() {
  const location = useLocation();
  const navigate = useNavigate();
  const active = getFeedView(location);
  let pathTopic = location.pathname.startsWith('/feed/') ? location.pathname.slice(6) : '';
  try { pathTopic = decodeURIComponent(pathTopic); } catch { /* Keep malformed path labels safe. */ }
  const selected = String(new URLSearchParams(location.search).get('topic') || pathTopic || 'All').trim();
  const choices = [...new Set(['All', ...MAIN_TOPIC_LABELS, selected])];
  if (!active) return null;
  return <header className="feed-view-switchbar">
    <Link className="feed-view-brand" to="/feed?topic=All" aria-label="Smarty — all posts">Smarty</Link>
    <nav className="feed-view-switch" aria-label="Feed views" style={{ '--feed-view-index': FEED_VIEWS.findIndex(view => view.id === active) }}>
      <span className="feed-view-switch-indicator" aria-hidden="true" />
      {FEED_VIEWS.map(view => {
        const Icon = icons[view.id];
        return <Link key={view.id} to={view.to} aria-label={view.label} aria-current={active === view.id ? 'page' : undefined}>
          <Icon size={15} aria-hidden="true" />
          <span className="feed-view-label">{view.label}</span>
          <span className="feed-view-compact-label" aria-hidden="true">{view.compactLabel}</span>
        </Link>;
      })}
    </nav>
    <div className="feed-view-topics">
      <FeedTopicPicker compact selected={selected} choices={choices}
        onSelect={topic => navigate('/feed?topic=' + encodeURIComponent(topic))} onBrowse={() => navigate('/topics')} />
    </div>
  </header>;
}
