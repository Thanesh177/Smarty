import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import './NavbarMenu.css';
export default function NavbarMenu({ user, logout, totalUnread = 0 }) {
  const [open, setOpen] = useState(false);

  const closeMenu = () => setOpen(false);

  return (
    <div className="navbar-menu">
      <button
        type="button"
        className="hamburger-btn"
        onClick={() => setOpen((prev) => !prev)}
        aria-label="Open navigation menu"
        aria-expanded={open}
      >
        ☰
      </button>

      {open && (
        <>
          <button className="menu-backdrop" type="button" onClick={closeMenu} />

          <nav className="menu-panel" aria-label="Main navigation">
            <div className="menu-header">
              <div>
                <span>Smarty</span>
                <h3>Navigation</h3>
              </div>
              <button type="button" className="menu-close-btn" onClick={closeMenu}>
                ×
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
        </>
      )}
    </div>
  );
}