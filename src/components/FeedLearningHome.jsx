import { Link } from 'react-router-dom';
import { BookOpen, Newspaper, Play } from 'lucide-react';

// Keep only the feed views here; topics remain in the header selector.
export default function FeedLearningHome() {
  return <div className="feed-learning-home">
    <nav className="feed-home-tabs" aria-label="Feed views">
      <span aria-current="page">All posts</span>
      <Link to="/learn"><BookOpen size={14} />My learning</Link>
      <Link to="/feed?topic=News"><Newspaper size={14} />News</Link>
      <Link to="/feed?topic=Video"><Play size={14} />Video</Link>
      <Link to="/saved">Saved</Link>
    </nav>
  </div>;
}
