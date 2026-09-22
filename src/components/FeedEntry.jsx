import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import FeedPage from '../pages/FeedPage';
import NewsPage from '../pages/NewsPage';
import SmartyLanding from './landing/SmartyLanding';
import { MAIN_TOPIC_LABELS } from '../data/topicTaxonomy';
import { hasSeenLanding, rememberLanding } from '../lib/initialVisit';

function InitialVisit({ onOpenSearch }) {
  const navigate = useNavigate();
  // Keep this visit stable after saving. Navigation away unmounts this gate.
  const [showLanding] = useState(() => !hasSeenLanding());
  useEffect(() => { if (showLanding) rememberLanding(); }, [showLanding]);
  if (!showLanding) return <Navigate to="/feed?topic=All" replace />;
  return (
    <main className="snap-feed-page has-smarty-landing">
      <SmartyLanding onOpenSearch={onOpenSearch}
        onSelect={topic => navigate(`/feed?topic=${encodeURIComponent(topic)}`)} />
    </main>
  );
}

function NewsFeed() {
  const pageRef = useRef(null);
  useEffect(() => {
    const scroller = pageRef.current?.closest('.content');
    scroller?.scrollTo({ top: 0, behavior: 'instant' });
    return () => scroller?.scrollTo({ top: 0, behavior: 'instant' });
  }, []);
  return (
    <main ref={pageRef} className="has-inner-feed feed-news-topic">
      <header className="feed-inner-header">
        <div className="feed-inner-heading">
          <Link className="feed-inner-back" to="/topics"><ArrowLeft size={17} /><span>Topics</span></Link>
          <div className="feed-inner-title"><h1>News</h1><p>Your daily world briefing, one sector at a time.</p></div>
        </div>
        <nav className="feed-inner-topics mobile-topic-scroll" aria-label="Select feed topic">
          {['All', ...MAIN_TOPIC_LABELS].map(topic => (
            <Link key={topic} to={`/feed?topic=${encodeURIComponent(topic)}`}
              className={`topic-pill${topic === 'News' ? ' active' : ''}`}
              aria-current={topic === 'News' ? 'page' : undefined}>{topic}</Link>
          ))}
        </nav>
      </header>
      <NewsPage briefingOnly />
    </main>
  );
}

export default function FeedEntry({ onOpenSearch }) {
  const location = useLocation();
  const { topic: pathTopic } = useParams();
  const topic = new URLSearchParams(location.search).get('topic') || pathTopic || '';
  // Returning native installations can already open the feed directly.
  useEffect(() => { if (topic.trim()) rememberLanding(); }, [topic]);
  if (!topic.trim()) return <InitialVisit onOpenSearch={onOpenSearch} />;
  if (topic.trim().toLowerCase() === 'news') return <NewsFeed />;
  return <FeedPage onOpenSearch={onOpenSearch} />;
}
