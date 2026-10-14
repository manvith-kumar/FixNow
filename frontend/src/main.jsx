import { StrictMode, Component } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import '@fontsource-variable/bricolage-grotesque';
import '@fontsource-variable/figtree';
import './styles/tokens.css';
import './styles/base.css';
import './styles/components.css';
import './styles/layout.css';
import './styles/pages.css';
import App from './App.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { ToastProvider } from './context/ToastContext.jsx';

class RootErrorBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(err) { console.error('Unhandled UI error', err); }
  render() {
    if (!this.state.failed) return this.props.children;
    return <div className="error-page"><div><div className="code">Oops</div><h1>Something broke on our side</h1><p>Reload the page. If it keeps happening, contact support.</p><button className="btn btn-primary" onClick={() => window.location.assign('/')}>Back to home</button></div></div>;
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <RootErrorBoundary>
      <BrowserRouter>
        <AuthProvider><ToastProvider><App /></ToastProvider></AuthProvider>
      </BrowserRouter>
    </RootErrorBoundary>
  </StrictMode>,
);
