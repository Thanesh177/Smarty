import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { postApi } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { getUserScopedStorageKey } from '../lib/userScopedStorage';
import { getVideoPosts, unseenVideoCursor, videoCursorKey } from '../lib/videoFeed';

const FEED_CACHE_KEY = 'smarty_cached_feed_v2';
const FEED_CURSOR_KEY = 'smarty_cached_feed_cursor_v2';
const BLOCKED_CREATORS_KEY = 'smarty_blocked_creators_v1';
const FEED_MODERATION_EVENT = 'smarty:feed-moderated';

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

export default function useFeed({ pageSize = 10, videoOnly = false } = {}) {
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
  const hiddenPostIdsRef = useRef(new Set());
  const hasFetched = useRef(false);
  const lastFetchedScopeRef = useRef('');
  const preloadedPageRef = useRef(null);
  const generationRef = useRef(0);
  const visitedVideoCursors = useRef(new Set());
  const loadRequestRef = useRef(null);
  const activeCacheScopeRef = useRef(userId);

  const [posts, setPosts] = useState(() => {
    if (videoOnly) return [];
    try {
      const cached = localStorage.getItem(feedCacheKey);
      return cached ? dedupePosts(JSON.parse(cached)) : [];
    } catch {
      return [];
    }
  });

  const [nextCursor, setNextCursor] = useState(() => {
    if (videoOnly) return null;
    try { return localStorage.getItem(feedCursorKey) || null; }
    catch { return null; }
  });

  const [loading, setLoading] = useState(posts.length === 0);
  const [refreshing, setRefreshing] = useState(true);
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
      const hiddenIds = hiddenPostIdsRef.current;
      if (!blockedIds.size && !hiddenIds.size) return items || [];

      return (items || []).filter(
        (post) => !blockedIds.has(getPostCreatorId(post)) && !hiddenIds.has(getPostId(post))
      );
    },
    []
  );

  const saveCache = useCallback((items, cursor) => {
    if (videoOnly) return;
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
  }, [feedCacheKey, feedCursorKey, videoOnly]);

  // A warmed Videos view can be mounted behind All posts. Share local safety
  // actions immediately, but never apply one to a different account's feed.
  useEffect(() => {
    const onModeration = ({ detail }) => {
      if (detail?.account !== userId) return;
      if (detail.postId) {
        if (hiddenPostIdsRef.current.has(detail.postId)) return;
        hiddenPostIdsRef.current.add(detail.postId);
      } else if (detail.creatorId) {
        if (blockedCreatorIdsRef.current.has(detail.creatorId)) return;
        blockedCreatorIdsRef.current.add(detail.creatorId);
      } else return;
      preloadedPageRef.current = null;
      setPosts(current => {
        const updated = removeBlockedPosts(current);
        if (updated.length === current.length) return current;
        saveCache(updated, nextCursor);
        return updated;
      });
    };
    window.addEventListener(FEED_MODERATION_EVENT, onModeration);
    return () => window.removeEventListener(FEED_MODERATION_EVENT, onModeration);
  }, [nextCursor, removeBlockedPosts, saveCache, userId]);

  useEffect(() => {
    if (activeCacheScopeRef.current === userId) return;

    activeCacheScopeRef.current = userId;
    blockedCreatorIdsRef.current = readBlockedCreatorIds();
    hiddenPostIdsRef.current = new Set();
    hasFetched.current = false;
    generationRef.current += 1;
    visitedVideoCursors.current.clear();
    preloadedPageRef.current = null;
    loadRequestRef.current = null;

    try {
      const cached = videoOnly ? null : localStorage.getItem(feedCacheKey);
      const cachedPosts = cached
        ? removeBlockedPosts(dedupePosts(JSON.parse(cached)))
        : [];

      setPosts(cachedPosts);
      setNextCursor(videoOnly ? null : localStorage.getItem(feedCursorKey) || null);
      setLoading(cachedPosts.length === 0);
    } catch {
      setPosts([]);
      setNextCursor(null);
      setLoading(true);
    }

    setLoadingMore(false);
    setRefreshing(true);
    setError('');
  }, [
    feedCacheKey,
    feedCursorKey,
    readBlockedCreatorIds,
    removeBlockedPosts,
    userId,
    videoOnly,
  ]);

  useEffect(() => {
    blockedCreatorIdsRef.current = readBlockedCreatorIds();
    setPosts((current) => removeBlockedPosts(current));
  }, [readBlockedCreatorIds, removeBlockedPosts]);

  const fetchPage = useCallback((cursor = null, fresh = false) => videoOnly
    ? postApi.getVideoFeed({ cursor, fresh })
    : postApi.getFeed({ limit: pageSize, cursor }), [pageSize, videoOnly]);

  const preloadNextPage = useCallback(
    (cursor) => {
      if (!cursor || videoOnly) return;
      const key = JSON.stringify(cursor);
      const current = preloadedPageRef.current;
      if (current?.key === key && current.generation === generationRef.current) return;
      // Retain the in-flight promise, not just its eventual value. Scrolling
      // before prefetch completes must await this exact cursor, not fetch twice.
      const entry = { key, generation: generationRef.current, promise: fetchPage(cursor) };
      preloadedPageRef.current = entry;
      entry.promise.catch(() => {
        if (preloadedPageRef.current === entry) preloadedPageRef.current = null;
      });
    },
    [fetchPage, videoOnly]
  );

  const refreshFeed = useCallback(async (fresh = false) => {
    const generation = ++generationRef.current;
    visitedVideoCursors.current.clear();
    preloadedPageRef.current = null;
    loadRequestRef.current = null;
    setLoadingMore(false);
    setRefreshing(true);
    try {
      setError('');
      setLoading(posts.length === 0);

      const data = await fetchPage(null, fresh === true);
      if (generation !== generationRef.current || activeCacheScopeRef.current !== userId) return;
      const freshItems = removeBlockedPosts(videoOnly ? getVideoPosts(data.items) : dedupePosts(data.items));
      const cursor = data.nextCursor || null;

      setPosts(freshItems);
      setNextCursor(cursor);
      saveCache(freshItems, cursor);

      preloadNextPage(cursor);
    } catch (err) {
      if (generation === generationRef.current) setError('Failed to load feed.');
    } finally {
      if (generation === generationRef.current) { setLoading(false); setRefreshing(false); }
    }
  }, [
    fetchPage,
    posts.length,
    preloadNextPage,
    removeBlockedPosts,
    saveCache,
    userId,
    videoOnly,
  ]);

  const loadMore = useCallback(async () => {
    if (refreshing || loadingMore || !nextCursor || loadRequestRef.current) return;
    const request = { generation: generationRef.current };
    loadRequestRef.current = request;

    try {
      setError('');
      setLoadingMore(true);

      const prefetched = preloadedPageRef.current;
      const page = await (prefetched?.key === JSON.stringify(nextCursor) && prefetched.generation === request.generation
        ? prefetched.promise : fetchPage(nextCursor));
      if (request.generation !== generationRef.current || activeCacheScopeRef.current !== userId) return;

      if (videoOnly) visitedVideoCursors.current.add(videoCursorKey(nextCursor));
      const mergedCursor = videoOnly
        ? unseenVideoCursor(page.nextCursor, visitedVideoCursors.current)
        : page.nextCursor || null;

      setPosts((current) => {
        const items = [...current, ...(page.items || [])];
        // A saved-state or timestamp update must not move a clip to a new
        // snap position. The server's cursor order defines the playlist.
        const updated = removeBlockedPosts(videoOnly ? getVideoPosts(items) : dedupePosts(items));
        saveCache(updated, mergedCursor);
        return updated;
      });

      setNextCursor(mergedCursor);
      preloadedPageRef.current = null;

      preloadNextPage(mergedCursor);
    } catch (err) {
      if (request.generation === generationRef.current) setError('Failed to load more posts.');
    } finally {
      if (loadRequestRef.current === request) { loadRequestRef.current = null; setLoadingMore(false); }
    }
  }, [
    fetchPage,
    loadingMore,
    refreshing,
    nextCursor,
    preloadNextPage,
    removeBlockedPosts,
    saveCache,
    userId,
    videoOnly,
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
      hiddenPostIdsRef.current.add(normalizedId);

      // Invalidate prefetched content so a hidden post cannot reappear.
      preloadedPageRef.current = null;

      setPosts((current) => {
        const updated = current.filter(
          (post) => getPostId(post) !== normalizedId
        );
        saveCache(updated, nextCursor);
        return updated;
      });
      window.dispatchEvent(new CustomEvent(FEED_MODERATION_EVENT, { detail: { account: userId, postId: normalizedId } }));
    },
    [nextCursor, saveCache, userId]
  );

  const refreshPost = useCallback(async postId => {
    const id = String(postId || '').trim();
    const generation = generationRef.current;
    const post = await postApi.getSingleReel(id);
    if (generation !== generationRef.current || activeCacheScopeRef.current !== userId
      || getPostId(post) !== id || !removeBlockedPosts([post]).length) throw new Error('Video unavailable.');
    setPosts(current => {
      const updated = current.map(item => getPostId(item) === id ? { ...item, ...post } : item);
      saveCache(updated, nextCursor);
      return updated;
    });
    return post;
  }, [nextCursor, removeBlockedPosts, saveCache, userId]);

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

      preloadedPageRef.current = null;

      setPosts((current) => {
        const updated = removeBlockedPosts(current);
        saveCache(updated, nextCursor);
        return updated;
      });
      window.dispatchEvent(new CustomEvent(FEED_MODERATION_EVENT, { detail: { account: userId, creatorId: normalizedId } }));
    },
    [blockedCreatorsKey, nextCursor, removeBlockedPosts, saveCache, userId]
  );

  return {
    posts,
    loading,
    refreshing,
    loadingMore,
    error,
    nextCursor,
    loadMore,
    refreshFeed,
    refreshPost,
    likePost,
    savePost,
    hidePost,
    blockCreator,
  };
}
