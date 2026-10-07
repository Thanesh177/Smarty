import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  BookOpen,
  BrainCircuit,
  Users,
  Bell,
  ShieldCheck,
  LogOut,
  LogIn,
  Bookmark,
  ArrowUpRight,
  LayoutGrid,
  Search,
  Compass,
  X,
} from 'lucide-react';
import './NavbarMenu.css';
import './NavigationPanel.css';
import SmartyBrand from './SmartyBrand';
import { isAdminUser } from '../lib/adminAccess';

function NavbarMenu({ user, logout, onOpenSearch }) {
  const [open, setOpen] = useState(false);
  const [present, setPresent] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [logoutError, setLogoutError] = useState('');
  const navigate = useNavigate();
  const location = useLocation();
  const triggerRef = useRef(null);
  const panelRef = useRef(null);
  const restoreFocusRef = useRef(true);
  const routeRef = useRef(location.key);

  const closeMenu = useCallback((options = {}) => {
    restoreFocusRef.current = options.restoreFocus !== false;
    setOpen(false);
  }, []);

  const toggleMenu = useCallback(() => {
    restoreFocusRef.current = true;
    setLogoutError('');
    setOpen((prev) => !prev);
  }, []);

  const openSearch = useCallback(() => {
    closeMenu();
    window.requestAnimationFrame(() => onOpenSearch?.());
  }, [closeMenu, onOpenSearch]);

  useEffect(() => {
    if (open) { setPresent(true); return undefined; }
    const timer = window.setTimeout(() => setPresent(false), 180);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (routeRef.current === location.key) return;
    routeRef.current = location.key;
    closeMenu({ restoreFocus: false });
  }, [location.key, closeMenu]);

  const handleLogout = useCallback(async () => {
    if (signingOut) return;

    setSigningOut(true);
    setLogoutError('');
    try {
      await logout?.();
      closeMenu();
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
    const shell = document.querySelector('.app-shell');
    const scroller = shell?.querySelector('.content');
    const previousInert = shell?.inert;
    const previousScrollOverflow = scroller?.style.overflowY;
    document.body.style.overflow = 'hidden';
    if (shell) shell.inert = true;
    if (scroller) scroller.style.overflowY = 'hidden';
    const focusable = () => [...(panelRef.current?.querySelectorAll('a[href], button:not(:disabled)') || [])]
      .filter(element => element.getClientRects().length);
    const frame = window.requestAnimationFrame(() => {
      (panelRef.current?.querySelector('.menu-section a') || focusable()[0])?.focus({ preventScroll: true });
    });

    const handleEscape = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        event.stopImmediatePropagation();
        openSearch();
        return;
      }
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
      if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key) && panelRef.current?.contains(document.activeElement)) {
        const items = focusable();
        const index = items.indexOf(document.activeElement);
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1
          : (index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
        event.preventDefault();
        items[next]?.focus();
      }
    };

    window.addEventListener('keydown', handleEscape, true);

    return () => {
      document.body.style.overflow = previousOverflow;
      if (shell) shell.inert = previousInert;
      if (scroller) scroller.style.overflowY = previousScrollOverflow;
      window.cancelAnimationFrame(frame);
      window.removeEventListener('keydown', handleEscape, true);
      if (restoreFocusRef.current && triggerRef.current?.getClientRects().length) triggerRef.current.focus({ preventScroll: true });
    };
  }, [closeMenu, open, openSearch]);

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
        aria-haspopup="dialog"
        aria-controls={open || present ? 'smarty-navigation-panel' : undefined}
      >
        {open ? <X size={18} aria-hidden="true" /> : <LayoutGrid size={18} aria-hidden="true" />}
        <span className="dock-menu-label" aria-hidden="true">More</span>
        <span className="nav-control-label" aria-hidden="true">{open ? 'Close' : 'More'}</span>
      </button>

      {(open || present) && createPortal((
        <div
          className="menu-overlay navigation-dialog"
          data-state={open ? 'open' : 'closing'}
          aria-hidden={!open || undefined}
          role="presentation"
          onClick={(event) => {
            event.stopPropagation();
            closeMenu();
          }}
        >
          <section
            className="menu-panel"
            id="smarty-navigation-panel"
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label="Main navigation"
            inert={!open ? '' : undefined}
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
                <SmartyBrand compact tagline="Your space to learn" />
              </NavLink>

              <button
                type="button"
                className="close-btn"
                onClick={closeMenu}
                aria-label="Close menu"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>

            <div className="menu-body">
            <button type="button" className="menu-search-launch" onClick={openSearch} aria-label="Search Smarty">
              <Search size={18} aria-hidden="true" /><span>Search Smarty</span><ArrowUpRight size={16} aria-hidden="true" />
            </button>
            <nav className="menu-section compact-menu-section" aria-label="Explore Smarty">
              <NavLink to="/learn" onClick={closeMenu} className="menu-icon-link">
                <span className="menu-link-left">
                  <Compass size={18} />
                  <span className="menu-link-copy"><strong>My learning</strong></span>
                </span>
              </NavLink>
              <NavLink to="/booksinfo" onClick={closeMenu} className="menu-icon-link">
                <span className="menu-link-left">
                  <BookOpen size={18} strokeWidth={2.2} />
                  <span className="menu-link-copy"><strong>Books</strong></span>
                </span>
              </NavLink>
              <NavLink to="/quiz" onClick={closeMenu} className="menu-icon-link">
                <span className="menu-link-left">
                  <BrainCircuit size={18} strokeWidth={2.2} />
                  <span className="menu-link-copy"><strong>Quiz</strong></span>
                </span>
              </NavLink>

              <NavLink to="/rooms" onClick={closeMenu} className="menu-icon-link">
                <span className="menu-link-left">
                  <Users size={18} strokeWidth={2.2} />
                  <span className="menu-link-copy"><strong>Rooms</strong></span>
                </span>
              </NavLink>

            </nav>

            {user && <nav className="menu-section menu-personal-section" aria-label="Your space">
              <NavLink to="/saved" onClick={closeMenu} className="menu-icon-link">
                <span className="menu-link-left"><Bookmark size={18} /><span>Saved</span></span>
                <ArrowUpRight className="menu-link-arrow" size={15} aria-hidden="true" />
              </NavLink>
                <NavLink to="/notifications" onClick={closeMenu} className="menu-icon-link">
                  <span className="menu-link-left">
                    <Bell size={18} strokeWidth={2.2} />
                    <span>Notifications</span>
                  </span>
                </NavLink>

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
            </nav>}
            </div>

            <div className="menu-footer" aria-busy={signingOut}>
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
          </section>
        </div>
      ), document.body)}
    </div>
  );
}
export default memo(NavbarMenu);
