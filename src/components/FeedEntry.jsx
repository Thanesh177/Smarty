import { useEffect, useRef, useState } from 'react';
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import FeedPage from '../pages/FeedPage';
import NewsPage from './NewsRoute';
import SmartyLanding from './landing/SmartyLanding';
import FeedHeader from './FeedHeader';
import VideoTopicPage from '../pages/VideoTopicPage';
import { canWarmVideoFeed, isVideoTopic, VIDEO_FEED_INTENT_EVENT } from '../lib/videoFeed';
import { hasSeenLanding, rememberLanding } from '../lib/initialVisit';
import { useAuth } from '../contexts/AuthContext';

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
  const { loading: authLoading } = useAuth();
  const topic = new URLSearchParams(location.search).get('topic') || pathTopic || '';
  const hasTopic = Boolean(topic.trim());
  const selectedVideo = isVideoTopic(topic);
  const [keepVideoFeed, setKeepVideoFeed] = useState(false);
  // Returning native installations can already open the feed directly.
  useEffect(() => { if (hasTopic) rememberLanding(); }, [hasTopic]);
  useEffect(() => {
    if (keepVideoFeed) return undefined;
    if (selectedVideo) { setKeepVideoFeed(true); return undefined; }
    if (!hasTopic || authLoading || !canWarmVideoFeed(navigator.connection)) return undefined;
    const warm = () => {
      if (document.visibilityState !== 'hidden' && navigator.onLine !== false
        && canWarmVideoFeed(navigator.connection)) setKeepVideoFeed(true);
    };
    // Start as soon as the account is restored instead of waiting for a hover
    // or delaying media until the first tab switch on a touch device.
    warm();
    // Keep the actual first player, not a second speculative media request.
    window.addEventListener(VIDEO_FEED_INTENT_EVENT, warm);
    return () => window.removeEventListener(VIDEO_FEED_INTENT_EVENT, warm);
  }, [authLoading, hasTopic, keepVideoFeed, selectedVideo]);
  if (!hasTopic) return <InitialVisit onOpenSearch={onOpenSearch} />;
  return <>
    {!selectedVideo && (topic.trim().toLowerCase() === 'news'
      ? <NewsFeed onOpenSearch={onOpenSearch} /> : <FeedPage onOpenSearch={onOpenSearch} />)}
    {(selectedVideo || keepVideoFeed) && <VideoTopicPage selected={selectedVideo} onOpenSearch={onOpenSearch} />}
  </>;
}
