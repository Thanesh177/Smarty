import useFeed from '../hooks/useFeed';
import PostCard from '../components/PostCard';

export default function FeedPage() {
  const { posts, loading, error, likePost, savePost } = useFeed();

  return (
    <section>
      <div className="hero-card">
        <div>
          <span className="eyebrow">Web extension</span>
          <h2>Educational content in a scroll-first feed</h2>
          <p>Same product direction, now accessible on desktop and tablet with AWS-ready backend integration.</p>
        </div>
      </div>

      {loading && <p className="status">Loading feed...</p>}
      {error && <p className="status error">{error}</p>}

      <div className="feed-grid">
        {posts.map((post) => (
          <PostCard key={post.id} post={post} onLike={likePost} onSave={savePost} />
        ))}
      </div>
    </section>
  );
}
