import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Auth.css';

export default function ForgotPassword() {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) {
      setError('Please enter your email address.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await resetPassword(email);
      setSent(true);
    } catch (err) {
      setError(err.message || 'Failed to send reset email. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <div className="auth-logo">
            <span className="auth-logo-icon">⚡</span>
            <span className="auth-logo-name">Quizly</span>
          </div>
          <div className="auth-success-state">
            <div className="auth-success-icon">📧</div>
            <h2 className="auth-title">Email sent!</h2>
            <p className="auth-subtitle">
              If an account exists for <strong>{email}</strong>, you&apos;ll receive a password
              reset link shortly. Check your spam folder if you don&apos;t see it.
            </p>
            <Link to="/sign-in" className="btn btn-primary btn-lg auth-submit-btn">
              Back to Sign In
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <span className="auth-logo-icon">⚡</span>
          <span className="auth-logo-name">Quizly</span>
        </div>
        <h1 className="auth-title">Reset your password</h1>
        <p className="auth-subtitle">
          Enter your email and we&apos;ll send you a reset link.
        </p>

        {error && (
          <div className="alert alert-error" role="alert">{error}</div>
        )}

        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label className="form-label" htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              className="form-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              required
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-lg auth-submit-btn"
            disabled={loading}
          >
            {loading ? <span className="auth-spinner" /> : null}
            {loading ? 'Sending…' : 'Send Reset Email'}
          </button>
        </form>

        <p className="auth-switch">
          <Link to="/sign-in">← Back to Sign In</Link>
        </p>
      </div>
    </div>
  );
}
