import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import './index.css';
// The shared product language follows every route stylesheet and the reset.
import './styles/premium-theme.css';
import './styles/product-theme.css';
import './styles/chat-workspace.css';
import './styles/feed-learning-home.css';
import './styles/interface-polish.css';
import './styles/form-controls.css';
import './styles/navigation-toolbar.css';
import 'aws-amplify/auth/enable-oauth-listener';
import { claimChunkRecovery, isChunkLoadFailure } from './lib/chunkRecovery';
import {
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query';

const userAgent = navigator.userAgent || '';

const isSmartyNativeApp =
  window.__SMARTY_NATIVE_APP__ === true ||
  window.__SMARTY_PLATFORM__ === 'ios' ||
  window.__SMARTY_IS_NATIVE_APP__ === true ||
  /Smarty-iOS/i.test(userAgent);

window.__SMARTY_IS_NATIVE_APP__ = isSmartyNativeApp;

// React Query setup
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 30,
      gcTime: 1000 * 60 * 10,
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});

// In-app browser + chunk-load recovery
const reloadOnceForChunkFailure = () => {
  try {
    if (claimChunkRecovery({ storage: sessionStorage, online: navigator.onLine !== false })) window.location.reload();
  } catch {
    // An unavailable guard must not create a WebView reload loop.
  }
};

window.addEventListener('error', (event) => {
  const message = event?.message || '';

  if (isChunkLoadFailure(message)) {
    reloadOnceForChunkFailure();
  }
});

window.addEventListener('unhandledrejection', (event) => {
  const reason = String(event?.reason || '');

  if (isChunkLoadFailure(reason)) {
    reloadOnceForChunkFailure();
  }
});

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element not found');
}

function mountApp() {
  // bootstrap.js restores device storage before importing this module tree,
  // including the authentication SDK (not merely before React rendering).
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </QueryClientProvider>
    </React.StrictMode>
  );
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      window.__SMARTY_APP_MOUNTED__ = true;
      window.dispatchEvent(new Event('smarty:mounted'));
      window.webkit?.messageHandlers?.smartyNative?.postMessage({ action: 'appReady' });
    });
  });
}

mountApp();
