import { Link, useLocation } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import './Navbar.css';

export default function Navbar() {
  const location = useLocation();
  const { theme, toggle } = useTheme();
  const isDark = theme === 'dark';

  return (
    <header className="navbar">
      <div className="navbar-inner">
        <Link to="/" className="navbar-brand">
          <span className="navbar-logo">⚡</span>
          <span className="navbar-name">Quizly</span>
        </Link>
        <nav className="navbar-nav">
          <Link
            to="/"
            className={`navbar-link ${location.pathname === '/' ? 'active' : ''}`}
          >
            Dashboard
          </Link>
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
          <Link to="/create" className="btn btn-primary btn-sm">
            + Create Quiz
          </Link>
        </nav>
      </div>
    </header>
  );
}
