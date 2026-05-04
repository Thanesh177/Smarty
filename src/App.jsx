import { Routes, Route, NavLink, Navigate } from 'react-router-dom';
import { useState, useEffect, lazy, Suspense } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import NavbarMenu from './components/NavbarMenu';
import { notificationApi, chatApi } from './api/client';
import {
  listenForForegroundMessages,
  setupAndroidPushTokenListener,
} from './firebase';
import AuthRedirectHandler from './components/AuthRedirectHandler';
import InstallPrompt from "./components/InstallPrompt";


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

function PageLoader() {
  return <p className="status">Loading page...</p>;
}

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) return <p className="status">Loading...</p>;

  return user ? children : <Navigate to="/login" replace />;
}

function Layout() {
  const { user, logout } = useAuth();
  const [totalUnread, setTotalUnread] = useState(0);

  // Keep chat notification badge updated globally, even when user is not on Chat page
  useEffect(() => {
    if (!user) {
      setTotalUnread(0);
      return undefined;
    }

    let cancelled = false;

    const refreshChatUnread = async () => {
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

    const intervalId = window.setInterval(refreshChatUnread, 8000);

    window.addEventListener('focus', refreshChatUnread);
    window.addEventListener('chat-unread-refresh', refreshChatUnread);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      window.removeEventListener('focus', refreshChatUnread);
      window.removeEventListener('chat-unread-refresh', refreshChatUnread);
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
  if (!('setAppBadge' in navigator)) return;

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
      if (!user) return;

      const isStandalone =
        window.matchMedia('(display-mode: standalone)').matches ||
        window.navigator.standalone;

      if (!isStandalone) return;

      await notificationApi.initPush(user);
    }

    setupPush();
  }, [user]);

  // Foreground push listener
  useEffect(() => {
    const unsubscribe = listenForForegroundMessages();
    return () => unsubscribe && unsubscribe();
  }, []);

  return (
    <>
      <AuthRedirectHandler />

      {/* Install popup */}
      <InstallPrompt />

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
              <div className="brand-mark">S</div>
              <div>
                <h1>Smarty</h1>
                <p>Learn while you scroll</p>
              </div>
            </NavLink>

            <div className="brand-actions">
              <NavLink to="/profile" className="quick-icon-link">
                👤
              </NavLink>

              <NavLink to="/chat" className="quick-icon-link">
                💬
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
          <Suspense fallback={<PageLoader />}>
            <Routes>
<Route
  path="/"
  element={
    window.location.search.includes('code=')
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