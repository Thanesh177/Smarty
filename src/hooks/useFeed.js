import { useEffect, useState } from 'react';
import { postApi } from '../api/client';

export default function useFeed() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    postApi
      .getFeed()
      .then(setPosts)
      .catch(() => setError('Failed to load feed.'))
      .finally(() => setLoading(false));
  }, []);

  const likePost = async (postId) => {
    setPosts((current) =>
      current.map((post) =>
        post.id === postId ? { ...post, likes: post.likes + 1 } : post
      )
    );
    try {
      await postApi.toggleLike(postId);
    } catch {
      setError('Could not update like.');
    }
  };

  const savePost = async (postId) => {
    setPosts((current) =>
      current.map((post) =>
        post.id === postId ? { ...post, saved: !post.saved } : post
      )
    );
    try {
      await postApi.toggleSave(postId);
    } catch {
      setError('Could not update save status.');
    }
  };

  return { posts, loading, error, likePost, savePost };
}
