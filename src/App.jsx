import { Routes, Route, NavLink, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useState, useEffect, useCallback, useRef, Component, useMemo } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { signInWithRedirect } from 'aws-amplify/auth';
import SupportPage from './pages/SupportPage';
import TermsPage from './pages/TermsPage';
import PrivacyPage from './pages/PrivacyPage';
import NavbarMenu from './components/NavbarMenu';
import { notificationApi, chatApi, getPendingRoomInvite } from './api/client';
import {
  listenForForegroundMessages,
  setupAndroidPushTokenListener,
} from './firebase';
import AuthRedirectHandler from './components/AuthRedirectHandler';
import InstallPrompt from './components/InstallPrompt';
import {
  CircleUserRound,
  MessagesSquare,
  House,
} from 'lucide-react';
import SmartyBrand from './components/SmartyBrand';

import {
  connectChatSocket,
  subscribeChatSocket,
} from './api/chatSocket';
import { getUserScopedStorageKey } from './lib/userScopedStorage';

import JoinRoomPage from './pages/JoinRoomPage';
import Booksinfo from './pages/Booksinfo';
import QuizPage from './pages/QuizPage';
import ProgressPage from './pages/progress/ProgressPage';
import GameProfile from './pages/profile/GameProfile';
import CommentsPage from './pages/CommentsPage';
import EditPostPage from './pages/EditPostPage';
import FeedPage from './pages/FeedPage';
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
import ReadBookPage from './pages/ReadBookPage';
import BookReaderPage from './pages/BookReaderPage';
import PostAiPage from './pages/PostAiPage';
import './styles/production-pages.css';
import './styles/ipad.css';

const GLOBAL_PULL_REFRESH_RATIO = 0.4;

function hasStoredAuthToken() {
  return Boolean(
    localStorage.getItem('eduscroll_access_token') ||
    localStorage.getItem('accessToken') ||
    localStorage.getItem('idToken') ||
    sessionStorage.getItem('eduscroll_access_token')
  );
}

async function startGoogleProfileSignIn(redirectPath = '') {
  try {
    const currentPath = `${window.location.pathname || '/'}${window.location.search || ''}${window.location.hash || ''}`;

    const pendingInviteCode = getPendingRoomInviteCode();

    const inviteRedirectPath = pendingInviteCode
      ? `/rooms/invite/${encodeURIComponent(pendingInviteCode)}`
      : '';

    const finalRedirectPath = (
      redirectPath ||
      inviteRedirectPath ||
      currentPath ||
      '/profile'
    );

    sessionStorage.setItem('smarty-post-login-redirect', finalRedirectPath);
    localStorage.setItem('smarty-post-login-redirect', finalRedirectPath);

    if (pendingInviteCode) {
      sessionStorage.setItem('smarty-resume-room-invite', 'true');
      localStorage.setItem('smarty-resume-room-invite', 'true');
    }

    await signInWithRedirect({
      provider: 'Google',
    });
  } catch (error) {
    console.error('Google sign-in failed:', error);
  }
}

function PageLoader() {
  return (
    <div className="app-page-loader" role="status" aria-live="polite">
      <div className="app-page-loader-card">
        <span className="app-page-loader-orb" aria-hidden="true" />
        <div>
          <strong>Loading</strong>
          <p>Preparing your Smarty space</p>
        </div>
      </div>
    </div>
  );
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

class RouteErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Route failed to render:', error, errorInfo);
  }

  componentDidUpdate(prevProps) {
    if (prevProps.children !== this.props.children && this.state.hasError) {
      this.setState({ hasError: false });
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="status" role="alert">
          <p>Something went wrong loading this page.</p>
          <button type="button" onClick={() => window.location.reload()}>
            Reload Smarty
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  const shouldGoogleSignIn = location.pathname === '/profile' || location.pathname.startsWith('/profile/');
  const isReallyAuthenticated = Boolean(user);

  useEffect(() => {
    if (loading || isReallyAuthenticated || !shouldGoogleSignIn) return;

    const pendingInviteCode = getPendingRoomInviteCode();

startGoogleProfileSignIn(
  pendingInviteCode
    ? `/rooms/invite/${encodeURIComponent(pendingInviteCode)}`
    : ''
);
  }, [loading, isReallyAuthenticated, shouldGoogleSignIn]);

  if (loading || (!isReallyAuthenticated && shouldGoogleSignIn)) {
    return <PageLoader />;
  }

  return isReallyAuthenticated ? children : <Navigate to="/login" replace state={{ from: location }} />;
}

function getUserSocketId(user) {
  return (
    user?.userId ||
    user?.sub ||
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
    const count = Number(chat?.unreadCount || 0);
    return sum + (Number.isFinite(count) ? Math.max(0, count) : 0);
  }, 0);
}

function ReminderPopup({ title, body, visible, onClose, onClick }) {
  useEffect(() => {
    if (!visible) return undefined;

    const timer = window.setTimeout(() => {
      onClose?.();
    }, 4200);

    return () => window.clearTimeout(timer);
  }, [visible, onClose]);

  return (
    <button
      type="button"
      className={`reminder-popup ${visible ? 'show' : ''}`}
      onClick={onClick}
      aria-live="polite"
    >
      <div className="reminder-popup-card">
        <strong>{title}</strong>
        <p>{body}</p>
      </div>
    </button>
  );
}

function Layout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const currentUserId = getUserSocketId(user);
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
      return Number(localStorage.getItem(unreadStorageKey) || 0);
    } catch {
      return 0;
    }
  }, [unreadStorageKey]);

  const hideNavPaths = [
    '/quiz',
    '/booksinfo',
    '/bookinfo',
    '/news',
    '/read-books',
    '/preview-books',
    '/read-book',
    '/login',
    '/JoinRoomPage',
 

  ];

  const isSpecificChatRoute =
    location.pathname.startsWith('/chat/') ||
    location.pathname.includes('/messages/') ||
    location.pathname.includes('/conversation/');

  const isSpecificTopicRoomRoute =
    location.pathname.includes('/topic-room/') ||
    location.pathname.includes('/topicrooms/') ||
    (
      location.pathname.startsWith('/rooms/') &&
      !location.pathname.startsWith('/rooms/invite/') &&
      !location.pathname.startsWith('/rooms/join/')
    );

  const shouldHideAppNav =
    hideNavPaths.some(
      (path) =>
        location.pathname === path ||
        location.pathname.startsWith(`${path}/`)
    ) ||
    isSpecificChatRoute ||
    isSpecificTopicRoomRoute;


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

  const touchStartXRef = useRef(null);
  const unreadRefreshInFlightRef = useRef(false);
  const unreadRefreshTimerRef = useRef(null);
  const seenBadgeMessageIdsRef = useRef(new Set());
  const recentNotificationIdsRef = useRef(new Set());
  const globalPullStartYRef = useRef(0);
  const globalPullDistanceRef = useRef(0);
  const globalPullAtTopRef = useRef(false);
  const globalPullTriggeredRef = useRef(false);
  const routeReadyTimerRef = useRef(null);

  const isAuthPage =
    location.pathname === '/login' ||
    location.pathname === '/register' ||
    location.pathname === '/confirm';

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

    return windowTop <= 2 && contentTop <= 2 && feedTop <= 2;
  }, []);

  const resetGlobalPullRefresh = useCallback(() => {
    globalPullStartYRef.current = 0;
    globalPullDistanceRef.current = 0;
    globalPullAtTopRef.current = false;
    globalPullTriggeredRef.current = false;
    setGlobalPullDistance(0);
  }, []);

  const runGlobalPullRefresh = useCallback(() => {
    if (globalRefreshing) return;

    setGlobalRefreshing(true);
    window.dispatchEvent(new CustomEvent('smarty-global-refresh'));

    window.setTimeout(() => {
      resetGlobalPullRefresh();
      setGlobalRefreshing(false);
    }, 650);
  }, [globalRefreshing, resetGlobalPullRefresh]);

  const handleGlobalPullStart = useCallback((event) => {
    if (globalRefreshing || event.touches.length !== 1) return;

    const atTop = isPageAtTop();
    globalPullAtTopRef.current = atTop;
    globalPullTriggeredRef.current = false;

    if (!atTop) {
      resetGlobalPullRefresh();
      return;
    }

    globalPullStartYRef.current = event.touches[0]?.clientY || 0;
    globalPullDistanceRef.current = 0;
    setGlobalPullDistance(0);
  }, [globalRefreshing, isPageAtTop, resetGlobalPullRefresh]);

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
    const distance = Math.max(0, currentY - globalPullStartYRef.current);

    if (distance <= 0) {
      globalPullDistanceRef.current = 0;
      setGlobalPullDistance(0);
      return;
    }

    globalPullDistanceRef.current = distance;
    const triggerDistance = Math.max(120, window.innerHeight * GLOBAL_PULL_REFRESH_RATIO);
    const easedDistance = Math.min(triggerDistance, distance * 0.42);

    setGlobalPullDistance((current) => (
      Math.abs(current - easedDistance) > 1 ? easedDistance : current
    ));
  }, [globalRefreshing, isPageAtTop]);

  const handleGlobalPullEnd = useCallback(() => {
    const triggerDistance = Math.max(120, window.innerHeight * GLOBAL_PULL_REFRESH_RATIO);
    const shouldRefresh =
      !globalRefreshing &&
      globalPullAtTopRef.current &&
      isPageAtTop() &&
      globalPullDistanceRef.current >= triggerDistance;

    if (shouldRefresh && !globalPullTriggeredRef.current) {
      globalPullTriggeredRef.current = true;
      setGlobalPullDistance(triggerDistance);
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
      const nextUnread = Math.max(0, Number(value || 0));
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
      const storedUnread = Number(localStorage.getItem(unreadStorageKey) || 0);
      setTotalUnread(Math.max(0, storedUnread));
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
      const activeChatId = localStorage.getItem(activeChatStorageKey) || '';
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

      if (activeChatId && messageChatId && activeChatId === messageChatId) {
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
      const nextUnread = Math.max(0, Number(event.detail?.totalUnread || 0));

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
  }, [unreadStorageKey]);

  useEffect(() => {
    if (typeof navigator === 'undefined' || !('setAppBadge' in navigator)) return;

    if (totalUnread > 0) {
      navigator.setAppBadge(totalUnread).catch(() => {});
    } else if ('clearAppBadge' in navigator) {
      navigator.clearAppBadge().catch(() => {});
    }
  }, [totalUnread]);

  // Push notifications after PWA install
  useEffect(() => {
    async function setupPush() {
      if (!user || !navigator.onLine) return;

      const isStandalone =
        window.matchMedia('(display-mode: standalone)').matches ||
        window.navigator.standalone;
      const alreadyGranted =
        'Notification' in window &&
        Notification.permission === 'granted';

      if (!isStandalone && !alreadyGranted) return;

      try {
        await notificationApi.initPush(user);
      } catch (error) {
        console.error('Failed to initialize push notifications:', error);
      }
    }

    setupPush();
  }, [user]);

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
      const detail = event.detail || {};
      const rawMessageId = String(
        detail.rawPayload?.messageId ||
        detail.rawPayload?.data?.messageId ||
        detail.rawPayload?.data?.notificationId ||
        ''
      );

      if (rawMessageId) {
        if (recentNotificationIdsRef.current.has(rawMessageId)) return;

        recentNotificationIdsRef.current.add(rawMessageId);

        window.setTimeout(() => {
          recentNotificationIdsRef.current.delete(rawMessageId);
        }, 60_000);
      }

      setPopupNotification({
        title: detail.title || 'Smarty',
        body: detail.body || 'You have a new notification.',
        url: detail.url || '/',
      });

      const notificationType = String(detail.type || '').toLowerCase();

      if (
        notificationType.includes('chat') ||
        notificationType.includes('message')
      ) {
        window.dispatchEvent(new Event('chat-unread-refresh-request'));
      }
    };

    window.addEventListener('smarty-notification', handleSmartyNotification);

    return () => {
      window.removeEventListener('smarty-notification', handleSmartyNotification);
    };
  }, []);



  return (
    <>
      <AuthRedirectHandler />

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

      <div className="app-shell">
        {!shouldHideAppNav && (
          <header className="topbar glass-topbar">
          <div className="topbar-row">
            <NavLink
              to="/feed"
              className="brand-logo fancy-brand"
              onClick={(event) => {
                if (window.location.pathname === '/feed') {
                  event.preventDefault();
                  window.location.reload();
                }
              }}
            >
              <SmartyBrand compact tagline="Learn with intent" />
            </NavLink>

            <div className="brand-actions">

              <NavLink
                to="/feed"
                className="quick-icon-link"
                aria-label="Feed"
                title="Feed"
                onClick={(event) => {
                  if (window.location.pathname === '/feed') {
                    event.preventDefault();
                    window.location.reload();
                  }
                }}
              >
                <House size={20} strokeWidth={2.2} />
              </NavLink>
              <button
                type="button"
                className="quick-icon-link"
                aria-label={user ? 'Profile' : 'Sign in with Google'}
                title={user ? 'Profile' : 'Sign in with Google'}
                onClick={async (event) => {
                  event.preventDefault();
                  event.stopPropagation();

                  if (user) {
                    navigate('/profile');
                    return;
                  }

                  await startGoogleProfileSignIn('/profile');
                }}
              >
                <CircleUserRound size={21} strokeWidth={2.15} />
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
                <MessagesSquare size={21} strokeWidth={2.15} />
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
                title="Create"
              >
                +
              </button>



              <NavbarMenu
                user={user}
                logout={logout}
                totalUnread={totalUnread}
              />
            </div>
          </div>
          </header>
        )}

        <main
          className={`content ${shouldHideAppNav ? 'nav-hidden-page' : ''}`}
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
              <small>{globalRefreshing ? 'Refreshing' : 'Pull to refresh'}</small>
            </div>
          )}

          <RouteErrorBoundary key={location.pathname}>
            <Routes>
                <Route
                  path="/"
                  element={
                    location.search.includes('code=')
                      ? <p className="status">Completing login...</p>
                      : <Navigate to="/feed" replace />
                  }
                />

                <Route path="/feed" element={<FeedPage />} />
                <Route path="/feed/:topic" element={<FeedPage />} />

                <Route path="/booksinfo" element={<Booksinfo />} />
                <Route path="/bookinfo" element={<Booksinfo />} />
                <Route path="/topics" element={<TopicsPage />} />
                <Route path="/news" element={<NewsPage />} />
                <Route path="/read-books" element={<ReadBookPage />} />
                <Route path="/preview-books" element={<ReadBookPage />} />
                <Route path="/read-book/:bookId" element={<BookReaderPage />} />
                <Route path="/support" element={<SupportPage/>} />
                <Route path="/terms" element={<TermsPage/>} />
                <Route path="/privacy" element={<PrivacyPage/>} />

                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />
                <Route path="/confirm" element={<ConfirmPage />} />

                <Route path="/creator/:userId" element={<CreatorProfilePage />} />
                <Route path="/reel/:reelId" element={<ReelDetailPage />} />
                <Route path="/quiz" element={<QuizPage />} />
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
      body:has(.chat-page.mobile-chat-open) .topbar,
      body:has(.rooms-page.mobile-chat-open) .topbar,
      body:has(.chat-page.mobile-chat-open) .glass-topbar,
      body:has(.rooms-page.mobile-chat-open) .glass-topbar {
        display: none !important;
        pointer-events: none !important;
      }
      .app-page-loader {
        width: 100%;
        min-height: calc(100dvh - 96px);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 32px 18px;
        color: #f8fafc;
      }

      .app-page-loader-card {
        display: inline-flex;
        align-items: center;
        gap: 14px;
        padding: 14px 18px;
        border-radius: 24px;
        background:
          radial-gradient(circle at 20% 10%, rgba(56, 189, 248, 0.14), transparent 42%),
          linear-gradient(180deg, rgba(10, 15, 28, 0.78), rgba(6, 10, 20, 0.9));
        border: 1px solid rgba(255, 255, 255, 0.07);
        box-shadow:
          0 24px 70px rgba(0, 0, 0, 0.34),
          inset 0 1px 0 rgba(255, 255, 255, 0.06);
        backdrop-filter: blur(18px) saturate(150%);
        -webkit-backdrop-filter: blur(18px) saturate(150%);
      }

      .app-page-loader-orb {
        width: 34px;
        height: 34px;
        border-radius: 999px;
        background:
          conic-gradient(from 120deg, rgba(56, 189, 248, 0), rgba(56, 189, 248, 0.95), rgba(34, 197, 94, 0.85), rgba(168, 85, 247, 0.8), rgba(56, 189, 248, 0)),
          rgba(15, 23, 42, 0.7);
        position: relative;
        animation: appLoaderSpin 0.95s linear infinite;
        box-shadow: 0 0 26px rgba(56, 189, 248, 0.2);
      }

      .app-page-loader-orb::after {
        content: '';
        position: absolute;
        inset: 4px;
        border-radius: inherit;
        background: #07101f;
      }

      .app-page-loader-card strong {
        display: block;
        font-size: 0.92rem;
        font-weight: 900;
        letter-spacing: -0.02em;
        color: rgba(248, 250, 252, 0.96);
      }

      .app-page-loader-card p {
        margin: 2px 0 0;
        font-size: 0.74rem;
        font-weight: 700;
        color: rgba(148, 163, 184, 0.9);
      }

      @keyframes appLoaderSpin {
        to {
          transform: rotate(360deg);
        }
      }

      @media (max-width: 640px) {
        .app-page-loader {
          min-height: calc(100dvh - 82px);
          padding: 24px 14px;
        }

        .app-page-loader-card {
          padding: 12px 15px;
          border-radius: 22px;
        }

        .app-page-loader-orb {
          width: 30px;
          height: 30px;
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .app-page-loader-orb {
          animation: none;
        }
      }
      .global-pull-refresh {
        position: fixed;
        top: 72px;
        left: 50%;
        z-index: 9999;
        width: 92px;
        height: 54px;
        border: 1px solid rgba(255, 255, 255, 0.12);
        border-radius: 999px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 7px;
        color: rgba(255, 255, 255, 0.9);
        background: linear-gradient(180deg, rgba(10, 15, 28, 0.86), rgba(6, 10, 20, 0.92));
        box-shadow: 0 16px 42px rgba(0, 0, 0, 0.32), inset 0 1px 0 rgba(255, 255, 255, 0.08);
        backdrop-filter: blur(16px);
        -webkit-backdrop-filter: blur(16px);
        pointer-events: none;
        will-change: transform, opacity;
        transition: transform 0.18s ease, opacity 0.18s ease;
      }

      .global-pull-refresh small {
        font-size: 10px;
        font-weight: 800;
        letter-spacing: -0.02em;
        white-space: nowrap;
      }

      .global-pull-refresh-spinner {
        width: 17px;
        height: 17px;
        border-radius: 999px;
        border: 2px solid rgba(255, 255, 255, 0.22);
        border-top-color: rgba(56, 189, 248, 0.95);
        animation: globalPullSpin 0.85s linear infinite;
      }

      .global-pull-refresh.refreshing .global-pull-refresh-spinner {
        border-top-color: rgba(34, 197, 94, 0.95);
      }

      @keyframes globalPullSpin {
        to {
          transform: rotate(360deg);
        }
      }

      @media (max-width: 640px) {
        .global-pull-refresh {
          top: 64px;
        }
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
  background: rgba(2, 6, 23, 0.42);
  border: 1px solid rgba(148, 163, 184, 0.1);
  box-shadow: 0 18px 42px rgba(0, 0, 0, 0.28);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);

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
        background: rgba(2, 6, 23, 0.9) !important;
        border: 1px solid rgba(15, 23, 42, 0.95) !important;
        box-shadow: 0 12px 26px rgba(0, 0, 0, 0.44), inset 0 1px 0 rgba(255,255,255,0.04) !important;
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
        background: rgba(15, 23, 42, 0.98) !important;
        box-shadow: 0 14px 30px rgba(0, 0, 0, 0.52), inset 0 1px 0 rgba(255,255,255,0.06) !important;
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
  right: 10px;
  bottom: calc(10px + env(safe-area-inset-bottom));
  padding: 0;
  background: transparent !important;
  box-shadow: none !important;
  border: 0 !important;
}

        .topbar-row {
          min-height: 58px;
          gap: 8px;
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
          background: rgba(2, 6, 23, 0.92) !important;
          border: 1px solid rgba(15, 23, 42, 0.95) !important;
          box-shadow: 0 12px 26px rgba(0, 0, 0, 0.46), inset 0 1px 0 rgba(255,255,255,0.04) !important;
          color: rgba(248, 250, 252, 0.96) !important;
        }

        .brand-actions {
          gap: 8px;
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

export default function App() {
  return (
    <AuthProvider>
      <ReminderPopupStyles />
      <Layout />
    </AuthProvider>
  );
}
