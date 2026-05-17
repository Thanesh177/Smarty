import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import './index.css';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

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
const isInAppBrowser = /LinkedInApp|Telegram|FBAN|FBAV|Instagram/i.test(
  navigator.userAgent
);

window.addEventListener('error', (event) => {
  const message = event?.message || '';

  if (
    message.includes('Failed to fetch dynamically imported module') ||
    message.includes('Importing a module script failed')
  ) {
    window.location.reload();
  }
});

window.addEventListener('unhandledrejection', (event) => {
  const reason = String(event?.reason || '');

  if (
    reason.includes('Failed to fetch dynamically imported module') ||
    reason.includes('Importing a module script failed')
  ) {
    window.location.reload();
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

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element not found');
}

window.__SMARTY_APP_MOUNTED__ = true;

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
);