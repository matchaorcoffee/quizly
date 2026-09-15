import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[Quizly Error]', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: '-apple-system, "Segoe UI", system-ui, sans-serif',
          background: '#f0f2f5',
          padding: '24px',
        }}>
          <div style={{
            background: '#fff',
            borderRadius: '16px',
            border: '1px solid #e5e7eb',
            padding: '40px',
            maxWidth: '540px',
            width: '100%',
            textAlign: 'center',
            boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
          }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
            <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '8px', color: '#1f2328' }}>
              Something went wrong
            </h2>
            <p style={{ color: '#57606a', fontSize: '14px', marginBottom: '20px', lineHeight: 1.6 }}>
              Quizly encountered an unexpected error. Your quiz data is safe in localStorage.
            </p>
            <pre style={{
              background: '#f7f8fa',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              padding: '12px',
              fontSize: '12px',
              textAlign: 'left',
              overflowX: 'auto',
              color: '#dc2626',
              marginBottom: '24px',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}>
              {this.state.error?.message || String(this.state.error)}
            </pre>
            <button
              onClick={() => { this.setState({ error: null }); window.location.href = '/'; }}
              style={{
                background: '#1976d2',
                color: '#fff',
                border: 'none',
                borderRadius: '10px',
                padding: '10px 20px',
                fontSize: '14px',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              Reload App
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
