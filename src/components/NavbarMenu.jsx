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
      >
        ☰
      </button>

      {open && (
        <>
          <button className="menu-backdrop" type="button" onClick={closeMenu} />

          <nav className="menu-panel">
            <div className="menu-header">
              <h3>Smarty</h3>
              <button type="button" onClick={closeMenu}>×</button>
            </div>

            <NavLink to="/feed" onClick={closeMenu}>Feed</NavLink>
            <NavLink to="/saved" onClick={closeMenu}>Saved</NavLink>
            <NavLink to="/topics" onClick={closeMenu}>Topics</NavLink>
            <NavLink to="/creator-dashboard" onClick={closeMenu}>Dashboard</NavLink>
            {/*<NavLink to="/rooms" onClick={closeMenu}>Rooms</NavLink>*/}


          </nav>
        </>
      )}
    </div>
  );
}