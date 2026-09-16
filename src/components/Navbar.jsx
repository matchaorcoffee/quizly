import { useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import './Navbar.css';

export default function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { theme, toggle } = useTheme();
  const { user, profile, signOut } = useAuth();
  const isDark = theme === 'dark';

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  // Close dropdown on route change
  useEffect(() => { setMenuOpen(false); }, [location.pathname]);

  const handleSignOut = async () => {
    setMenuOpen(false);
    try {
      await signOut();
      navigate('/sign-in');
    } catch {
      // ignore
    }
  };

  const displayName = profile?.full_name || user?.email?.split('@')[0] || 'Account';
  const initials = displayName.charAt(0).toUpperCase();

  return (
    <header className="navbar">
      <div className="navbar-inner">
        <Link to="/" className="navbar-brand">
          <span className="navbar-logo">⚡</span>
          <span className="navbar-name">Quizly</span>
        </Link>
        <nav className="navbar-nav">
          <Link
            to="/explore"
            className={`navbar-link ${location.pathname === '/explore' ? 'active' : ''}`}
          >
            🌎 Explore
          </Link>

          {user && (
            <>
              <Link
                to="/"
                className={`navbar-link ${location.pathname === '/' ? 'active' : ''}`}
              >
                My Quizzes
              </Link>
              <Link
                to="/create"
                className={`navbar-link ${location.pathname === '/create' ? 'active' : ''}`}
              >
                Create
              </Link>
            </>
          )}

          <button
            className="theme-toggle"
            onClick={toggle}
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            <span className="theme-toggle-track">
              <span className="theme-toggle-thumb" />
            </span>
            <span className="theme-toggle-label">
              {isDark ? '🌙 Dark' : '☀️ Light'}
            </span>
          </button>

          {user ? (
            <div className="navbar-user-menu" ref={menuRef}>
              <button
                className="navbar-avatar-btn"
                onClick={() => setMenuOpen((o) => !o)}
                aria-label="Account menu"
                aria-expanded={menuOpen}
              >
                <span className="navbar-avatar">{initials}</span>
                <span className="navbar-display-name">{displayName}</span>
                <span className="navbar-chevron">{menuOpen ? '▲' : '▼'}</span>
              </button>

              {menuOpen && (
                <div className="navbar-dropdown" role="menu">
                  <div className="navbar-dropdown-header">
                    <span className="navbar-dropdown-email">{user.email}</span>
                  </div>
                  <hr className="navbar-dropdown-divider" />
                  <Link to="/explore" className="navbar-dropdown-item" role="menuitem">
                    🌎 Explore Quizzes
                  </Link>
                  <Link to="/" className="navbar-dropdown-item" role="menuitem">
                    📋 My Quizzes
                  </Link>
                  <Link to="/create" className="navbar-dropdown-item" role="menuitem">
                    ✚ Create Quiz
                  </Link>
                  <hr className="navbar-dropdown-divider" />
                  <button
                    className="navbar-dropdown-item navbar-dropdown-item--danger"
                    onClick={handleSignOut}
                    role="menuitem"
                  >
                    ↩ Sign Out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="navbar-auth-btns">
              <Link to="/sign-in" className="btn btn-secondary btn-sm">Sign In</Link>
              <Link to="/sign-up" className="btn btn-primary btn-sm">Sign Up</Link>
            </div>
          )}
        </nav>
      </div>
    </header>
  );
}
