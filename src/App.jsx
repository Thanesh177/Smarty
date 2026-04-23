import { Routes, Route, NavLink, Navigate } from 'react-router-dom';
import FeedPage from './pages/FeedPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ProfilePage from './pages/ProfilePage';
import SavedPage from './pages/SavedPage';
import CreatePostPage from './pages/CreatePostPage';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import ConfirmPage from './pages/ConfirmPage';
function Layout() {
  const { user, logout } = useAuth();

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <h1>Smarty</h1>
          <p>Learn while you scroll</p>
        </div>
        <nav className="topnav">
          <NavLink to="/feed">Feed</NavLink>
          <NavLink to="/saved">Saved</NavLink>
          <NavLink to="/create">Create</NavLink>
          <NavLink to="/profile">Profile</NavLink>
          {user ? (
            <button className="ghost-btn" onClick={logout}>Logout</button>
          ) : (
            <NavLink to="/login">Login</NavLink>
          )}
        </nav>
      </header>

      <main className="page-wrap">
        <Routes>
          <Route path="/" element={<Navigate to="/feed" replace />} />
          <Route path="/feed" element={<FeedPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
    <Route path="/confirm" element={<ConfirmPage />} />
          <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
          <Route path="/saved" element={<ProtectedRoute><SavedPage /></ProtectedRoute>} />
          <Route path="/create" element={<ProtectedRoute><CreatePostPage /></ProtectedRoute>} />
        </Routes>
      </main>
    </div>
  );
}

function ProtectedRoute({ children }) {
  const { user } = useAuth();
  return user ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <Layout />
    </AuthProvider>
  );
}
