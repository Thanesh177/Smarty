import { Routes, Route, NavLink, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';

import NavbarMenu from './components/NavbarMenu';
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

function ProtectedRoute({ children }) {
  const { user } = useAuth();
  return user ? children : <Navigate to="/login" replace />;
}

function Layout() {
  const { user, logout } = useAuth();
  const [totalUnread, setTotalUnread] = useState(0);

  useEffect(() => {
    if (user) setTotalUnread(0);
  }, [user]);

  return (
    <div className="app-shell">
      <header className="topbar glass-topbar">
        <div className="topbar-row">
          <NavLink to="/feed" className="brand-logo fancy-brand">
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
              {totalUnread > 0 && <span className="nav-badge">{totalUnread}</span>}
            </NavLink>

            {user ? (
              <button className="logout-pill" onClick={logout}>
                Logout
              </button>
            ) : (
              <NavLink to="/login" className="login-pill">
                Login
              </NavLink>
            )}

            <NavbarMenu user={user} logout={logout} totalUnread={totalUnread} />
          </div>
        </div>
      </header>

      <main className="content">
        <Routes>
          <Route path="/" element={<Navigate to="/feed" replace />} />
          <Route path="/feed" element={<FeedPage />} />
          <Route path="/feed/:topic" element={<FeedPage />} />
          <Route path="/topics" element={<TopicsPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/confirm" element={<ConfirmPage />} />
          <Route path="/creator/:userId" element={<CreatorProfilePage />} />
          <Route path="/reel/:reelId" element={<ReelDetailPage />} />
          <Route path="/edit/:reelId" element={ <ProtectedRoute> <EditPostPage /> </ProtectedRoute> }/>
          <Route path="/chat" element={<ProtectedRoute><ChatPage /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
          <Route path="/saved" element={<ProtectedRoute><SavedPage /></ProtectedRoute>} />
          <Route path="/create" element={<ProtectedRoute><CreatePostPage /></ProtectedRoute>} />
          <Route path="/creator-dashboard" element={<ProtectedRoute><CreatorDashboardPage /></ProtectedRoute>} />
          <Route path="/follow-requests" element={<ProtectedRoute><FollowRequestsPage /></ProtectedRoute>} />
          <Route path="/rooms" element={<ProtectedRoute><TopicRoomsPage /></ProtectedRoute>} />

          <Route path="*" element={<Navigate to="/feed" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Layout />
    </AuthProvider>
  );
}