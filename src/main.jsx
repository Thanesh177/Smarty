import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import './index.css';
import 'aws-amplify/auth/enable-oauth-listener';
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

if ('clearAppBadge' in navigator) {
  navigator.clearAppBadge().catch(() => {});
}

// In-app browser + chunk-load recovery
const SMARTY_CHUNK_RELOAD_KEY = 'smarty-chunk-reload-attempted';

const reloadOnceForChunkFailure = () => {
  try {
    if (sessionStorage.getItem(SMARTY_CHUNK_RELOAD_KEY) === '1') {
      return;
    }

    sessionStorage.setItem(SMARTY_CHUNK_RELOAD_KEY, '1');
  } catch {
    // Ignore storage failures in strict WebViews.
  }

  window.location.reload();
};

window.addEventListener('error', (event) => {
  const message = event?.message || '';

  if (
    message.includes('Failed to fetch dynamically imported module') ||
    message.includes('Importing a module script failed')
  ) {
    reloadOnceForChunkFailure();
  }
});

window.addEventListener('unhandledrejection', (event) => {
  const reason = String(event?.reason || '');

  if (
    reason.includes('Failed to fetch dynamically imported module') ||
    reason.includes('Importing a module script failed')
  ) {
    reloadOnceForChunkFailure();
  }
});

// Remove stale service workers in normal browsers, but preserve the official
// iOS app's WebView session and startup state.
if ('serviceWorker' in navigator && !isSmartyNativeApp) {
  navigator.serviceWorker
    .getRegistrations()
    .then((registrations) => {
      registrations.forEach((registration) => {
        registration.unregister().catch(() => {});
      });
    })
    .catch(() => {});
}

// Keep reload protection active during startup to avoid infinite WebView loops.
setTimeout(() => {
  try {
    sessionStorage.removeItem(SMARTY_CHUNK_RELOAD_KEY);
  } catch {
    // Ignore storage failures in strict WebViews.
  }
}, 15000);

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element not found');
}

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
    window.dispatchEvent(new Event("smarty:mounted"));

    window.webkit?.messageHandlers?.smartyNative?.postMessage({
      action: "appReady",
    });
  });
});