import { useEffect, useState } from 'react';
import { userApi } from '../api/client';
import PostCard from '../components/PostCard';
import EmptyState from '../components/EmptyState';
import './SavedPage.css';

export default function SavedPage() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    userApi
      .getSaved()
      .then((data) => {
        setPosts(Array.isArray(data) ? data : []);
      })
      .catch((err) => {
        console.error('Saved reels error:', err);
        setError('Failed to load saved content.');
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="saved-page">
      <section className="saved-hero">
        <div>
          <span className="saved-pill">Your library</span>
          <h1>Saved knowledge, ready when you are.</h1>
          <p>
            Revisit the educational reels and posts you bookmarked while scrolling.
          </p>
        </div>

        <div className="saved-summary">
          <strong>{posts.length}</strong>
          <span>saved items</span>
        </div>
      </section>

      <section className="saved-content">
        <div className="saved-heading-row">
          <h2>Saved Content</h2>
          <p>Everything you saved from the Smarty feed appears here.</p>
        </div>

        {loading ? (
          <p className="status">Loading saved posts...</p>
        ) : error ? (
          <p className="status error">{error}</p>
        ) : posts.length === 0 ? (
          <EmptyState
            title="No saved posts yet"
            description="When you bookmark educational posts, they will appear here."
          />
        ) : (
          <div className="saved-grid">
            {posts.map((post) => (
              <PostCard
                key={post.id || post.reelId}
                post={post}
                onLike={() => {}}
                onSave={() => {}}
              />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}