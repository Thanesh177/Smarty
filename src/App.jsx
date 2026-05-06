import { Routes, Route, NavLink, Navigate, useLocation } from 'react-router-dom';
import { useState, useEffect, useCallback, useRef, lazy, Suspense, Component } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import NavbarMenu from './components/NavbarMenu';
import { notificationApi, chatApi } from './api/client';
import {
  listenForForegroundMessages,
  setupAndroidPushTokenListener,
} from './firebase';
import AuthRedirectHandler from './components/AuthRedirectHandler';
import InstallPrompt from "./components/InstallPrompt";
import {
  CircleUserRound,
  MessagesSquare,
  BrainCircuit,
} from 'lucide-react';


const Booksinfo = lazy(() => import('./pages/Booksinfo'));
const QuizPage = lazy(() => import('./pages/QuizPage'));
const ProgressPage = lazy(() => import('./pages/progress/ProgressPage'));
const GameProfile = lazy(() => import('./pages/profile/GameProfile'));

// Lazy imports
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

function Layout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [totalUnread, setTotalUnread] = useState(0);
  const touchStartXRef = useRef(null);
  const isAuthPage = location.pathname === '/login' || location.pathname === '/register' || location.pathname === '/confirm';

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

  // Keep chat notification badge updated globally, even when user is not on Chat page
  useEffect(() => {
    if (!user) {
      setTotalUnread(0);
      return undefined;
    }

    let cancelled = false;

    const refreshChatUnread = async () => {
      if (document.visibilityState === 'hidden' || !navigator.onLine) return;

      try {
        const chats = await chatApi.getChats();
        if (cancelled) return;

        const unread = Array.isArray(chats)
          ? chats.reduce((sum, chat) => sum + Number(chat.unreadCount || 0), 0)
          : 0;

        setTotalUnread(unread);
      } catch (error) {
        console.error('Failed to refresh chat unread count:', error);
      }
    };

    refreshChatUnread();

    const intervalId = window.setInterval(refreshChatUnread, 120000);

    window.addEventListener('focus', refreshChatUnread);
    window.addEventListener('chat-unread-refresh', refreshChatUnread);
    document.addEventListener('visibilitychange', refreshChatUnread);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      window.removeEventListener('focus', refreshChatUnread);
      window.removeEventListener('chat-unread-refresh', refreshChatUnread);
      document.removeEventListener('visibilitychange', refreshChatUnread);
    };
  }, [user]);

  // Android WebView push token bridge
  useEffect(() => {
    setupAndroidPushTokenListener?.();
  }, []);

  useEffect(() => {
  const handler = (event) => {
    setTotalUnread(Number(event.detail?.totalUnread || 0));
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


  // Fix Cognito redirect loop

  // ✅ Push notifications (ONLY after PWA install)
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
                  width: '52px',
                  height: '52px',
                  borderRadius: '18px',
                  display: 'grid',
                  placeItems: 'center',
                  overflow: 'hidden',
                  background: 'linear-gradient(145deg, rgba(255,255,255,0.98), rgba(241,245,249,0.94))',
                  border: '1px solid rgba(255,255,255,0.95)',
                  boxShadow: '0 14px 34px rgba(255,255,255,0.18), 0 8px 20px rgba(0,0,0,0.14), inset 0 1px 0 rgba(255,255,255,0.95)',
                  backdropFilter: 'blur(16px)',
                  WebkitBackdropFilter: 'blur(16px)',
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

export default function App() {
  return (
    <AuthProvider>
      <Layout />
    </AuthProvider>
  );
}