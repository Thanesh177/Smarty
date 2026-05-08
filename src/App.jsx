import { Routes, Route, NavLink, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useState, useEffect, useCallback, useRef, lazy, Suspense, Component } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import NavbarMenu from './components/NavbarMenu';
import { notificationApi, chatApi } from './api/client';
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
  disconnectChatSocket,
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
const ReelDetailPage = lazy(() => import('./pages/ReelDetailPage'));
const NewsPage = lazy(() => import('./pages/NewsPage'));
const ReadBookPage = lazy(() => import('./pages/ReadBookPage'));
const BookReaderPage = lazy(() => import('./pages/BookReaderPage'));
const PostAiPage = lazy(() => import('./pages/PostAiPage'));

function PageLoader() {
  return <p className="status">Loading page...</p>;
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

  if (loading) return <p className="status">Loading...</p>;

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

  const touchStartXRef = useRef(null);
  const unreadRefreshInFlightRef = useRef(false);
  const unreadRefreshTimerRef = useRef(null);

  const isAuthPage =
    location.pathname === '/login' ||
    location.pathname === '/register' ||
    location.pathname === '/confirm';

  const goBack = useCallback(() => {
    window.history.back();
  }, []);

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
      disconnectChatSocket();

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

        <main className="content">
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