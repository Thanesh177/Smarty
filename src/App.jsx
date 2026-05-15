import { Routes, Route, NavLink, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useState, useEffect, useCallback, useRef, lazy, Suspense, Component } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
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
  BrainCircuit,
} from 'lucide-react';

import {
  connectChatSocket,
  subscribeChatSocket,
} from './api/chatSocket';

const Booksinfo = lazy(() => import('./pages/Booksinfo'));
const QuizPage = lazy(() => import('./pages/QuizPage'));
const ProgressPage = lazy(() => import('./pages/progress/ProgressPage'));
const GameProfile = lazy(() => import('./pages/profile/GameProfile'));

const CommentsPage = lazy(() => import('./pages/CommentsPage'));
const EditPostPage = lazy(() => import('./pages/EditPostPage'));
const FeedPage = lazy(() => import('./pages/FeedPage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const RegisterPage = lazy(() => import('./pages/RegisterPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const SavedPage = lazy(() => import('./pages/SavedPage'));
const CreatePostPage = lazy(() => import('./pages/CreatePostPage'));
const TopicsPage = lazy(() => import('./pages/TopicsPage'));
const ConfirmPage = lazy(() => import('./pages/ConfirmPage'));
const ChatPage = lazy(() => import('./pages/ChatPage'));
const CreatorProfilePage = lazy(() => import('./pages/CreatorProfilePage'));
const CreatorDashboardPage = lazy(() => import('./pages/CreatorDashboardPage'));
const FollowRequestsPage = lazy(() => import('./pages/FollowRequestsPage'));
const TopicRoomsPage = lazy(() => import('./pages/TopicRoomsPage'));
import JoinRoomPage from './pages/JoinRoomPage';
const ReelDetailPage = lazy(() => import('./pages/ReelDetailPage'));
const NewsPage = lazy(() => import('./pages/NewsPage'));
const ReadBookPage = lazy(() => import('./pages/ReadBookPage'));
const BookReaderPage = lazy(() => import('./pages/BookReaderPage'));
const PostAiPage = lazy(() => import('./pages/PostAiPage'));

const GLOBAL_PULL_REFRESH_RATIO = 0.4;

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

  render() {
    if (this.state.hasError) {
      return (
        <div className="status" role="alert">
          Something went wrong loading this page. Please refresh or try again.
        </div>
      );
    }

    return this.props.children;
  }
}

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return null;

  return user ? children : <Navigate to="/login" replace state={{ from: location }} />;
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

function getUnreadFromChatsPayload(payload) {
  const chats = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.chats)
      ? payload.chats
      : [];

  return chats.reduce((sum, chat) => sum + Number(chat?.unreadCount || 0), 0);
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

  const [totalUnread, setTotalUnread] = useState(0);
  const [popupNotification, setPopupNotification] = useState(null);
  const [globalPullDistance, setGlobalPullDistance] = useState(0);
  const [globalRefreshing, setGlobalRefreshing] = useState(false);

  const touchStartXRef = useRef(null);
  const unreadRefreshInFlightRef = useRef(false);
  const unreadRefreshTimerRef = useRef(null);
  const globalPullStartYRef = useRef(0);
  const globalPullDistanceRef = useRef(0);
  const globalPullAtTopRef = useRef(false);
  const globalPullTriggeredRef = useRef(false);

  const isAuthPage =
    location.pathname === '/login' ||
    location.pathname === '/register' ||
    location.pathname === '/confirm';

  useEffect(() => {
    if (!user) return;
    if (isRoomInvitePath(location.pathname)) return;

    const pendingInviteCode = getPendingRoomInviteCode();
    if (!pendingInviteCode) return;

    navigate(`/rooms/invite/${encodeURIComponent(pendingInviteCode)}`, {
      replace: true,
      state: {
        resumePendingInvite: true,
        pendingInviteCode,
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
      window.location.reload();
    }, 180);
  }, [globalRefreshing]);

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

  // Global chat badge: works even when user is not on Chat page
  useEffect(() => {
    if (!user) {
      setTotalUnread(0);

      try {
        localStorage.setItem('smartyChatUnreadCount', '0');
      } catch {
        // ignore storage errors
      }

      return undefined;
    }

    let cancelled = false;
    const userId = getUserSocketId(user);

    const applyUnread = (value) => {
      const nextUnread = Math.max(0, Number(value || 0));
      setTotalUnread(nextUnread);

      try {
        localStorage.setItem('smartyChatUnreadCount', String(nextUnread));
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

      unreadRefreshInFlightRef.current = true;

      try {
        const chatsPayload = await chatApi.getChats();
        if (cancelled) return;

        applyUnread(getUnreadFromChatsPayload(chatsPayload));
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
      const storedUnread = Number(localStorage.getItem('smartyChatUnreadCount') || 0);
      if (storedUnread > 0) setTotalUnread(storedUnread);
    } catch {
      // ignore storage errors
    }

    refreshChatUnread({ force: true });

    if (userId) {
      connectChatSocket(userId);
    }

    const unsubscribeSocket = subscribeChatSocket((data) => {
      if (data?.type !== 'newMessage' || !data?.message) return;

      const senderId = data.message.senderId || data.message.userId || '';
      const activeChatId = localStorage.getItem('activeChatId') || '';
      const messageChatId = data.message.chatId || '';

      if (senderId && senderId === userId) return;

      if (activeChatId && messageChatId && activeChatId === messageChatId) {
        scheduleUnreadRefresh();
        return;
      }

      setTotalUnread((current) => {
        const nextUnread = Number(current || 0) + 1;

        try {
          localStorage.setItem('smartyChatUnreadCount', String(nextUnread));
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
      if (event.key === 'smartyChatUnreadCount') {
        applyUnread(event.newValue);
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshChatUnread({ force: true });
      }
    };

    window.addEventListener('focus', handleRefresh);
    window.addEventListener('storage', handleStorage);
    window.addEventListener('chat-unread-refresh', handleRefresh);
    window.addEventListener('chat-unread-refresh-request', handleRefresh);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      cancelled = true;

      if (unreadRefreshTimerRef.current) {
        window.clearTimeout(unreadRefreshTimerRef.current);
        unreadRefreshTimerRef.current = null;
      }

      window.clearInterval(intervalId);
      unsubscribeSocket?.();

      window.removeEventListener('focus', handleRefresh);
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('chat-unread-refresh', handleRefresh);
      window.removeEventListener('chat-unread-refresh-request', handleRefresh);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user]);

  // Android WebView push token bridge
  useEffect(() => {
    setupAndroidPushTokenListener?.();
  }, []);

  useEffect(() => {
    const handler = (event) => {
      const nextUnread = Math.max(0, Number(event.detail?.totalUnread || 0));

      setTotalUnread(nextUnread);

      try {
        localStorage.setItem('smartyChatUnreadCount', String(nextUnread));
      } catch {
        // ignore storage errors
      }
    };

    window.addEventListener('chat-unread-update', handler);

    return () => {
      window.removeEventListener('chat-unread-update', handler);
    };
  }, []);

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

      if (!isStandalone) return;

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
    const unsubscribe = listenForForegroundMessages();
    return () => unsubscribe && unsubscribe();
  }, []);

  useEffect(() => {
    const handleSmartyNotification = (event) => {
      const detail = event.detail || {};

      setPopupNotification({
        title: detail.title || 'Smarty',
        body: detail.body || 'You have a new notification.',
        url: detail.url || '/',
      });
    };

    window.addEventListener('smarty-notification', handleSmartyNotification);

    return () => {
      window.removeEventListener('smarty-notification', handleSmartyNotification);
    };
  }, []);

  useEffect(() => {
    const preloadCommonPages = () => {
      if (document.visibilityState === 'hidden' || !navigator.onLine) return;

      const preloadTasks = [
        () => import('./pages/FeedPage'),
        () => import('./pages/ProfilePage'),
        () => import('./pages/ChatPage'),
        () => import('./pages/SavedPage'),
      ];

      preloadTasks.forEach((preloadTask, index) => {
        window.setTimeout(() => {
          preloadTask().catch((error) => {
            console.warn('Page preload failed:', error);
          });
        }, index * 700);
      });
    };

    if ('requestIdleCallback' in window) {
      const idleId = window.requestIdleCallback(preloadCommonPages, { timeout: 5000 });
      return () => window.cancelIdleCallback?.(idleId);
    }

    const timeoutId = window.setTimeout(preloadCommonPages, 2500);
    return () => window.clearTimeout(timeoutId);
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
              <div
                className="brand-mark"
                aria-hidden="true"
                style={{
                  position: 'relative',
                  width: '46px',
                  height: '46px',
                  borderRadius: '12px',
                  display: 'grid',
                  placeItems: 'center',
                  overflow: 'hidden',
                  background: 'linear-gradient(145deg, rgba(255,255,255,0.98), rgba(241,245,249,0.94))',
                  border: '1px solid rgba(255,255,255,0.95)',
                  boxShadow: '5px 5px 5px rgba(255, 255, 255, 0.54), 0 4px 10px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.9)',
                  backdropFilter: 'blur(12px)',
                  WebkitBackdropFilter: 'blur(12px)',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    inset: '-30%',
                    background: 'conic-gradient(from 90deg, rgba(56,189,248,0), rgba(56,189,248,0.28), rgba(168,85,247,0.22), rgba(56,189,248,0))',
                  }}
                />

                <div
                  style={{
                    position: 'absolute',
                    inset: '1px',
                    borderRadius: '17px',
                    background: 'linear-gradient(145deg, rgba(255,255,255,0.98), rgba(248,250,252,0.95))',
                  }}
                />

                <div
                  style={{
                    position: 'relative',
                    zIndex: 2,
                    width: '38px',
                    height: '38px',
                    borderRadius: '14px',
                    display: 'grid',
                    placeItems: 'center',
                    background: 'linear-gradient(145deg, rgba(240,249,255,0.95), rgba(255,255,255,0.92))',
                    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.95)',
                  }}
                >
                  <BrainCircuit
                    size={22}
                    strokeWidth={2.5}
                    color="#0f172a"
                    style={{
                      filter: 'drop-shadow(0 2px 6px rgba(56,189,248,0.22))',
                    }}
                  />
                </div>
              </div>

              <div>
                <h1>Smarty</h1>
                <p>Learn while you scroll</p>
              </div>
            </NavLink>

            <div className="brand-actions">
              <NavLink
                to="/profile"
                className="quick-icon-link"
                aria-label="Profile"
                title="Profile"
              >
                <CircleUserRound size={21} strokeWidth={2.15} />
              </NavLink>

              <NavLink
                to="/chat"
                className="quick-icon-link"
                aria-label="Chat"
                title="Chat"
              >
                <MessagesSquare size={21} strokeWidth={2.15} />
                {totalUnread > 0 && (
                  <span className="nav-badge">{totalUnread}</span>
                )}
              </NavLink>

              <NavbarMenu
                user={user}
                logout={logout}
                totalUnread={totalUnread}
              />
            </div>
          </div>
        </header>

        <main
          className="content"
          onTouchStart={handleGlobalPullStart}
          onTouchMove={handleGlobalPullMove}
          onTouchEnd={handleGlobalPullEnd}
          onTouchCancel={resetGlobalPullRefresh}
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
            <Suspense fallback={<PageLoader />}>
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
                      <TopicRoomsPage />
                    </ProtectedRoute>
                  }
                />

                <Route path="*" element={<Navigate to="/feed" replace />} />
              </Routes>
            </Suspense>
          </RouteErrorBoundary>
        </main>
      </div>
    </>
  );
}

function ReminderPopupStyles() {
  return (
    <style>{`
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