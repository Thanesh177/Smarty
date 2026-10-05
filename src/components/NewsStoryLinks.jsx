import { Link, useLocation } from 'react-router-dom';
import { useState } from 'react';
import { ArrowUpRight, History, X } from 'lucide-react';
import { storyTimelineUrl, storyQuery } from '../lib/newsStories';
import { savedStoryUrl } from '../lib/newsStoryLibrary';
import useNewsStoryLibrary from '../hooks/useNewsStoryLibrary';
import './NewsStoryLinks.css';

export function NewsStoryLink({ story }) {
  const location = useLocation();
  const to = storyTimelineUrl(story);
  if (!to) return null;
  return <Link className="news-story-link" to={to} state={{ from: location.pathname + location.search,
    origin: { query: storyQuery(story), title: story.title, source: story.source, url: story.news_link } }}>
    <History size={15} aria-hidden="true" /> Follow the story <ArrowUpRight size={14} aria-hidden="true" />
  </Link>;
}

export function SavedNewsStories() {
  const { entries, update } = useNewsStoryLibrary();
  const location = useLocation();
  const [status, setStatus] = useState('');
  const saved = entries.filter(entry => entry.saved);
  if (!saved.length && !status) return null;
  return <section className="news-story-shelf" aria-label="Saved story timelines">
    {saved.length > 0 && <details open>
      <summary>Saved stories <span>{saved.length}</span></summary>
      <p>Pick up where you left off. Saved on this device for your account.</p>
      <ul>{saved.map(entry => <li key={entry.query.toLocaleLowerCase()}>
        <Link to={savedStoryUrl(entry)} state={{from: location.pathname + location.search}}>
          <History size={16} aria-hidden="true" /><span>{entry.query}<small>{entry.year === 'recent' ? 'Latest coverage' : entry.year}{entry.opened.length > 0 ? ` · ${entry.opened.length} reports opened` : ''}</small></span>
          <ArrowUpRight size={16} aria-hidden="true" />
        </Link>
        <button type="button" aria-label={`Remove saved story ${entry.query}`} onClick={() => {
          const result = update(entry.query, {saved:false}); setStatus(result.ok ? 'Story removed from your saved list.' : result.error);
        }}><X size={16} aria-hidden="true" /></button>
      </li>)}</ul>
    </details>}
    {status && <p role="status">{status}</p>}
  </section>;
}
