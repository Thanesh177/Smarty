import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { postApi } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { getUserScopedStorageKey } from '../lib/userScopedStorage';

const FEED_CACHE_KEY = 'smarty_cached_feed_v2';
const FEED_CURSOR_KEY = 'smarty_cached_feed_cursor_v2';
const BLOCKED_CREATORS_KEY = 'smarty_blocked_creators_v1';

const getPostCreatorId = (post) =>
  String(
    post?.creatorId ||
      post?.authorId ||
      post?.userId ||
      post?.author?.id ||
      post?.author?.userId ||
      post?.creator?.id ||
      post?.creator?.userId ||
      post?.user?.id ||
      post?.user?.userId ||
      ''
  ).trim();

const getPostTime = (post) =>
  Number(post?.createdAt || post?.updatedAt || post?.timestamp || 0);

const getPostId = (post) =>
  String(post?.reelId || post?.postId || post?.id || '').trim();

const setPostSavedState = (post, saved) => ({
  ...post,
  saved,
  isSaved: saved,
  bookmarked: saved,
  isBookmarked: saved,
  savedByCurrentUser: saved,
});

const dedupePosts = (items) => {
  const seen = new Map();

  for (const post of items || []) {
    const id = getPostId(post);
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
  const blockedCreatorsKey = useMemo(
    () => getUserScopedStorageKey(BLOCKED_CREATORS_KEY, userId),
    [userId]
  );
  const blockedCreatorIdsRef = useRef(new Set());
  const hasFetched = useRef(false);
  const lastFetchedScopeRef = useRef('');
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

  const readBlockedCreatorIds = useCallback(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(blockedCreatorsKey) || '[]');
      return new Set(
        Array.isArray(stored)
          ? stored.map((id) => String(id || '').trim()).filter(Boolean)
          : []
      );
    } catch {
      return new Set();
    }
  }, [blockedCreatorsKey]);

  const removeBlockedPosts = useCallback(
    (items) => {
      const blockedIds = blockedCreatorIdsRef.current;
      if (!blockedIds.size) return items || [];

      return (items || []).filter(
        (post) => !blockedIds.has(getPostCreatorId(post))
      );
    },
    []
  );

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
    blockedCreatorIdsRef.current = readBlockedCreatorIds();
    hasFetched.current = false;
    preloadingRef.current = false;

    try {
      const cached = localStorage.getItem(feedCacheKey);
      const cachedPosts = cached
        ? removeBlockedPosts(dedupePosts(JSON.parse(cached)))
        : [];

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
  }, [
    feedCacheKey,
    feedCursorKey,
    readBlockedCreatorIds,
    removeBlockedPosts,
    userId,
  ]);

  useEffect(() => {
    blockedCreatorIdsRef.current = readBlockedCreatorIds();
    setPosts((current) => removeBlockedPosts(current));
  }, [readBlockedCreatorIds, removeBlockedPosts]);

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
      const freshItems = removeBlockedPosts(dedupePosts(data.items || []));
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
  }, [
    fetchPage,
    posts.length,
    preloadNextPage,
    removeBlockedPosts,
    saveCache,
  ]);

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
        const updated = removeBlockedPosts(
          dedupePosts([...current, ...(page.items || [])])
        );
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
  }, [
    fetchPage,
    loadingMore,
    nextCursor,
    preloadedPage,
    preloadNextPage,
    removeBlockedPosts,
    saveCache,
  ]);

  useEffect(() => {
    const currentScope = userId || 'guest';

    if (
      hasFetched.current &&
      lastFetchedScopeRef.current === currentScope
    ) {
      return;
    }

    hasFetched.current = true;
    lastFetchedScopeRef.current = currentScope;
    refreshFeed();
  }, [refreshFeed, userId]);

  const likePost = async (postId) => {
    setPosts((current) => {
      const updated = current.map((post) =>
        getPostId(post) === String(postId)
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

  const savePost = async (postId, isCurrentlySaved = false) => {
    const optimisticSavedState = !Boolean(isCurrentlySaved);

    setPosts((current) => {
      const updated = current.map((post) =>
        getPostId(post) === String(postId)
          ? setPostSavedState(post, optimisticSavedState)
          : post
      );

      saveCache(updated, nextCursor);
      return updated;
    });

    try {
      const data = await postApi.toggleSave(postId);
      const serverSavedState = typeof data?.isSaved === 'boolean'
        ? data.isSaved
        : typeof data?.saved === 'boolean'
          ? data.saved
          : typeof data?.bookmarked === 'boolean'
            ? data.bookmarked
            : optimisticSavedState;

      if (serverSavedState !== optimisticSavedState) {
        setPosts((current) => {
          const updated = current.map((post) =>
            getPostId(post) === String(postId)
              ? setPostSavedState(post, serverSavedState)
              : post
          );

          saveCache(updated, nextCursor);
          return updated;
        });
      }

      return {
        ...(data && typeof data === 'object' ? data : {}),
        isSaved: serverSavedState,
      };
    } catch (saveError) {
      setPosts((current) => {
        const rolledBack = current.map((post) =>
          getPostId(post) === String(postId)
            ? setPostSavedState(post, Boolean(isCurrentlySaved))
            : post
        );

        saveCache(rolledBack, nextCursor);
        return rolledBack;
      });

      // Bookmark failures belong to the button action, not the feed loader.
      // The caller presents a toast while the selected topic remains usable.
      throw saveError;
    }
  };

  const hidePost = useCallback(
    (postId) => {
      const normalizedId = String(postId || '').trim();
      if (!normalizedId) return;

      setPreloadedPage((current) => (
        current
          ? {
              ...current,
              items: (current.items || []).filter(
                (post) => getPostId(post) !== normalizedId
              ),
            }
          : current
      ));

      setPosts((current) => {
        const updated = current.filter(
          (post) => getPostId(post) !== normalizedId
        );
        saveCache(updated, nextCursor);
        return updated;
      });
    },
    [nextCursor, saveCache]
  );

  const blockCreator = useCallback(
    (creatorId) => {
      const normalizedId = String(creatorId || '').trim();
      if (!normalizedId) return;

      blockedCreatorIdsRef.current.add(normalizedId);

      try {
        localStorage.setItem(
          blockedCreatorsKey,
          JSON.stringify([...blockedCreatorIdsRef.current])
        );
      } catch {
        // The in-memory removal still takes effect when storage is unavailable.
      }

      setPreloadedPage((current) =>
        current
          ? {
              ...current,
              items: removeBlockedPosts(current.items),
            }
          : current
      );

      setPosts((current) => {
        const updated = removeBlockedPosts(current);
        saveCache(updated, nextCursor);
        return updated;
      });
    },
    [blockedCreatorsKey, nextCursor, removeBlockedPosts, saveCache]
  );

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
    hidePost,
    blockCreator,
  };
}
