import { Routes, Route, NavLink, Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import SupportPage from './pages/SupportPage';
import TermsPage from './pages/TermsPage';
import PrivacyPage from './pages/PrivacyPage';
import NotificationSettingsPage from './pages/NotificationSettingsPage';
import NavbarMenu from './components/NavbarMenu';
import { notificationApi, chatApi, getPendingRoomInvite } from './api/client';
import {
  listenForForegroundMessages,
  setupAndroidPushTokenListener,
} from './firebase';
import AuthRedirectHandler from './components/AuthRedirectHandler';
import InstallPrompt from './components/InstallPrompt';
import UniversalSearch from './components/UniversalSearch';
import PageTransition from './components/PageTransition';
import RouteErrorBoundary from './components/RouteErrorBoundary';
import ConnectionStatus from './components/ConnectionStatus';
import ReminderPopup from './components/ReminderPopup';
import useDailyReminder from './hooks/useDailyReminder';
import { nativeNotificationRequest, supportsNativeReminders } from './lib/nativeNotifications';
import { ActionConfirmationProvider } from './components/ActionConfirmation';
import {
  CircleUserRound,
  MessagesSquare,
  House,
  BookOpen,
  Search,
} from 'lucide-react';
import SmartyBrand from './components/SmartyBrand';

import {
  connectChatSocket,
  subscribeChatSocket,
} from './api/chatSocket';
import { getUserScopedStorageKey } from './lib/userScopedStorage';
import {
  getNotificationBody,
  getNotificationDecision,
  getNotificationFingerprint,
  loadNotificationPreferences,
  activateNotificationPreferences,
  getNotificationPath,
  normalizeUnreadCount,
  createNotificationDeduper,
  syncNotificationPreferencesToWorker,
} from './lib/notificationPreferences';

import JoinRoomPage from './pages/JoinRoomPage';
import Booksinfo from './pages/Booksinfo';
import QuizPage from './pages/QuizPage';
import ProgressPage from './pages/progress/ProgressPage';
import GameProfile from './pages/profile/GameProfile';
import CommentsPage from './pages/CommentsPage';
import EditPostPage from './pages/EditPostPage';
import FeedEntry from './components/FeedEntry';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ProfilePage from './pages/ProfilePage';
import SavedPage from './pages/SavedPage';
import CreatePostPage from './pages/CreatePostPage';
import TopicsPage from './pages/TopicsPage';
import ConfirmPage from './pages/ConfirmPage';
import ChatPage from './pages/ChatPage';
import CreatorProfilePage from './pages/CreatorProfilePage';
import CreatorDashboardPage from './pages/CreatorDashboardPage';
import FollowRequestsPage from './pages/FollowRequestsPage';
import TopicRoomsPage from './pages/TopicRoomsPage';
import ReelDetailPage from './pages/ReelDetailPage';
import NewsPage from './pages/NewsPage';
import NewsStoryPage from './pages/NewsStoryPage';
import ReadBookPage from './pages/ReadBookPage';
import BookReaderPage from './pages/BookReaderPage';
import PostAiPage from './pages/PostAiPage';
import LearningPage from './pages/LearningPage';
import AdminModerationPage from './pages/AdminModerationPage';
import { isAdminUser } from './lib/adminAccess';
import './styles/production-pages.css';
import './styles/ipad.css';
import { useQueryClient } from '@tanstack/react-query';
import { canStartPull, isVerticalPull, PULL_THRESHOLD, requestPageRefresh } from './lib/pullRefresh';


function hasStoredAuthToken() {
  return Boolean(
    localStorage.getItem('eduscroll_token') ||
    localStorage.getItem('eduscroll_access_token') ||
    localStorage.getItem('accessToken') ||
    localStorage.getItem('idToken') ||
    sessionStorage.getItem('eduscroll_access_token')
  );
}

function PageLoader() {
  return (
    <div className="app-page-loader" role="status" aria-live="polite">
      <div className="app-page-loader-card">
        <span className="app-page-loader-orb" aria-hidden="true" />
        <div>
          <strong>Loading</strong>
          <p>Getting things ready for you.</p>
        </div>
      </div>
    </div>
  );
}

function AppOpeningScreen({ leaving = false, continuation = false }) {
  return (
    <div
      className={`app-opening-screen${leaving ? ' is-leaving' : ''}${continuation ? ' is-continuation' : ''}`}
      role="status"
      aria-live="polite"
      aria-label="Opening Smarty"
    >
      <div className="app-opening-identity">
        <span className="app-opening-mark" aria-hidden="true">S</span>
        <div className="app-opening-wordmark">
          <strong>Smarty</strong>
          <span>A little curiosity, every day.</span>
        </div>
        <span className="app-opening-status">
          Opening your space
        </span>
        <span className="app-opening-progress" aria-hidden="true"><span /></span>
      </div>
    </div>
  );
}

function OAuthCompletionPage() {
  const { user, loading, authError, restoreSession } = useAuth();
  const navigate = useNavigate();
  const [timedOut, setTimedOut] = useState(false);
  const retriedRef = useRef(false);
  const destinationRef = useRef(null);

  if (!destinationRef.current) {
    const storedTarget =
      sessionStorage.getItem('smarty-post-login-redirect') ||
      localStorage.getItem('smarty-post-login-redirect') ||
      '/feed?topic=All';
    const candidate = String(storedTarget || '').trim();

    destinationRef.current =
      candidate.startsWith('/') &&
      !candidate.startsWith('//') &&
      !candidate.includes('\\') &&
      candidate !== '/login' &&
      candidate !== '/register'
        ? candidate
        : '/feed?topic=All';
  }

  useEffect(() => {
    const timer = window.setTimeout(() => setTimedOut(true), 9000);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (loading || user || retriedRef.current) return;

    retriedRef.current = true;
    restoreSession({ attempts: 8 }).catch((error) => {
      console.error('OAuth session recovery failed:', error);
    });
  }, [loading, restoreSession, user]);

  useEffect(() => {
    if (!user) return;

    sessionStorage.removeItem('smarty-post-login-redirect');
    localStorage.removeItem('smarty-post-login-redirect');
    sessionStorage.removeItem('smarty-auth-redirecting');
    navigate(destinationRef.current, { replace: true });
  }, [navigate, user]);

  if (!user && (authError || timedOut)) {
    return (
      <div className="app-page-loader" role="alert">
        <div className="app-page-loader-card">
          <div>
            <strong>Sign-in could not finish</strong>
            <p>{authError || 'Please try again. Your account was not changed.'}</p>
          </div>
          <button type="button" onClick={() => navigate('/login', { replace: true })}>
            Back to sign in
          </button>
        </div>
      </div>
    );
  }

  return <PageLoader />;
}

function TopicRoomsRouteWrapper() {
  const location = useLocation();

  const roomStateKey = [
    location.pathname,
    location.search,
    location.state?.openRoomId,
    location.state?.autoOpenRoomId,
    location.state?.selectedRoomId,
    location.state?.activeRoomId,
    location.state?.roomId,
    location.state?.inviteNavigationVersion,
    location.state?.joinedAt,
  ]
    .filter(Boolean)
    .join(':');

  return (
    <TopicRoomsPage
      key={roomStateKey || 'rooms'}
      navigationState={location.state || {}}
    />
  );
}

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <PageLoader />;

  return user ? children : <Navigate to="/login" replace state={{ from: location }} />;
}

function AdminRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  if (!isAdminUser(user)) return <Navigate to="/feed" replace />;

  return children;
}

function getUserSocketId(user) {
  return (
    user?.userId ||
    user?.sub ||
    user?.id ||
    user?.username ||
    user?.email ||
    ''
  );
}

function isRoomInvitePath(pathname = '') {
  return pathname.startsWith('/rooms/invite/') || pathname.startsWith('/rooms/join/');
}

function getPendingRoomInviteCode() {
  const pendingInvite = getPendingRoomInvite?.();
  return String(pendingInvite?.inviteCode || '').trim();
}

function clearPendingRoomInvite() {
  try {
    sessionStorage.removeItem('pendingRoomInvite');
    sessionStorage.removeItem('pendingRoomInviteCode');
    sessionStorage.removeItem('pendingRoomInviteTimestamp');
    localStorage.removeItem('pendingRoomInvite');
    localStorage.removeItem('pendingRoomInviteCode');
    localStorage.removeItem('pendingRoomInviteTimestamp');
  } catch {
    // Ignore storage failures in strict in-app browsers.
  }
}

function getPendingRoomInviteTimestamp() {
  try {
    return Number(
      sessionStorage.getItem('pendingRoomInviteTimestamp') ||
      localStorage.getItem('pendingRoomInviteTimestamp') ||
      0
    );
  } catch {
    return 0;
  }
}

function getUnreadFromChatsPayload(payload) {
  const chats = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.chats)
      ? payload.chats
      : [];

  return chats.reduce((sum, chat) => {
    return sum + normalizeUnreadCount(chat?.unreadCount);
  }, 0);
}

function Layout() {
  const queryClient = useQueryClient();
  const { user, logout, loading: authLoading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const currentUserId = getUserSocketId(user);
  useDailyReminder(currentUserId, authLoading);
  const unreadStorageKey = useMemo(
    () => getUserScopedStorageKey('smartyChatUnreadCount', currentUserId),
    [currentUserId]
  );
  const activeChatStorageKey = useMemo(
    () => getUserScopedStorageKey('activeChatId', currentUserId),
    [currentUserId]
  );

  const routeCacheRef = useRef(new Map());
  const lastRefreshRef = useRef(0);

  const cachedUnread = useMemo(() => {
    try {
      return normalizeUnreadCount(localStorage.getItem(unreadStorageKey));
    } catch {
      return 0;
    }
  }, [unreadStorageKey]);

  useEffect(() => {
    const handleUnhandledError = (event) => {
      console.error('Unhandled app error:', event.error || event.reason || event);
    };

    const handleUnhandledRejection = (event) => {
      console.error('Unhandled promise rejection:', event.reason || event);
    };

    window.addEventListener('error', handleUnhandledError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('error', handleUnhandledError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  const [totalUnread, setTotalUnread] = useState(cachedUnread);
  const [popupNotification, setPopupNotification] = useState(null);
  const [globalPullDistance, setGlobalPullDistance] = useState(0);
  const [globalRefreshing, setGlobalRefreshing] = useState(false);
  const [pageRefreshVersion, setPageRefreshVersion] = useState(0);
  const refreshingRef = useRef(false);
  const pullStartXRef = useRef(0);
  const [universalSearchOpen, setUniversalSearchOpen] = useState(false);

  const touchStartXRef = useRef(null);
  const unreadRefreshInFlightRef = useRef(false);
  const unreadRefreshTimerRef = useRef(null);
  const seenBadgeMessageIdsRef = useRef(new Set());
  const recentNotificationIdsRef = useRef(createNotificationDeduper());
  const globalPullStartYRef = useRef(0);
  const globalPullDistanceRef = useRef(0);
  const globalPullAtTopRef = useRef(false);
  const globalPullTriggeredRef = useRef(false);
  const routeReadyTimerRef = useRef(null);

  const isAuthPage =
    location.pathname === '/login' ||
    location.pathname === '/register' ||
    location.pathname === '/confirm';

  const isAllPosts = location.pathname === '/feed' && new URLSearchParams(location.search).get('topic') === 'All';

  const openUniversalSearch = useCallback(() => {
    setUniversalSearchOpen(true);
  }, []);

  const closeUniversalSearch = useCallback(() => {
    setUniversalSearchOpen(false);
  }, []);

useEffect(() => {
  if (!user) return;

  const pendingInviteCode = getPendingRoomInviteCode();

  if (!pendingInviteCode) {
    return;
  }

  const inviteTimestamp = getPendingRoomInviteTimestamp();

  const isFreshInvite = Boolean(
    inviteTimestamp &&
    Date.now() - inviteTimestamp < 1000 * 60 * 10
  );

  if (!isFreshInvite) {
    clearPendingRoomInvite();
    return;
  }

  const invitePath = `/rooms/invite/${encodeURIComponent(pendingInviteCode)}`;

  const alreadyOnInvitePage = (
    location.pathname === invitePath ||
    location.pathname.startsWith('/rooms/invite/') ||
    location.pathname.startsWith('/rooms/join/')
  );

  if (alreadyOnInvitePage) {
    return;
  }

  navigate(invitePath, {
    replace: true,
    state: {
      resumePendingInvite: true,
      pendingInviteCode,
      autoJoinAfterLogin: true,
      inviteNavigationVersion: Date.now(),
    },
  });
}, [user, location.pathname, navigate]);


  const goBack = useCallback(() => {
    window.history.back();
  }, []);

  const isPageAtTop = useCallback(() => {
    const scrollingElement = document.scrollingElement || document.documentElement;
    const windowTop = window.scrollY || scrollingElement?.scrollTop || 0;
    const contentElement = document.querySelector('.content');
    const contentTop = contentElement?.scrollTop || 0;
    const feedElement = document.querySelector('.snap-feed-page');
    const feedTop = feedElement?.scrollTop || 0;
    const postsTop = feedElement?.querySelector('.snap-feed')?.scrollTop || 0;

    return windowTop <= 2 && contentTop <= 2 && feedTop <= 2 && postsTop <= 2;
  }, []);

  const resetGlobalPullRefresh = useCallback(() => {
    globalPullStartYRef.current = 0;
    globalPullDistanceRef.current = 0;
    globalPullAtTopRef.current = false;
    globalPullTriggeredRef.current = false;
    setGlobalPullDistance(0);
  }, []);

  const runGlobalPullRefresh = useCallback(async () => {
    if (refreshingRef.current) return;
    refreshingRef.current = true;
    setGlobalRefreshing(true);
    try {
      await requestPageRefresh(async () => {
        // Refresh the displayed route, never the auth provider or whole WebView.
        setPageRefreshVersion(value => value + 1);
        await Promise.allSettled([queryClient.invalidateQueries({ refetchType:'active' })]);
      });
    } finally {
      refreshingRef.current = false;
      resetGlobalPullRefresh();
      setGlobalRefreshing(false);
    }
  }, [queryClient, resetGlobalPullRefresh]);

  useEffect(() => { resetGlobalPullRefresh(); }, [location.pathname, resetGlobalPullRefresh]);

  const handleGlobalPullStart = useCallback((event) => {
    if (refreshingRef.current || event.touches.length !== 1) return;
    // Do not interrupt writing, authentication, calls, or conversation scrolling.
    if (/(?:login|register|confirm|auth|create|edit|chat|rooms|admin|settings|quiz|game)/i.test(location.pathname) || !canStartPull(event.target,event.currentTarget)) {
      resetGlobalPullRefresh(); return;
    }

    const atTop = isPageAtTop();
    globalPullAtTopRef.current = atTop;
    globalPullTriggeredRef.current = false;

    if (!atTop) {
      resetGlobalPullRefresh();
      return;
    }

    globalPullStartYRef.current = event.touches[0]?.clientY || 0;
    pullStartXRef.current = event.touches[0]?.clientX || 0;
    globalPullDistanceRef.current = 0;
    setGlobalPullDistance(0);
  }, [location.pathname, isPageAtTop, resetGlobalPullRefresh]);

  const handleGlobalPullMove = useCallback((event) => {
    if (
      globalRefreshing ||
      event.touches.length !== 1 ||
      !globalPullAtTopRef.current ||
      globalPullStartYRef.current <= 0 ||
      !isPageAtTop()
    ) {
      return;
    }

    const currentY = event.touches[0]?.clientY || 0;
    const currentX = event.touches[0]?.clientX || 0;
    if (!isVerticalPull({x:pullStartXRef.current,y:globalPullStartYRef.current},{x:currentX,y:currentY})) {
      globalPullDistanceRef.current = 0;setGlobalPullDistance(0);return;
    }
    const distance = Math.max(0, currentY - globalPullStartYRef.current);

    if (distance <= 0) {
      globalPullDistanceRef.current = 0;
      setGlobalPullDistance(0);
      return;
    }

    globalPullDistanceRef.current = distance;
    const easedDistance = Math.min(56, distance * 0.42);

    setGlobalPullDistance((current) => (
      Math.abs(current - easedDistance) > 1 ? easedDistance : current
    ));
  }, [globalRefreshing, isPageAtTop]);

  const handleGlobalPullEnd = useCallback(() => {
    const shouldRefresh =
      !globalRefreshing &&
      globalPullAtTopRef.current &&
      isPageAtTop() &&
      globalPullDistanceRef.current >= PULL_THRESHOLD;

    if (shouldRefresh && !globalPullTriggeredRef.current) {
      globalPullTriggeredRef.current = true;
      setGlobalPullDistance(42);
      runGlobalPullRefresh();
      return;
    }

    resetGlobalPullRefresh();
  }, [globalRefreshing, isPageAtTop, resetGlobalPullRefresh, runGlobalPullRefresh]);

  // Only handle swipe navigation, do not clear session or logout on back/navigation events
  useEffect(() => {
    const isMobileView = () => window.matchMedia('(max-width: 768px)').matches;

    const handleTouchStart = (event) => {
      if (!isMobileView()) return;
      touchStartXRef.current = event.touches[0]?.clientX ?? null;
    };

    const handleTouchEnd = (event) => {
      if (!isMobileView() || touchStartXRef.current === null) return;

      const touchEndX = event.changedTouches[0]?.clientX ?? touchStartXRef.current;
      const swipeDistance = touchEndX - touchStartXRef.current;
      const startedNearLeftEdge = touchStartXRef.current <= 45;

      touchStartXRef.current = null;

      if (startedNearLeftEdge && swipeDistance > 80 && window.history.length > 1) {
        goBack();
      }
    };

    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [goBack]);

  useEffect(() => {
    const contentElement = document.querySelector('.content');
    const appShell = document.querySelector('.app-shell');

    if (contentElement) {
      contentElement.style.overflowY = 'auto';
      contentElement.style.overflowX = 'hidden';
      contentElement.style.webkitOverflowScrolling = 'touch';
      contentElement.style.touchAction = 'pan-y';
      contentElement.style.pointerEvents = 'auto';
      contentElement.style.height = '100dvh';
      contentElement.style.maxHeight = '100dvh';
      contentElement.style.minHeight = '0';
      contentElement.scrollTop = contentElement.scrollTop;
    }

    if (appShell) {
      appShell.style.overflow = 'hidden';
      appShell.style.minHeight = '0';
      appShell.style.height = '100dvh';

    }

    if (routeReadyTimerRef.current) {
      window.clearTimeout(routeReadyTimerRef.current);
    }

    routeReadyTimerRef.current = window.setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
      document.body.classList.remove('route-loading-lock');

      const refreshedContent = document.querySelector('.content');

      if (refreshedContent) {
        refreshedContent.style.overflowY = 'auto';
        refreshedContent.style.overflowX = 'hidden';
        refreshedContent.style.webkitOverflowScrolling = 'touch';
        refreshedContent.style.pointerEvents = 'auto';
        refreshedContent.style.touchAction = 'pan-y';
        refreshedContent.style.height = '100dvh';
        refreshedContent.style.maxHeight = '100dvh';
        refreshedContent.style.minHeight = '0';

      }
    }, 120);

    return () => {
      if (routeReadyTimerRef.current) {
        window.clearTimeout(routeReadyTimerRef.current);
      }
    };
  }, [location.pathname]);

  // Global chat badge: works even when user is not on Chat page
  useEffect(() => {
    if (!user) {
      setTotalUnread(0);

      return undefined;
    }

    let cancelled = false;
    const userId = currentUserId;

    const applyUnread = (value) => {
      const nextUnread = normalizeUnreadCount(value);
      setTotalUnread(nextUnread);

      try {
        localStorage.setItem(unreadStorageKey, String(nextUnread));
      } catch {
        // ignore storage errors
      }
    };

    const refreshChatUnread = async ({ force = false } = {}) => {
      if (cancelled || unreadRefreshInFlightRef.current) return;

      if (
        !force &&
        (document.visibilityState === 'hidden' || !navigator.onLine)
      ) {
        return;
      }

      const now = Date.now();
      const unreadCacheKey = `chatUnread:${userId}`;
      const cached = routeCacheRef.current.get(unreadCacheKey);

      if (
        !force &&
        cached &&
        now - cached.timestamp < 15000
      ) {
        applyUnread(cached.value);
        return;
      }

      unreadRefreshInFlightRef.current = true;

      try {
        const chatsPayload = await chatApi.getChats();
        if (cancelled) return;

        const unreadValue = getUnreadFromChatsPayload(chatsPayload);

        routeCacheRef.current.set(unreadCacheKey, {
          value: unreadValue,
          timestamp: now,
        });

        applyUnread(unreadValue);
      } catch (error) {
        console.error('Failed to refresh chat unread count:', error);
      } finally {
        unreadRefreshInFlightRef.current = false;
      }
    };

    const scheduleUnreadRefresh = () => {
      if (unreadRefreshTimerRef.current) {
        window.clearTimeout(unreadRefreshTimerRef.current);
      }

      unreadRefreshTimerRef.current = window.setTimeout(() => {
        refreshChatUnread({ force: true });
      }, 700);
    };

    try {
      setTotalUnread(normalizeUnreadCount(localStorage.getItem(unreadStorageKey)));
    } catch {
      setTotalUnread(0);
    }

    refreshChatUnread({ force: true });

    if (userId) {
      connectChatSocket(userId);
    }

    const unsubscribeSocket = subscribeChatSocket((data) => {
      if (data?.type !== 'newMessage' || !data?.message) return;

      const senderId = data.message.senderId || data.message.userId || '';
      let activeChatId = '';
      try { activeChatId = localStorage.getItem(activeChatStorageKey) || ''; } catch { /* Storage may be blocked. */ }
      const messageChatId = data.message.chatId || '';
      const messageId = String(
        data.message.messageId ||
        data.message.id ||
        data.message.clientId ||
        ''
      );

      if (messageId) {
        if (seenBadgeMessageIdsRef.current.has(messageId)) return;

        seenBadgeMessageIdsRef.current.add(messageId);

        if (seenBadgeMessageIdsRef.current.size > 300) {
          seenBadgeMessageIdsRef.current.clear();
          seenBadgeMessageIdsRef.current.add(messageId);
        }
      }

      if (senderId && senderId === userId) return;

      if (document.visibilityState === 'visible' && activeChatId && messageChatId && activeChatId === messageChatId) {
        scheduleUnreadRefresh();
        return;
      }

      setTotalUnread((current) => {
        const nextUnread = Number(current || 0) + 1;

        try {
          localStorage.setItem(unreadStorageKey, String(nextUnread));
        } catch {
          // ignore storage errors
        }

        return nextUnread;
      });

      scheduleUnreadRefresh();
    });

    const intervalId = window.setInterval(() => {
      refreshChatUnread({ force: false });
    }, 120000);

    const handleRefresh = () => refreshChatUnread({ force: true });

    const handleStorage = (event) => {
      if (event.key === unreadStorageKey) {
        applyUnread(event.newValue);
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return;

      const now = Date.now();

      if (now - lastRefreshRef.current < 4000) {
        return;
      }

      lastRefreshRef.current = now;
      refreshChatUnread({ force: true });
    };

    window.addEventListener('focus', handleVisibilityChange);
    window.addEventListener('storage', handleStorage);
    window.addEventListener('chat-unread-refresh', handleRefresh);
    window.addEventListener('chat-unread-refresh-request', handleRefresh);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      cancelled = true;
      unreadRefreshInFlightRef.current = false;
      seenBadgeMessageIdsRef.current.clear();
      routeCacheRef.current.delete(`chatUnread:${userId}`);

      if (unreadRefreshTimerRef.current) {
        window.clearTimeout(unreadRefreshTimerRef.current);
        unreadRefreshTimerRef.current = null;
      }

      window.clearInterval(intervalId);
      unsubscribeSocket?.();

      window.removeEventListener('focus', handleVisibilityChange);
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('chat-unread-refresh', handleRefresh);
      window.removeEventListener('chat-unread-refresh-request', handleRefresh);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [activeChatStorageKey, currentUserId, unreadStorageKey, user]);

  // Android WebView push token bridge
  useEffect(() => {
    setupAndroidPushTokenListener?.();
  }, []);

  useEffect(() => {
    const handler = (event) => {
      if (!currentUserId) return;
      const nextUnread = normalizeUnreadCount(event.detail?.totalUnread);

      setTotalUnread(nextUnread);

      try {
        localStorage.setItem(unreadStorageKey, String(nextUnread));
      } catch {
        // ignore storage errors
      }
    };

    window.addEventListener('chat-unread-update', handler);

    return () => {
      window.removeEventListener('chat-unread-update', handler);
    };
  }, [currentUserId, unreadStorageKey]);

  useEffect(() => {
    if (authLoading) return;
    if (supportsNativeReminders()) {
      nativeNotificationRequest('badge', { count: currentUserId ? totalUnread : 0 }).catch(() => {});
    }
    if (typeof navigator === 'undefined' || !('setAppBadge' in navigator)) return;

    if (totalUnread > 0) {
      navigator.setAppBadge(totalUnread).catch(() => {});
    } else if ('clearAppBadge' in navigator) {
      navigator.clearAppBadge().catch(() => {});
    }
  }, [authLoading, currentUserId, totalUnread]);

  // Push notifications after PWA install
  useEffect(() => {
    async function setupPush() {
      if (!user || !navigator.onLine) return;

      const alreadyGranted =
        'Notification' in window &&
        Notification.permission === 'granted';

      // Permission prompts should only follow an explicit user action. Once
      // permission exists, refresh the token quietly on subsequent sessions.
      if (!alreadyGranted) return;

      try {
        await notificationApi.initPush(user);
      } catch (error) {
        console.error('Failed to initialize push notifications:', error);
      }
    }

    setupPush();
  }, [user]);

  useEffect(() => {
    if (authLoading) return;
    const syncPreferences = (event) => {
      const preferences = activateNotificationPreferences(currentUserId);
      syncNotificationPreferencesToWorker(preferences, currentUserId);
    };

    syncPreferences();
    setPopupNotification(null);
    recentNotificationIdsRef.current.clear();
    window.addEventListener('smarty-notification-preferences-changed', syncPreferences);
    const syncStorage = event => { if (event.key?.startsWith('smarty_notification_preferences_v1:')) syncPreferences(); };
    window.addEventListener('storage', syncStorage);

    return () => {
      window.removeEventListener('smarty-notification-preferences-changed', syncPreferences);
      window.removeEventListener('storage', syncStorage);
    };
  }, [currentUserId, authLoading]);

  // Foreground push listener
useEffect(() => {

  let unsubscribe = () => {};

  let cancelled = false;

  async function setupMessaging() {

    try {

      const cleanup = await listenForForegroundMessages();

      if (cancelled) {

        cleanup?.();

        return;

      }

      if (typeof cleanup === 'function') {

        unsubscribe = cleanup;

      }

    } catch (error) {

      console.error(

        'Failed to start foreground messaging:',

        error

      );

    }

  }

  setupMessaging();

  return () => {

    cancelled = true;

    unsubscribe();

  };

}, []);

  useEffect(() => {
    const handleSmartyNotification = (event) => {
      if (!currentUserId) return;
      const detail = event.detail || {};
      const recipient = detail.userId || detail.rawPayload?.data?.userId;
      if (recipient && String(recipient) !== currentUserId) return;
      const notificationType = String(detail.type || '').toLowerCase();

      if (
        notificationType.includes('chat') ||
        notificationType.includes('message')
      ) {
        window.dispatchEvent(new Event('chat-unread-refresh-request'));
      }

      const preferences = loadNotificationPreferences(currentUserId);
      const decision = getNotificationDecision(detail, preferences);
      if (!decision.deliver) return;

      const rawMessageId = getNotificationFingerprint(detail);

      if (rawMessageId && !recentNotificationIdsRef.current.claim(rawMessageId)) return;

      setPopupNotification({
        title: detail.title || 'Smarty',
        body: getNotificationBody(detail, preferences),
        url: getNotificationPath(detail.url, window.location.origin),
      });
    };

    window.addEventListener('smarty-notification', handleSmartyNotification);
    const openNotification = event => {
      if (currentUserId) navigate(getNotificationPath(event.detail?.url, window.location.origin));
    };
    window.addEventListener('smarty-notification-open', openNotification);

    return () => {
      window.removeEventListener('smarty-notification', handleSmartyNotification);
      window.removeEventListener('smarty-notification-open', openNotification);
    };
  }, [currentUserId, navigate]);



  return (
    <>
      <AuthRedirectHandler />
      <PageTransition />

      <UniversalSearch
        open={universalSearchOpen}
        onOpen={openUniversalSearch}
        onClose={closeUniversalSearch}
        user={user}
      />

      <ReminderPopup
        title={popupNotification?.title || 'Smarty'}
        body={popupNotification?.body || ''}
        visible={Boolean(popupNotification)}
        onClose={() => setPopupNotification(null)}
        onClick={() => {
          if (popupNotification?.url) {
            navigate(popupNotification.url);
          }
          setPopupNotification(null);
        }}
      />

      {!isAuthPage && <InstallPrompt />}

      <div className={`app-shell ${location.pathname === '/feed' && !new URLSearchParams(location.search).get('topic') ? 'is-smarty-landing' : ''}`}>
          <header className="topbar glass-topbar">
          <div className="topbar-row">
            <NavLink
              to="/feed?topic=All"
              className="brand-logo fancy-brand"
              aria-label="Smarty — view all posts"
            >
              <SmartyBrand compact tagline="Learn with intent" />
            </NavLink>

            <nav className="brand-actions" aria-label="Quick navigation">



              <Link
                to="/feed?topic=All"
                className={`quick-icon-link${isAllPosts ? ' is-current' : ''}`}
                aria-label="Feed"
                aria-current={isAllPosts ? 'page' : undefined}
                title="Feed"
                onClick={(event) => {
                  if (window.location.pathname !== '/feed' || new URLSearchParams(window.location.search).get('topic') !== 'All') return;
                  event.preventDefault();
                  const feedScroller = document.querySelector('.snap-feed-page .snap-feed') || document.querySelector('.content');
                  feedScroller?.scrollTo({
                    top: 0,
                    behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
                      ? 'auto'
                      : 'smooth',
                  });
                }}
              >
                <House size={16} strokeWidth={2.2} />
                <span className="nav-control-label" aria-hidden="true">Feed</span>
              </Link>

              <button
                type="button"
                className="quick-icon-link"
                aria-label={user ? 'Profile' : 'Sign in'}
                aria-current={location.pathname === '/profile' ? 'page' : undefined}
                title={user ? 'Profile' : 'Sign in'}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();

                  if (user) {
                    navigate('/profile');
                    return;
                  }

                  navigate('/login', { state: { from: '/profile' } });
                }}
              >
                <CircleUserRound size={16} strokeWidth={2.15} />
                <span className="nav-control-label" aria-hidden="true">{user ? 'Profile' : 'Sign in'}</span>
              </button>

              <NavLink
                to="/chat"
                className="quick-icon-link"
                aria-label={
                  totalUnread > 0
                    ? `Chat, ${totalUnread} unread message${totalUnread === 1 ? '' : 's'}`
                    : 'Chat'
                }
                title={totalUnread > 0 ? `Chat · ${totalUnread} unread` : 'Chat'}
              >
                <MessagesSquare size={16} strokeWidth={2.15} />
                <span className="nav-control-label" aria-hidden="true">Chat</span>
                {totalUnread > 0 && (
                  <span className="nav-badge" aria-hidden="true">
                    {totalUnread > 99 ? '99+' : totalUnread}
                  </span>
                )}
              </NavLink>

              <button
                type="button"
                className="quick-icon-link topbar-create-btn"
                onClick={() => navigate('/create')}
                aria-label="Create"
                aria-current={location.pathname === '/create' ? 'page' : undefined}
                title="Create"
              >
                <span className="nav-create-symbol" aria-hidden="true">+</span>
                <span className="nav-control-label" aria-hidden="true">Post</span>
              </button>



              <NavbarMenu
                user={user}
                logout={logout}
                totalUnread={totalUnread}
                onOpenSearch={openUniversalSearch}
              />
            </nav>
          </div>
          </header>

        <main
          className="content"
          onTouchStart={handleGlobalPullStart}
          onTouchMove={handleGlobalPullMove}
          onTouchEnd={handleGlobalPullEnd}
          onTouchCancel={resetGlobalPullRefresh}
          style={{
            overflowY: 'auto',
            WebkitOverflowScrolling: 'touch',
            touchAction: 'pan-y',
            pointerEvents: 'auto',
            paddingTop: 0,
            scrollPaddingTop: 0,
            paddingBottom: 0,
            scrollPaddingBottom: 0,
          }}
        >
          {(globalPullDistance > 0 || globalRefreshing) && (
            <div
              className={`global-pull-refresh ${globalRefreshing ? 'refreshing' : ''}`}
              style={{
                transform: `translate(-50%, ${globalPullDistance || 48}px)`,
              }}
              aria-live="polite"
            >
              <span className="global-pull-refresh-spinner" />
              <small>{globalRefreshing ? 'Refreshing' : globalPullDistance >= PULL_THRESHOLD * .42 ? 'Release to refresh' : 'Pull to refresh'}</small>
            </div>
          )}

          <RouteErrorBoundary key={`${location.pathname}:${pageRefreshVersion}`} resetKey={location.pathname + location.search}>
            <Routes>
                <Route
                  path="/"
                  element={
                    location.search.includes('code=')
                      ? <OAuthCompletionPage />
                      : <Navigate to="/feed" replace />
                  }
                />

                <Route path="/feed" element={<FeedEntry onOpenSearch={openUniversalSearch} />} />
                <Route path="/feed/:topic" element={<FeedEntry onOpenSearch={openUniversalSearch} />} />

                <Route path="/booksinfo" element={<Booksinfo />} />
                <Route path="/bookinfo" element={<Booksinfo />} />
                <Route path="/topics" element={<TopicsPage />} />
                <Route path="/news" element={<NewsPage />} />
                <Route path="/news/story" element={<NewsStoryPage />} />
                <Route path="/read-books" element={<ReadBookPage />} />
                <Route path="/preview-books" element={<ReadBookPage />} />
                <Route path="/read-book/:bookId" element={<BookReaderPage />} />
                <Route path="/support" element={<SupportPage/>} />
                <Route path="/terms" element={<TermsPage/>} />
                <Route path="/privacy" element={<PrivacyPage/>} />
                <Route
                  path="/notifications"
                  element={
                    <ProtectedRoute>
                      <NotificationSettingsPage />
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/admin"
                  element={
                    <AdminRoute>
                      <AdminModerationPage />
                    </AdminRoute>
                  }
                />
                <Route path="/admin/moderation" element={<Navigate to="/admin" replace />} />

                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />
                <Route path="/confirm" element={<ConfirmPage />} />

                <Route path="/creator/:userId" element={<CreatorProfilePage />} />
                <Route path="/reel/:reelId" element={<ReelDetailPage />} />
                <Route path="/quiz" element={<QuizPage />} />
                <Route path="/learn" element={<LearningPage />} />
                <Route path="/game-profile" element={<GameProfile />} />
                <Route path="/progress" element={<ProgressPage />} />

                <Route
                  path="/comments/:reelId"
                  element={
                    <ProtectedRoute>
                      <CommentsPage />
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/edit/:reelId"
                  element={
                    <ProtectedRoute>
                      <EditPostPage />
                    </ProtectedRoute>
                  }
                />

                <Route path="/rooms/invite/:inviteCode" element={<JoinRoomPage />} />
                <Route path="/rooms/join/:inviteCode" element={<JoinRoomPage />} />

                <Route
                  path="/chat"
                  element={
                    <ProtectedRoute>
                      <ChatPage />
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/profile"
                  element={
                    <ProtectedRoute>
                      <ProfilePage />
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/saved"
                  element={
                    <ProtectedRoute>
                      <SavedPage />
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/create"
                  element={
                    <ProtectedRoute>
                      <CreatePostPage />
                    </ProtectedRoute>
                  }
                />

                <Route path="/post-ai/:postId" element={<PostAiPage />} />

                <Route
                  path="/creator-dashboard"
                  element={
                    <ProtectedRoute>
                      <CreatorDashboardPage />
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/follow-requests"
                  element={
                    <ProtectedRoute>
                      <FollowRequestsPage />
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/rooms"
                  element={
                    <ProtectedRoute>
                      <TopicRoomsRouteWrapper />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/rooms/:roomId"
                  element={
                    <ProtectedRoute>
                      <TopicRoomsPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/rooms/:roomId/*"
                  element={
                    <ProtectedRoute>
                      <TopicRoomsPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/topic-room/:roomId"
                  element={
                    <ProtectedRoute>
                      <TopicRoomsPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/topic-room/:roomId/*"
                  element={
                    <ProtectedRoute>
                      <TopicRoomsPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/topicrooms/:roomId"
                  element={
                    <ProtectedRoute>
                      <TopicRoomsPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/topicrooms/:roomId/*"
                  element={
                    <ProtectedRoute>
                      <TopicRoomsPage />
                    </ProtectedRoute>
                  }
                />

                <Route path="*" element={<Navigate to="/feed" replace />} />
              </Routes>
          </RouteErrorBoundary>
        </main>
      </div>
    </>
  );
}

function ReminderPopupStyles() {
  return (
    <style>{`
      .app-opening-screen {
        position: fixed; inset: 0; z-index: 40000;
        display: grid; place-items: center; overflow: hidden;
        background: #08090b; color: #f0f0ed;
        transition: opacity 220ms ease, visibility 220ms;
      }
      .app-opening-screen.is-leaving { opacity: 0; visibility: hidden; pointer-events: none; }
      .app-opening-identity { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 24px; text-align: center; }
      .app-opening-mark {
        display: grid; place-items: center; width: 56px; height: 56px;
        margin-bottom: 16px; border-radius: 14px; background: #eeefed;
        color: #121820; font-size: 27px; font-weight: 650; letter-spacing: -.06em;
      }
      .app-opening-wordmark { display: contents; }
      .app-opening-wordmark strong { font-size: 25px; font-weight: 550; line-height: 1.2; letter-spacing: -.055em; }
      .app-opening-wordmark > span { font-size: 13px; line-height: 1.6; color: #a1a5ad; }
      .app-opening-status { margin-top: 24px; color: #a1a5ad; font-size: 12px; line-height: 1.6; }
      .app-opening-progress { position: relative; width: 96px; height: 2px; margin-top: 9px; overflow: hidden; border-radius: 2px; background: #252a31; }
      .app-opening-progress > span { position: absolute; inset: 0; background: #b0c8e4; transform-origin: left; animation: smartyReadingLine 1.8s ease-in-out infinite; }
      @keyframes smartyReadingLine { from { transform: translateX(-100%) scaleX(.45); } to { transform: translateX(100%) scaleX(.45); } }
      .app-page-loader { min-height: 60dvh; display: grid; place-items: center; padding: 24px; }
      .app-page-loader-card { display: flex; align-items: center; flex-wrap: wrap; gap: 16px; max-width: 360px; padding: 22px; background: transparent; border: 0; box-shadow: none; }
      .app-page-loader-orb { width: 20px; height: 20px; flex: 0 0 20px; border: 2px solid var(--ui-line-strong); border-top-color: var(--ui-accent); border-radius: 50%; animation: smartyLoaderTurn 1s linear infinite; }
      .app-page-loader-card strong { font-size: .9375rem; font-weight: 550; color: var(--ui-text); }
      .app-page-loader-card p { margin: 4px 0 0; color: var(--ui-muted); font-size: .8125rem; line-height: 1.65; }
      @keyframes smartyLoaderTurn { to { transform: rotate(360deg); } }
      @media (prefers-reduced-motion: reduce) {
        .app-opening-screen { transition: none; }
        .app-opening-progress > span, .app-page-loader-orb { animation: none; }
      }
      .global-pull-refresh {
        position: fixed;
        top: calc(16px + env(safe-area-inset-top));
        left: 50%;
        z-index: 9999;
        width: 154px;
        height: 44px;
        border: 1px solid rgba(255, 255, 255, 0.12);
        border-radius: 10px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 7px;
        color: rgba(255, 255, 255, 0.9);
        background: var(--ui-surface, #111214);
        box-shadow: 0 8px 24px rgba(0,0,0,.2);
        pointer-events: none;
        will-change: transform, opacity;
        transition: transform 0.18s ease, opacity 0.18s ease;
      }

      .global-pull-refresh small {
        font-size: 11px;
        font-weight: 500;
        letter-spacing: -0.02em;
        white-space: nowrap;
      }

      .global-pull-refresh-spinner {
        width: 17px;
        height: 17px;
        border-radius: 999px;
        border: 2px solid rgba(255, 255, 255, 0.22);
        border-top-color: rgba(56, 189, 248, 0.95);
      }

      .global-pull-refresh.refreshing .global-pull-refresh-spinner {
        border-top-color: var(--ui-accent);
        animation: globalPullSpin 0.85s linear infinite;
      }

      @keyframes globalPullSpin {
        to {
          transform: rotate(360deg);
        }
      }

      @media (max-width: 640px) {
        .global-pull-refresh {
          top: calc(16px + env(safe-area-inset-top));
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .global-pull-refresh { transition:none; }
        .global-pull-refresh.refreshing .global-pull-refresh-spinner { animation:none; }
      }
      .reminder-popup {
        position: fixed;
        top: 18px;
        right: 18px;
        z-index: 10000;
        border: 0;
        background: transparent;
        padding: 0;
        cursor: pointer;
        opacity: 0;
        pointer-events: none;
        transform: translateY(-18px) scale(0.96);
        transition: opacity 0.28s ease, transform 0.28s ease;
      }

      .reminder-popup.show {
        opacity: 1;
        pointer-events: auto;
        transform: translateY(0) scale(1);
      }

      .reminder-popup-card {
        min-width: 280px;
        max-width: 340px;
        padding: 14px 16px;
        border-radius: 20px;
        background: linear-gradient(180deg, rgba(10, 15, 28, 0.94), rgba(6, 10, 20, 0.96));
        color: #fff;
        box-shadow: 0 18px 40px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.07) inset;
        backdrop-filter: blur(14px);
        -webkit-backdrop-filter: blur(14px);
        text-align: left;
      }

      .reminder-popup-card strong {
        display: block;
        margin-bottom: 6px;
        font-size: 15px;
        font-weight: 800;
        letter-spacing: 0.01em;
      }

      .reminder-popup-card p {
        margin: 0;
        font-size: 14px;
        line-height: 1.45;
        color: rgba(255, 255, 255, 0.84);
      }

      @media (max-width: 640px) {
        .reminder-popup {
          top: 12px;
          right: 12px;
          left: 12px;
        }

        .reminder-popup-card {
          min-width: 0;
          max-width: none;
          width: 100%;
        }
      }

      /* --- Compact/minimal topbar styles --- */
.topbar-row {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  justify-content: flex-end;
  gap: 10px;
  width: auto;
  min-height: 0;
  background: transparent !important;
}

.topbar {
  position: fixed !important;
  top: auto !important;
  right: 12px;
  bottom: calc(12px + env(safe-area-inset-bottom));
  left: auto;
  z-index: 3000;
  width: auto;
  padding: 0;
  background: transparent !important;
  box-shadow: none !important;
  border: 0 !important;
  pointer-events: none;
  overflow: visible !important;
}

.navbar-menu {
  position: relative;
  z-index: 3002;
}

.menu-panel {
  position: absolute !important;
  right: calc(100% + 12px) !important;
  bottom: 0 !important;
  top: auto !important;
  z-index: 3003 !important;

  overflow-y: auto;
  max-height: 82dvh;

  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;

  pointer-events: auto !important;
}

.menu-overlay {
  position: fixed !important;
  inset: 0 !important;
  z-index: 3001 !important;
  background: transparent;
}

      .topbar-row,
      .brand-logo,
      .brand-actions,
      .quick-icon-link,
      .navbar-menu,
      .hamburger-btn {
        pointer-events: auto;
        
      }

      .content {
        padding-top: 0 !important;
        padding-bottom: 0px !important;
        scroll-padding-top: 0 !important;
        scroll-padding-bottom:0px;
      }

      .glass-topbar {
        background: transparent !important;
        border-bottom: 0 !important;
        box-shadow: none !important;
        backdrop-filter: none !important;
        -webkit-backdrop-filter: none !important;
      }

      .topbar::before,
      .topbar::after,
      .glass-topbar::before,
      .glass-topbar::after {
        display: none !important;
        content: none !important;
        background: transparent !important;
        box-shadow: none !important;
        border: 0 !important;
      }

      .brand-logo {
        display: none;
        align-items: center;
        gap: 10px;
        min-width: 0;
        text-decoration: none;
      }

      .brand-logo h1 {
        margin: 0;
        font-size: 1rem;
        line-height: 1.05;
        font-weight: 800;
        letter-spacing: -0.04em;
      }

      .brand-logo p {
        margin: 2px 0 0;
        font-size: 0.68rem;
        line-height: 1.1;
        opacity: 0.72;
      }

.brand-actions {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  flex-shrink: 0;
  margin-left: 0;
  color: rgba(248, 250, 252, 0.92);
  padding: 8px;
  border-radius: 999px;
  background: linear-gradient(160deg, rgba(10, 21, 32, 0.78), rgba(3, 9, 16, 0.68));
  border: 0;
  box-shadow: 0 16px 42px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255,255,255,0.035);
  backdrop-filter: blur(22px) saturate(130%);
  -webkit-backdrop-filter: blur(22px) saturate(130%);

  position: relative;
  z-index: 3001;
  overflow: visible;
  pointer-events: auto;
}

      .quick-icon-link,
      button.quick-icon-link,
      a.quick-icon-link {
        width: 40px;
        height: 40px;
        min-width: 40px;
        border-radius: 14px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        background: rgba(143, 184, 198, 0.075) !important;
        border: 0 !important;
        box-shadow: inset 0 1px 0 rgba(255,255,255,0.035) !important;
        color: rgba(248, 250, 252, 0.96) !important;
        padding: 0;
        cursor: pointer;
        text-decoration: none;
        position: relative;
        flex-shrink: 0;
        transition: background 0.18s ease, box-shadow 0.18s ease, transform 0.18s ease;
        -webkit-tap-highlight-color: transparent;
        user-select: none;
      }

      .quick-icon-link:hover,
      button.quick-icon-link:hover,
      a.quick-icon-link:hover {
        background: rgba(143, 198, 214, 0.14) !important;
        box-shadow: inset 0 1px 0 rgba(255,255,255,0.05) !important;
        transform: translateY(-1px);
      }

      .quick-icon-link svg {
        color: rgba(248, 250, 252, 0.96);
        stroke: currentColor;
      }

      .topbar-create-btn {
        font-size: 1.45rem;
        font-weight: 700;
        line-height: 1;
        color: rgba(248, 250, 252, 0.96);
      }


      .nav-badge {
        top: -2px;
        right: -1px;
        min-width: 16px;
        height: 16px;
        padding: 0 4px;
        border-radius: 999px;
        font-size: 10px;
        font-weight: 800;
      }

      .content {
        padding-top: 0 !important;
        padding-bottom: 0px !important;
        scroll-padding-top: 0 !important;
        scroll-padding-bottom: 0px;
      }

      @media (max-width: 640px) {
        .topbar {
  right: max(8px, env(safe-area-inset-right));
  bottom: calc(10px + env(safe-area-inset-bottom));
  padding: 0;
  background: transparent !important;
  box-shadow: none !important;
  border: 0 !important;
}

        .topbar-row {
          min-height: 0;
          flex-direction: column;
          align-items: flex-end;
          gap: 6px;
        }

        .brand-logo {
          gap: 8px;
        }

        .brand-logo h1 {
          font-size: 0.96rem;
        }

        .brand-logo p {
          font-size: 0.64rem;
        }

        .quick-icon-link,
        button.quick-icon-link,
        a.quick-icon-link {
          width: 38px;
          height: 38px;
          min-width: 38px;
          border-radius: 12px;
          background: rgba(143, 184, 198, 0.085) !important;
          border: 0 !important;
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.035) !important;
          color: rgba(248, 250, 252, 0.96) !important;
        }

        .brand-actions {
          flex-direction: column;
          gap: 6px;
          padding: 6px;
        }

        .topbar-create-btn {
          font-size: 1.45rem;
        }
      }

      html,
body,
#root {
  width: 100%;
  height: 100%;
  margin: 0;
  padding: 0;
  overflow: hidden;
  overscroll-behavior-y: none;
  touch-action: pan-y;
}

#root {
  display: flex;
  flex-direction: column;
}

.app-shell {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

      body.route-loading-lock {
        overflow: auto !important;
      }

      .content {
  flex: 1;
  min-height: 0;
  height: 100%;
  padding-top: 0 !important;
  padding-bottom: 0px !important;
  scroll-padding-top: 0 !important;
  scroll-padding-bottom: 0px;
  overflow-y: auto !important;
  overflow-x: hidden;
  overscroll-behavior-y: contain;
  -webkit-overflow-scrolling: touch;
  touch-action: pan-y;
  position: relative;
  display: block;
}

      .content:has(.snap-feed-page) {
        padding-top: 0 !important;
        padding-bottom: 0 !important;
        scroll-padding-top: 0 !important;
        scroll-padding-bottom: 0 !important;
      }

      .content:has(.snap-feed-page) .snap-feed-page {
        min-height: 100dvh;
        height: 100dvh;
      }
        
      main.content.nav-hidden-page,
.app-shell main.content.nav-hidden-page,
.content.nav-hidden-page {
  padding-top: 0 !important;
  padding-bottom: 0 !important;
  scroll-padding-top: 0 !important;
  scroll-padding-bottom: 0 !important;
}
    `}</style>
  );
}

function AppExperience() {
  const { loading } = useAuth();
  const continuesBootScreenRef = useRef(Boolean(window.__SMARTY_BOOT_STARTED__));
  const openedAtRef = useRef(
    Number(window.__SMARTY_BOOT_STARTED__) || Date.now()
  );
  const [splashMounted, setSplashMounted] = useState(true);
  const [splashLeaving, setSplashLeaving] = useState(false);

  useEffect(() => {
    if (loading) return undefined;

    const minimumDisplayTime = 180;
    const remainingTime = Math.max(0, minimumDisplayTime - (Date.now() - openedAtRef.current));
    let removeTimer;

    const leaveTimer = window.setTimeout(() => {
      setSplashLeaving(true);
      removeTimer = window.setTimeout(() => setSplashMounted(false), 230);
    }, remainingTime);

    return () => {
      window.clearTimeout(leaveTimer);
      if (removeTimer) window.clearTimeout(removeTimer);
    };
  }, [loading]);

  return (
    <>
      <ReminderPopupStyles />
      <Layout />
      <ConnectionStatus />
      {splashMounted && (
        <AppOpeningScreen
          leaving={splashLeaving}
          continuation={continuesBootScreenRef.current}
        />
      )}
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ActionConfirmationProvider>
        <AppExperience />
      </ActionConfirmationProvider>
    </AuthProvider>
  );
}
