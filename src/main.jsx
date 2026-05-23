import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import './index.css';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Detect problematic in-app browsers.
const isInAppBrowser = () => {
  if (typeof navigator === 'undefined') {
    return false;
  }

  const ua = navigator.userAgent || '';

  return (
    ua.includes('Telegram') ||
    ua.includes('LinkedIn') ||
    ua.includes('Instagram') ||
    ua.includes('FBAN') ||
    ua.includes('FBAV')
  );
};

// Force users into the real browser because OAuth/session flows
// are unreliable inside embedded mobile browsers.
const redirectToExternalBrowser = () => {
  if (!isInAppBrowser()) {
    return;
  }

  const currentUrl = window.location.href;

  // Telegram Android.
  if (/Telegram/i.test(navigator.userAgent)) {
    window.location.replace(
      `https://t.me/share/url?url=${encodeURIComponent(currentUrl)}`
    );

    return;
  }

  // Generic fallback message.
  document.body.innerHTML = `
    <div style="
      min-height:100vh;
      display:flex;
      align-items:center;
      justify-content:center;
      background:#050816;
      color:white;
      font-family:Inter,system-ui,sans-serif;
      padding:24px;
      text-align:center;
    ">
      <div style="max-width:420px;">
        <h1 style="font-size:28px;margin-bottom:14px;">
          Open Smarty in Safari or Chrome
        </h1>

        <p style="opacity:.82;line-height:1.6;font-size:15px;">
          Login and invite links may not work correctly inside Telegram,
          LinkedIn, Instagram, or Facebook in-app browsers.
        </p>

        <div style="margin-top:28px;">
          <button
            onclick="window.location.href='${currentUrl}'"
            style="
              border:none;
              background:#14b8a6;
              color:white;
              padding:14px 22px;
              border-radius:999px;
              font-size:15px;
              font-weight:600;
              cursor:pointer;
            "
          >
            Open in Browser
          </button>
        </div>
      </div>
    </div>
  `;
};

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
if (
  typeof navigator !== 'undefined' &&
  'clearAppBadge' in navigator &&
  typeof navigator.clearAppBadge === 'function'
) {
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

// Remove old service workers completely. This helps clear stale PWA caches from older builds.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker
    .getRegistrations()
    .then((registrations) => {
      registrations.forEach((registration) => {
        registration.unregister().catch(() => {});
      });
    })
    .catch(() => {});
}

// Keep reload protection active during startup to avoid infinite WebView reload loops.
setTimeout(() => {
  try {
    sessionStorage.removeItem(SMARTY_CHUNK_RELOAD_KEY);
  } catch {
    // Ignore storage failures in strict WebViews.
  }
}, 15000);

redirectToExternalBrowser();
const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element not found');
}

const root = ReactDOM.createRoot(rootElement);

// Signal that React has started mounting.
window.__SMARTY_APP_MOUNTED__ = true;

// Remove boot-loader marker after React startup begins.
requestAnimationFrame(() => {
  delete rootElement.dataset.bootLoading;
});


root.render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
);