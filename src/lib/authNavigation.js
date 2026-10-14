const REDIRECT_KEY = 'smarty-post-login-redirect';

export function safeAuthDestination(value, fallback = '/feed') {
  const candidate = typeof value === 'string' ? value
    : value?.pathname ? `${value.pathname}${value.search || ''}${value.hash || ''}` : '';
  // Never carry an OAuth response, external URL or auth-page loop into the app.
  if (!candidate.startsWith('/') || candidate.startsWith('//') || /[\\\u0000-\u0020]/.test(candidate)) return fallback;
  try {
    const url = new URL(candidate, 'https://smarty.invalid');
    if (url.origin !== 'https://smarty.invalid' || /^\/(login|register|confirm)(\/|$)/i.test(url.pathname)
      || url.searchParams.has('code') || url.searchParams.has('state')) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch { return fallback; }
}

function redirectStores() {
  const stores = [];
  for (const name of ['sessionStorage', 'localStorage']) {
    try { if (globalThis[name]) stores.push(globalThis[name]); } catch { /* restricted browser storage */ }
  }
  return stores;
}

export function saveAuthDestination(value) {
  const safe = safeAuthDestination(value);
  for (const store of redirectStores()) {
    try { store.setItem(REDIRECT_KEY, safe); } catch { /* routing must not block sign-in */ }
  }
  return safe;
}

export function readAuthDestination(fallback = '/feed') {
  for (const store of redirectStores()) {
    try {
      const value = store.getItem(REDIRECT_KEY);
      if (value) return safeAuthDestination(value, fallback);
    } catch { /* try the other store */ }
  }
  return fallback;
}

export function clearAuthDestination() {
  for (const store of redirectStores()) {
    try { store.removeItem(REDIRECT_KEY); } catch { /* routing must not block sign-in */ }
  }
}
