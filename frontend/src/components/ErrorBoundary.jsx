import { Component } from 'react';

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, info: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // keep console visibility for debugging; UI remains usable
    // eslint-disable-next-line no-console
    console.error('UI crashed:', error);
    // eslint-disable-next-line no-console
    console.error('Component stack:', info?.componentStack);
    this.setState({ info });
    try {
      localStorage.setItem(
        'karde_last_ui_error',
        JSON.stringify({
          message: String(error?.message || error),
          stack: String(error?.stack || ''),
          componentStack: String(info?.componentStack || ''),
          at: new Date().toISOString(),
        })
      );
    } catch {
      // ignore storage failures
    }
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div style={{ padding: 24 }}>
        <div className="glass-panel" style={{ padding: 18, borderRadius: 16 }}>
          <div style={{ fontWeight: 800, marginBottom: 8 }}>Something went wrong.</div>
          <div style={{ opacity: 0.8, marginBottom: 12 }}>
            The app hit an unexpected state. Reload to recover.
          </div>
          {this.state?.error && (
            <div style={{ marginBottom: 12, opacity: 0.85, fontSize: 12, lineHeight: 1.4 }}>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>Error</div>
              <div style={{ fontFamily: 'Space Mono, monospace', whiteSpace: 'pre-wrap' }}>
                {String(this.state.error?.message || this.state.error)}
              </div>
            </div>
          )}
          <button
            type="button"
            className="magnetic-btn"
            onClick={() => window.location.reload()}
          >
            Reload
          </button>
        </div>
      </div>
    );
  }
}

