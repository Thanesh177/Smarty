import { useEffect, useState } from 'react';
import { userApi } from '../api/client';
import PostCard from '../components/PostCard';
import EmptyState from '../components/EmptyState';

export default function SavedPage() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    userApi
      .getSaved()
      .then(setPosts)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="status">Loading saved posts...</p>;

  return (
    <section>
      <h2 className="section-title">Saved Content</h2>
      {posts.length === 0 ? (
        <EmptyState title="No saved posts yet" description="When users bookmark educational posts, they will appear here." />
      ) : (
        <div className="feed-grid">
          {posts.map((post) => (
            <PostCard key={post.id} post={post} onLike={() => {}} onSave={() => {}} />
          ))}
        </div>
      )}
    </section>
  );
}
