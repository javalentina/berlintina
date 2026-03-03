import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ShowsProvider } from './contexts/ShowsContext';

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; error?: string }> {
  state = { hasError: false, error: '' };
  static getDerivedStateFromError(error: unknown) {
    return { hasError: true, error: String(error) };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '2rem', fontFamily: 'sans-serif', maxWidth: '600px' }}>
          <h1 style={{ color: '#c00' }}>Something went wrong</h1>
          <pre style={{ background: '#f5f5f5', padding: '1rem', overflow: 'auto' }}>{this.state.error}</pre>
          <p>Open the browser Console (F12) for more details.</p>
        </div>
      );
    }
    return this.props.children;
  }
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <ShowsProvider>
        <App />
      </ShowsProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
