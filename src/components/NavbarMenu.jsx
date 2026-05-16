import { memo, useCallback, useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  BookOpen,
  Newspaper,
  BrainCircuit,
  Users,
  Sparkles,
  LogOut,
  LogIn,
} from 'lucide-react';
import './NavbarMenu.css';
import { signInWithRedirect } from 'aws-amplify/auth';

function hasStoredAuthToken() {
  return Boolean(
    localStorage.getItem('eduscroll_access_token') ||
    localStorage.getItem('accessToken') ||
    localStorage.getItem('idToken') ||
    sessionStorage.getItem('eduscroll_access_token')
  );
}

function NavbarMenu({ user, logout, totalUnread = 0 }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const startGoogleProfileLogin = useCallback(async () => {
    try {
      sessionStorage.setItem('smarty-post-login-redirect', '/profile');
      localStorage.setItem('smarty-post-login-redirect', '/profile');

      await signInWithRedirect({
        provider: 'Google',
      });
    } catch (error) {
      console.error('Google sign-in failed:', error);
    }
  }, []);

  const closeMenu = useCallback(() => {
    setOpen(false);
  }, []);

  const toggleMenu = useCallback(() => {
    setOpen((prev) => !prev);
  }, []);

  const stopMenuPropagation = useCallback((event) => {
    event.preventDefault?.();
    event.stopPropagation?.();
  }, []);

  const handleLogout = useCallback(() => {
    logout?.();
    closeMenu();
  }, [closeMenu, logout]);

  const handleProfileClick = useCallback(async (event) => {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    closeMenu();

    if (user && hasStoredAuthToken()) {
      navigate('/profile');
      return;
    }

    await startGoogleProfileLogin();
  }, [closeMenu, navigate, startGoogleProfileLogin, user]);

  useEffect(() => {
    if (!open) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        closeMenu();
      }
    };

    window.addEventListener('keydown', handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleEscape);
    };
  }, [closeMenu, open]);

  return (
    <div className="navbar-menu">
      <button
        type="button"
        className={`hamburger-btn ${open ? 'is-open' : ''}`}
        onClick={toggleMenu}
        aria-label={open ? 'Close navigation menu' : 'Open navigation menu'}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <span className="hamburger-line" />
        <span className="hamburger-line" />
        <span className="hamburger-line" />
      </button>

      {open && (
        <div
          className="menu-overlay"
          role="presentation"
          onClick={closeMenu}
          onPointerDown={closeMenu}
          onTouchStart={closeMenu}
        >
          <nav
            className="menu-panel"
            aria-label="Main navigation"
            onClick={stopMenuPropagation}
            onPointerDown={stopMenuPropagation}
            onTouchStart={stopMenuPropagation}
          >
            <div className="menu-header">
              <div className="menu-brand-mark" aria-hidden="true">
                <Sparkles size={18} strokeWidth={2.3} />
              </div>

              <div className="menu-title">
                <span>Smarty</span>
                <h3>Explore</h3>
              </div>

              <button
                type="button"
                className="close-btn"
                onClick={closeMenu}
                aria-label="Close menu"
              >
                ✕
              </button>
            </div>

            <div className="menu-section compact-menu-section" aria-label="Learning">
              <NavLink to="/booksinfo" onClick={closeMenu} className="menu-icon-link">
                <span className="menu-link-left">
                  <BookOpen size={18} strokeWidth={2.2} />
                  <span>Books</span>
                </span>
              </NavLink>

              <NavLink to="/news" onClick={closeMenu} className="menu-icon-link">
                <span className="menu-link-left">
                  <Newspaper size={18} strokeWidth={2.2} />
                  <span>News</span>
                </span>
              </NavLink>

              <NavLink to="/quiz" onClick={closeMenu} className="menu-icon-link">
                <span className="menu-link-left">
                  <BrainCircuit size={18} strokeWidth={2.2} />
                  <span>Quiz</span>
                </span>
              </NavLink>

              <NavLink to="/rooms" onClick={closeMenu} className="menu-icon-link">
                <span className="menu-link-left">
                  <Users size={18} strokeWidth={2.2} />
                  <span>Rooms</span>
                </span>
              </NavLink>
            </div>

            <div className="menu-footer">
              {user ? (
                <button
                  type="button"
                  className="logout-pill"
                  onClick={handleLogout}
                >
                  <LogOut size={17} strokeWidth={2.2} />
                  <span>Logout</span>
                </button>
              ) : (
                <button
                  type="button"
                  className="login-pill"
                  onClick={async (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    closeMenu();

                    await startGoogleProfileLogin();
                  }}
                >
                  <LogIn size={17} strokeWidth={2.2} />
                  <span>Sign in with Google</span>
                </button>
              )}
            </div>
          </nav>
        </div>
      )}
    </div>
  );
}
export default memo(NavbarMenu);