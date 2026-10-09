import { useEffect, useRef, useState } from 'react';
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import FeedPage from '../pages/FeedPage';
import NewsPage from '../pages/NewsPage';
import SmartyLanding from './landing/SmartyLanding';
import FeedHeader from './FeedHeader';
import VideoTopicPage from '../pages/VideoTopicPage';
import { isVideoTopic } from '../lib/videoFeed';
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

function NewsFeed({ onOpenSearch }) {
  const navigate = useNavigate();
  const pageRef = useRef(null);
  useEffect(() => {
    const scroller = pageRef.current?.closest('.content');
    scroller?.scrollTo({ top: 0, behavior: 'instant' });
    return () => scroller?.scrollTo({ top: 0, behavior: 'instant' });
  }, []);
  return (
    <main ref={pageRef} className="has-inner-feed feed-news-topic">
      <FeedHeader topic="News" onBack={() => navigate('/topics')} onOpenSearch={onOpenSearch}
        onSelect={(topic) => navigate(`/feed?topic=${encodeURIComponent(topic)}`)} />
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
  if (topic.trim().toLowerCase() === 'news') return <NewsFeed onOpenSearch={onOpenSearch} />;
  if (isVideoTopic(topic)) return <VideoTopicPage onOpenSearch={onOpenSearch} />;
  return <FeedPage onOpenSearch={onOpenSearch} />;
}
