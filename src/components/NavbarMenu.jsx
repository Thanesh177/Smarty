import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import './NavbarMenu.css';
export default function NavbarMenu({ user, logout, totalUnread = 0 }) {
  const [open, setOpen] = useState(false);

  const closeMenu = () => setOpen(false);

  return (
    <div className="navbar-menu">

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