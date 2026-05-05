import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import './NavbarMenu.css';
export default function NavbarMenu({ user, logout, totalUnread = 0 }) {
  const [open, setOpen] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [lastScrollY, setLastScrollY] = useState(0);

  const closeMenu = () => setOpen(false);

  useEffect(() => {
    let previousScrollY = window.scrollY || document.documentElement.scrollTop || 0;

    const handleScroll = (event) => {
      const target = event.target === document ? document.documentElement : event.target;
      const currentScrollY = target?.scrollTop ?? window.scrollY ?? 0;

      if (open) {
        setHidden(false);
        previousScrollY = currentScrollY;
        return;
      }

      if (currentScrollY > previousScrollY + 8 && currentScrollY > 80) {
        setHidden(true);
      }

      if (currentScrollY < previousScrollY - 12 || currentScrollY <= 20) {
        setHidden(false);
      }

      previousScrollY = currentScrollY;
      setLastScrollY(currentScrollY);
    };

    window.addEventListener('scroll', handleScroll, { passive: true, capture: true });
    document.addEventListener('scroll', handleScroll, { passive: true, capture: true });

    return () => {
      window.removeEventListener('scroll', handleScroll, { capture: true });
      document.removeEventListener('scroll', handleScroll, { capture: true });
    };
  }, [open]);

  return (
    <div className={`navbar-menu ${hidden ? 'navbar-menu-hidden' : ''}`}>

      <button
        type="button"
        className={`hamburger-btn ${open ? 'is-open' : ''}`}
        onClick={() => setOpen((prev) => !prev)}
        aria-label={open ? 'Close navigation menu' : 'Open navigation menu'}
        aria-expanded={open}
      >
        <span className="hamburger-line" />
        <span className="hamburger-line" />
        <span className="hamburger-line" />
      </button>

      {open && (
        <div
          className="menu-overlay"
          onClick={closeMenu}
          onTouchStart={closeMenu}
        >
          <nav
            className="menu-panel"
            aria-label="Main navigation"
            onClick={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
          >
            <div className="menu-header">
              <div className="menu-title">
                <span>Smarty</span>
                <h3>Navigation</h3>
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

            {/* Profile card removed - starting directly with navigation sections */}

            <div className="menu-section">
              <NavLink to="/feed" onClick={closeMenu}>Feed</NavLink>
              <NavLink to="/booksinfo" onClick={closeMenu}>Books</NavLink>
              <NavLink to="/news" onClick={closeMenu}>News</NavLink>
              <NavLink to="/topics" onClick={closeMenu}>Topics</NavLink>
              <NavLink to="/quiz" onClick={closeMenu}>Quiz</NavLink>
              
            </div>

            <div className="menu-section">
              <p className="section-label">Community</p>
                                <NavLink to="/rooms" onClick={closeMenu}>Rooms</NavLink>

            </div>


            <div className="menu-footer">
              {user ? (
                <button
                  type="button"
                  className="logout-pill"
                  onClick={() => {
                    logout();
                    closeMenu();
                  }}
                >
                  Logout
                </button>
              ) : (
                <NavLink to="/login" className="login-pill" onClick={closeMenu}>
                  Login
                </NavLink>
              )}
            </div>
          </nav>
        </div>
      )}
    </div>
  );
}