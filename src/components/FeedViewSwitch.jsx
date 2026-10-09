import { Link, useLocation } from 'react-router-dom';
import { BookOpen, Bookmark, Layers, Newspaper, Play } from 'lucide-react';
import { FEED_VIEWS, getFeedView } from '../lib/feedViews';
import './FeedViewSwitch.css';

const icons = { all: Layers, learn: BookOpen, news: Newspaper, video: Play, saved: Bookmark };

// Mounted once above the route outlet so switching views never resets the pill.
export default function FeedViewSwitch() {
  const active = getFeedView(useLocation());
  if (!active) return null;
  return <div className="feed-view-switchbar">
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
  </div>;
}
