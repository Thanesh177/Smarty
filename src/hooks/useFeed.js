import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { postApi } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { getUserScopedStorageKey } from '../lib/userScopedStorage';

const FEED_CACHE_KEY = 'smarty_cached_feed_v2';
const FEED_CURSOR_KEY = 'smarty_cached_feed_cursor_v2';

const getPostTime = (post) =>
  Number(post?.createdAt || post?.updatedAt || post?.timestamp || 0);

const dedupePosts = (items) => {
  const seen = new Map();

  for (const post of items || []) {
    const id = post?.reelId || post?.id;
    if (!id) continue;

    if (!seen.has(id)) {
      seen.set(id, post);
    }
  }

  return Array.from(seen.values()).sort((a, b) => getPostTime(b) - getPostTime(a));
};

export default function useFeed() {
  const { user } = useAuth();
  const userId = user?.userId || user?.sub || user?.id || '';
  const feedCacheKey = useMemo(
    () => getUserScopedStorageKey(FEED_CACHE_KEY, userId),
    [userId]
  );
  const feedCursorKey = useMemo(
    () => getUserScopedStorageKey(FEED_CURSOR_KEY, userId),
    [userId]
  );
  const hasFetched = useRef(false);
  const preloadingRef = useRef(false);
  const activeCacheScopeRef = useRef(userId);

  const [posts, setPosts] = useState(() => {
    try {
      const cached = localStorage.getItem(feedCacheKey);
      return cached ? dedupePosts(JSON.parse(cached)) : [];
    } catch {
      return [];
    }
  });

  const [nextCursor, setNextCursor] = useState(() => {
    return localStorage.getItem(feedCursorKey) || null;
  });

  const [preloadedPage, setPreloadedPage] = useState(null);
  const [loading, setLoading] = useState(posts.length === 0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');

  const saveCache = useCallback((items, cursor) => {
    try {
      localStorage.setItem(feedCacheKey, JSON.stringify(items));

      if (cursor) {
        localStorage.setItem(feedCursorKey, cursor);
      } else {
        localStorage.removeItem(feedCursorKey);
      }
    } catch {
      // ignore storage quota errors
    }
  }, [feedCacheKey, feedCursorKey]);

  useEffect(() => {
    if (activeCacheScopeRef.current === userId) return;

    activeCacheScopeRef.current = userId;
    hasFetched.current = false;
    preloadingRef.current = false;

    try {
      const cached = localStorage.getItem(feedCacheKey);
      const cachedPosts = cached ? dedupePosts(JSON.parse(cached)) : [];

      setPosts(cachedPosts);
      setNextCursor(localStorage.getItem(feedCursorKey) || null);
      setLoading(cachedPosts.length === 0);
    } catch {
      setPosts([]);
      setNextCursor(null);
      setLoading(true);
    }

    setPreloadedPage(null);
    setError('');
  }, [feedCacheKey, feedCursorKey, userId]);

  const fetchPage = useCallback(async (cursor = null) => {
    return postApi.getFeed({
      limit: 10,
      cursor,
    });
  }, []);

  const preloadNextPage = useCallback(
    async (cursor) => {
      if (!cursor || preloadingRef.current) return;

      try {
        preloadingRef.current = true;

        const data = await fetchPage(cursor);

        setPreloadedPage({
          items: data.items || [],
          nextCursor: data.nextCursor || null,
        });
      } catch (err) {
        console.error('Preload failed:', err);
      } finally {
        preloadingRef.current = false;
      }
    },
    [fetchPage]
  );

  const refreshFeed = useCallback(async () => {
    try {
      setError('');
      setLoading(posts.length === 0);

      const data = await fetchPage(null);
      const freshItems = dedupePosts(data.items || []);
      const cursor = data.nextCursor || null;

      setPosts(freshItems);
      setNextCursor(cursor);
      setPreloadedPage(null);
      saveCache(freshItems, cursor);

      preloadNextPage(cursor);
    } catch (err) {
      console.error('Feed load failed:', err);
      setError('Failed to load feed.');
    } finally {
      setLoading(false);
    }
  }, [fetchPage, posts.length, preloadNextPage, saveCache]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !nextCursor) return;

    try {
      setError('');
      setLoadingMore(true);

      let page = preloadedPage;

      if (!page) {
        const data = await fetchPage(nextCursor);
        page = {
          items: data.items || [],
          nextCursor: data.nextCursor || null,
        };
      }

      const mergedCursor = page.nextCursor || null;

      setPosts((current) => {
        const updated = dedupePosts([...current, ...(page.items || [])]);
        saveCache(updated, mergedCursor);
        return updated;
      });

      setNextCursor(mergedCursor);
      setPreloadedPage(null);

      preloadNextPage(mergedCursor);
    } catch (err) {
      console.error('Load more failed:', err);
      setError('Failed to load more posts.');
    } finally {
      setLoadingMore(false);
    }
  }, [fetchPage, loadingMore, nextCursor, preloadedPage, preloadNextPage, saveCache]);

  useEffect(() => {
    if (hasFetched.current) return;

    hasFetched.current = true;
    refreshFeed();
  }, [refreshFeed]);

  const likePost = async (postId) => {
    setPosts((current) => {
      const updated = current.map((post) =>
        post.id === postId || post.reelId === postId
          ? { ...post, likes: (post.likes || 0) + 1 }
          : post
      );

      saveCache(updated, nextCursor);
      return updated;
    });

    try {
      await postApi.toggleLike(postId);
    } catch {
      setError('Could not update like.');
    }
  };

  const savePost = async (postId) => {
    setPosts((current) => {
      const updated = current.map((post) =>
        post.id === postId || post.reelId === postId
          ? { ...post, saved: !post.saved }
          : post
      );

      saveCache(updated, nextCursor);
      return updated;
    });

    try {
      await postApi.toggleSave(postId);
    } catch {
      setError('Could not update save.');
    }
  };

  return {
    posts,
    loading,
    loadingMore,
    error,
    nextCursor,
    loadMore,
    refreshFeed,
    likePost,
    savePost,
  };
}
