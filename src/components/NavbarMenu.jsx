import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  BookOpen,
  Newspaper,
  BrainCircuit,
  Users,
  Bell,
  ShieldCheck,
  LogOut,
  LogIn,
  Search,
  GraduationCap,
  Menu,
  X,
} from 'lucide-react';
import './NavbarMenu.css';
import SmartyBrand from './SmartyBrand';
import { isAdminUser } from '../lib/adminAccess';

function NavbarMenu({ user, logout, totalUnread = 0, onOpenSearch }) {
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [logoutError, setLogoutError] = useState('');
  const navigate = useNavigate();
  const triggerRef = useRef(null);
  const panelRef = useRef(null);

  const closeMenu = useCallback(() => {
    setOpen(false);
    triggerRef.current?.focus();
  }, []);

  const toggleMenu = useCallback(() => {
    setOpen((prev) => !prev);
  }, []);

  const stopMenuPropagation = useCallback((event) => {
    event.preventDefault?.();
    event.stopPropagation?.();
  }, []);

  const handleLogout = useCallback(async () => {
    if (signingOut) return;

    setSigningOut(true);
    setLogoutError('');
    closeMenu();

    try {
      await logout?.();
    } catch {
      setLogoutError('Could not finish signing out on this device. Please try again before closing Smarty.');
      setOpen(true);
    } finally {
      setSigningOut(false);
    }
  }, [closeMenu, logout, signingOut]);

  useEffect(() => {
    if (!open) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusable = () => [...(panelRef.current?.querySelectorAll('a[href], button:not(:disabled)') || [])]
      .filter(element => element.getClientRects().length);
    const frame = window.requestAnimationFrame(() => focusable()[0]?.focus());

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeMenu();
      }
      if (event.key === 'Tab') {
        const items = focusable();
        const first = items[0], last = items[items.length - 1];
        if (!first) return;
        if (event.shiftKey && (document.activeElement === first || !panelRef.current?.contains(document.activeElement))) {
          event.preventDefault(); last.focus();
        } else if (!event.shiftKey && (document.activeElement === last || !panelRef.current?.contains(document.activeElement))) {
          event.preventDefault(); first.focus();
        }
      }
    };

    window.addEventListener('keydown', handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.cancelAnimationFrame(frame);
      window.removeEventListener('keydown', handleEscape);
    };
  }, [closeMenu, open]);

  return (
    <div className="navbar-menu">
      <button
        type="button"
        className={`hamburger-btn ${open ? 'is-open' : ''}`}
        ref={triggerRef}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          toggleMenu();
        }}
        aria-label={open ? 'Close navigation menu' : 'Open navigation menu'}
        aria-expanded={open}
        aria-controls={open ? 'smarty-navigation-panel' : undefined}
      >
        {open ? <X size={18} aria-hidden="true" /> : <Menu size={18} aria-hidden="true" />}
        <span className="nav-control-label" aria-hidden="true">{open ? 'Close' : 'More'}</span>
      </button>

      {open && (
        <div
          className="menu-overlay"
          role="presentation"
          onClick={(event) => {
            event.stopPropagation();
            closeMenu();
          }}
        >
          <nav
            className="menu-panel"
            id="smarty-navigation-panel"
            ref={panelRef}
            aria-label="Main navigation"
            onClick={(event) => {
              event.stopPropagation();
            }}
          >
            <div className="menu-header">
              <NavLink
                to="/feed?topic=All"
                onClick={closeMenu}
                className="menu-brand-link"
                aria-label="Smarty — view all posts"
              >
                <SmartyBrand compact tagline="Explore" />
              </NavLink>

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
              <button
                type="button"
                className="menu-link-btn"
                onClick={() => {
                  closeMenu();
                  onOpenSearch?.();
                }}
              >
                <span className="menu-link-left">
                  <Search size={18} strokeWidth={2.2} />
                  <span>Search</span>
                </span>
              </button>

              <NavLink to="/learn" onClick={closeMenu} className="menu-icon-link">
                <span className="menu-link-left"><GraduationCap size={18} strokeWidth={2.2} /><span>My learning</span></span>
              </NavLink>

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

              {user && (
                <NavLink to="/notifications" onClick={closeMenu} className="menu-icon-link">
                  <span className="menu-link-left">
                    <Bell size={18} strokeWidth={2.2} />
                    <span>Notifications</span>
                  </span>
                </NavLink>
              )}

              {isAdminUser(user) && (
                <NavLink
                  to="/admin"
                  onClick={closeMenu}
                  className="menu-icon-link"
                >
                  <span className="menu-link-left">
                    <ShieldCheck size={18} strokeWidth={2.2} />
                    <span>Admin control</span>
                  </span>
                </NavLink>
              )}
            </div>

            <div className="menu-footer">
              {logoutError && <p className="status error" role="alert">{logoutError}</p>}
              {user ? (
                <button
                  type="button"
                  className="logout-pill"
                  onClick={handleLogout}
                  disabled={signingOut}
                  aria-label={signingOut ? 'Signing out' : 'Sign out'}
                  title={signingOut ? 'Signing out' : 'Sign out'}
                >
                  <LogOut size={17} strokeWidth={2.2} />
                  <span>{signingOut ? 'Signing out...' : 'Sign out'}</span>
                </button>
              ) : (
                <button
                  type="button"
                  className="login-pill"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    closeMenu();
                    navigate('/login', { state: { from: '/profile' } });
                  }}
                >
                  <LogIn size={17} strokeWidth={2.2} />
                  <span>Sign in</span>
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
