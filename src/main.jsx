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

// Service Worker (disable in problematic in-app browsers)
if (
  'serviceWorker' in navigator &&
  import.meta.env.PROD &&
  !isInAppBrowser
) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then(() => console.log('✅ Service Worker registered'))
      .catch((err) => console.error('❌ SW error', err));
  });
} else if ('serviceWorker' in navigator && isInAppBrowser) {
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

if (rootElement && !rootElement.innerHTML.trim()) {
  rootElement.innerHTML = `
    <div style="
      height:100vh;
      display:flex;
      align-items:center;
      justify-content:center;
      background:#050816;
      color:white;
      font-family:Inter,sans-serif;
      font-size:14px;
      letter-spacing:-0.02em;
    ">
      Loading Smarty...
    </div>
  `;
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
);