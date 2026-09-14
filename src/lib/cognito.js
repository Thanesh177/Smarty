import 'aws-amplify/auth/enable-oauth-listener';
import { Amplify } from 'aws-amplify';
import { signInWithRedirect } from 'aws-amplify/auth';


const COGNITO_DOMAIN = (
  import.meta.env.VITE_COGNITO_DOMAIN || ''
).replace(/^https?:\/\//, '');

const COGNITO_CLIENT_ID =
  import.meta.env.VITE_COGNITO_CLIENT_ID;

const COGNITO_USER_POOL_ID =
  import.meta.env.VITE_COGNITO_USER_POOL_ID;

const PRODUCTION_ORIGIN = 'https://smarty.wiki';

const LEGACY_AMPLIFY_ORIGIN =
  'https://main.d3qiuefonbp8n9.amplifyapp.com';

const NATIVE_REDIRECT_URI = 'smarty://callback';

const NATIVE_REFRESH_TOKEN_KEY =
  'smarty-native-refresh-token';
const NATIVE_REFRESH_SUBJECT_KEY =
  'smarty-native-refresh-subject';

const isBrowser = typeof window !== 'undefined';
let nativeRefreshPromise = null;
let nativeSessionGeneration = 0;

const toBase64Url = (bytes) => {
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
};

const createSecureRandomValue = (byteLength = 48) => {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return toBase64Url(bytes);
};

const createPkceChallenge = async (verifier) => {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(verifier)
  );

  return toBase64Url(new Uint8Array(digest));
};

const isNativeApp = () => {
  if (!isBrowser) return false;

  const search = window.location.search || '';
  const userAgent = window.navigator.userAgent || '';

  return (
    search.includes('platform=android') ||
    search.includes('platform=ios') ||
    Boolean(window.AndroidBridge) ||
    window.__SMARTY_NATIVE_APP__ === true ||
    window.__SMARTY_PLATFORM__ === 'ios' ||
    window.__SMARTY_IS_NATIVE_APP__ === true ||
    /;\s*wv\)/i.test(userAgent) ||
    /\bwv\b/i.test(userAgent) ||
    /Smarty-iOS/i.test(userAgent)
  );
};



const getCurrentOrigin = () => {
  if (!isBrowser) {
    return PRODUCTION_ORIGIN;
  }

  return window.location.origin;
};

const isLocalDevelopmentOrigin = (origin) => {
  try {
    const { hostname } = new URL(origin);
    return (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '[::1]'
    );
  } catch {
    return false;
  }
};

const isAmplifyOrigin = (origin) => {
  try {
    const url = new URL(origin);
    return url.protocol === 'https:' && url.hostname.endsWith('.amplifyapp.com');
  } catch {
    return false;
  }
};

const getWebRedirectSignIn = () => {
  const origin = getCurrentOrigin();

  if (isLocalDevelopmentOrigin(origin)) {
    return `${origin}/`;
  }

  if (origin === LEGACY_AMPLIFY_ORIGIN) {
    return `${LEGACY_AMPLIFY_ORIGIN}/`;
  }

  if (isAmplifyOrigin(origin)) {
    return `${origin}/`;
  }

  return `${PRODUCTION_ORIGIN}/`;
};

const getWebRedirectSignOut = () => {
  const origin = getCurrentOrigin();

  if (isLocalDevelopmentOrigin(origin)) {
    return `${origin}/login`;
  }

  if (origin === LEGACY_AMPLIFY_ORIGIN) {
    return `${LEGACY_AMPLIFY_ORIGIN}/login`;
  }

  if (isAmplifyOrigin(origin)) {
    return `${origin}/login`;
  }

  return `${PRODUCTION_ORIGIN}/login`;
};

const saveCurrentRedirectPath = () => {
  if (!isBrowser) return;

  const currentPath =
    `${window.location.pathname || '/'}` +
    `${window.location.search || ''}` +
    `${window.location.hash || ''}`;

  if (
    currentPath &&
    !/^\/(login|register)(\/|$)/.test(window.location.pathname) &&
    !new URLSearchParams(window.location.search).has('code')
  ) {
    sessionStorage.setItem(
      'smarty-post-login-redirect',
      currentPath
    );

    localStorage.setItem(
      'smarty-post-login-redirect',
      currentPath
    );
  }
};

const redirectSignIn = isNativeApp()
  ? NATIVE_REDIRECT_URI
  : getWebRedirectSignIn();

const redirectSignOut = isNativeApp()
  ? NATIVE_REDIRECT_URI
  : getWebRedirectSignOut();


export const isAndroidCognitoLogin = isNativeApp;
export const isNativeCognitoLogin = isNativeApp;

export const startNativeSocialLogin = async (
  provider,
  fallbackPath = '/feed'
) => {
  if (!COGNITO_DOMAIN || !COGNITO_CLIENT_ID) {
    throw new Error(
      'Missing Cognito domain or client ID. ' +
        'Check VITE_COGNITO_DOMAIN and VITE_COGNITO_CLIENT_ID.'
    );
  }

  const allowedProviders = [
    'Google',
    'Apple',
  ];

  if (!allowedProviders.includes(provider)) {
    throw new Error(
      `Unsupported identity provider: ${provider}`
    );
  }

  saveCurrentRedirectPath();

  const redirectPath =
    sessionStorage.getItem(
      'smarty-post-login-redirect'
    ) || fallbackPath;
  const oauthState = createSecureRandomValue(32);
  const oauthNonce = createSecureRandomValue(32);
  const codeVerifier = createSecureRandomValue(64);
  const codeChallenge = await createPkceChallenge(codeVerifier);

  sessionStorage.setItem(
    'smarty-native-oauth-state',
    oauthState
  );
  localStorage.setItem(
    'smarty-native-oauth-state',
    oauthState
  );
  sessionStorage.setItem(
    'smarty-native-oauth-provider',
    provider.toLowerCase()
  );
  localStorage.setItem(
    'smarty-native-oauth-provider',
    provider.toLowerCase()
  );
  sessionStorage.setItem('smarty-native-oauth-nonce', oauthNonce);
  localStorage.setItem('smarty-native-oauth-nonce', oauthNonce);
  sessionStorage.setItem('smarty-native-oauth-code-verifier', codeVerifier);
  localStorage.setItem('smarty-native-oauth-code-verifier', codeVerifier);
  sessionStorage.setItem(
    'smarty-post-login-redirect',
    redirectPath
  );
  localStorage.setItem(
    'smarty-post-login-redirect',
    redirectPath
  );

  const query = new URLSearchParams({
    identity_provider:
      provider === 'Apple'
        ? 'SignInWithApple'
        : provider,
    redirect_uri: NATIVE_REDIRECT_URI,
    response_type: 'code',
    client_id: COGNITO_CLIENT_ID,
    scope: 'openid email profile',
    state: oauthState,
    nonce: oauthNonce,
    code_challenge_method: 'S256',
    code_challenge: codeChallenge,
  });

  const authorizationUrl = `https://${COGNITO_DOMAIN}/oauth2/authorize?${query.toString()}`;
  window.dispatchEvent(new CustomEvent('smarty:native-auth-started', { detail: { state: oauthState } }));
  const nativeBridge = window.webkit?.messageHandlers?.smartyNative;
  if (nativeBridge?.postMessage) {
    // Keep the current page and its pending login state alive on iOS.
    nativeBridge.postMessage({ action: 'startOAuth', url: authorizationUrl });
  } else {
    window.location.href = authorizationUrl;
  }
};

export const startSocialLogin = async (
  provider,
  redirectPath = '/feed'
) => {
  const normalizedProvider =
    provider === 'Apple' ? 'Apple' : 'Google';

  if (isBrowser) {
    const safeRedirectPath =
      String(redirectPath || '').startsWith('/')
        ? redirectPath
        : '/feed';

    sessionStorage.setItem(
      'smarty-post-login-redirect',
      safeRedirectPath
    );
    localStorage.setItem(
      'smarty-post-login-redirect',
      safeRedirectPath
    );
  }

  if (isNativeApp()) {
    await startNativeSocialLogin(
      normalizedProvider,
      redirectPath
    );
    return;
  }

  await signInWithRedirect({
    provider: normalizedProvider,
  });
};


export const startAndroidGoogleLogin = () =>
  startNativeSocialLogin('Google');
export const startNativeAppleLogin = () =>
  startNativeSocialLogin('Apple');

export const exchangeNativeCodeForTokens = async (
  code,
  options = {}
) => {
  if (!COGNITO_DOMAIN || !COGNITO_CLIENT_ID) {
    throw new Error(
      'Missing Cognito domain or client ID. ' +
      'Check VITE_COGNITO_DOMAIN and VITE_COGNITO_CLIENT_ID.'
    );
  }

  if (!code) {
    throw new Error(
      'Missing authorization code from native callback.'
    );
  }

  const redirectUri =
    options.redirectUri || NATIVE_REDIRECT_URI;
  const codeVerifier =
    options.codeVerifier ||
    sessionStorage.getItem('smarty-native-oauth-code-verifier') ||
    localStorage.getItem('smarty-native-oauth-code-verifier') ||
    '';

  if (!codeVerifier) {
    throw new Error('The secure sign-in session expired. Please try again.');
  }

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: COGNITO_CLIENT_ID,
    code,
    redirect_uri: redirectUri,
    code_verifier: codeVerifier,
  });

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 25000);
  let response;
  let responseText;
  try {
    response = await fetch(
      `https://${COGNITO_DOMAIN}/oauth2/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
        signal: controller.signal,
      }
    );
    responseText = await response.text();
  } catch (error) {
    throw new Error(error.name === 'AbortError'
      ? 'The sign-in service took too long to respond. Please try again.'
      : 'We could not reach the sign-in service. Check your connection and try again.');
  } finally {
    window.clearTimeout(timeout);
  }
  let data = {};

  try {
    data = responseText
      ? JSON.parse(responseText)
      : {};
  } catch {
    data = {
      raw: responseText,
    };
  }

  if (!response.ok) {
    throw new Error(
      data?.error === 'invalid_grant'
        ? 'This sign-in attempt has expired or was already used. Please start sign-in again.'
        : 'The sign-in service could not complete this attempt. Please try again.'
    );
  }

  return data;
};

const decodeTokenPayload = (token) => {
  try {
    const payload = String(token || '').split('.')[1] || '';
    const normalized = payload
      .replace(/-/g, '+')
      .replace(/_/g, '/')
      .padEnd(Math.ceil(payload.length / 4) * 4, '=');

    return JSON.parse(atob(normalized));
  } catch {
    return {};
  }
};

const nativeSessionError = (message, code = '') => {
  const error = new Error(message);
  error.code = code;
  error.invalidSession = [
    'invalid_grant',
    'invalid_client',
    'identity_mismatch',
  ].includes(code);
  return error;
};

export const persistNativeRefreshSession = (
  tokens,
  expectedSubject
) => {
  if (!isBrowser) return false;

  const refreshToken = String(tokens?.refresh_token || '').trim();
  const subject = String(expectedSubject || '').trim();
  const tokenSubject = String(
    decodeTokenPayload(tokens?.id_token || tokens?.access_token).sub || ''
  ).trim();

  if (!refreshToken || !subject || tokenSubject !== subject) {
    return false;
  }

  localStorage.setItem(NATIVE_REFRESH_TOKEN_KEY, refreshToken);
  localStorage.setItem(NATIVE_REFRESH_SUBJECT_KEY, subject);
  nativeSessionGeneration += 1;
  return true;
};

export const hasNativeRefreshSession = (expectedSubject = '') => {
  if (!isBrowser) return false;

  try {
    const refreshToken = localStorage.getItem(NATIVE_REFRESH_TOKEN_KEY) || '';
    const storedSubject = localStorage.getItem(NATIVE_REFRESH_SUBJECT_KEY) || '';
    const expected = String(expectedSubject || '').trim();

    return Boolean(
      refreshToken &&
      storedSubject &&
      (!expected || storedSubject === expected)
    );
  } catch {
    return false;
  }
};

export const clearNativeRefreshSession = () => {
  nativeSessionGeneration += 1;
  nativeRefreshPromise = null;

  if (!isBrowser) return;

  localStorage.removeItem(NATIVE_REFRESH_TOKEN_KEY);
  localStorage.removeItem(NATIVE_REFRESH_SUBJECT_KEY);
};

export const refreshNativeSession = async () => {
  if (!isBrowser) return null;
  if (nativeRefreshPromise) return nativeRefreshPromise;

  const refreshToken = localStorage.getItem(NATIVE_REFRESH_TOKEN_KEY) || '';
  const expectedSubject = localStorage.getItem(NATIVE_REFRESH_SUBJECT_KEY) || '';

  if (!refreshToken || !expectedSubject) return null;
  if (!COGNITO_DOMAIN || !COGNITO_CLIENT_ID) {
    throw nativeSessionError(
      'The sign-in service is not configured for session restoration.',
      'configuration_error'
    );
  }

  const generation = nativeSessionGeneration;
  const request = (async () => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 25000);
    let response;
    let responseText = '';

    try {
      response = await fetch(
        `https://${COGNITO_DOMAIN}/oauth2/token`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            grant_type: 'refresh_token',
            client_id: COGNITO_CLIENT_ID,
            refresh_token: refreshToken,
          }),
          signal: controller.signal,
        }
      );
      responseText = await response.text();
    } catch (error) {
      throw nativeSessionError(
        error.name === 'AbortError'
          ? 'Session restoration took too long. Please try again.'
          : 'We could not refresh your session. Check your connection and try again.',
        error.name === 'AbortError' ? 'timeout' : 'network_error'
      );
    } finally {
      window.clearTimeout(timeout);
    }

    let data = {};
    try {
      data = responseText ? JSON.parse(responseText) : {};
    } catch {
      data = {};
    }

    if (!response.ok) {
      const code = String(data?.error || `http_${response.status}`);
      if (code === 'invalid_grant' || code === 'invalid_client') {
        clearNativeRefreshSession();
      }

      throw nativeSessionError(
        code === 'invalid_grant'
          ? 'Your saved session is no longer valid. Please sign in again.'
          : 'The sign-in service could not restore your session. Please try again.',
        code
      );
    }

    if (generation !== nativeSessionGeneration) {
      throw nativeSessionError(
        'The saved session was cleared while it was being restored.',
        'session_changed'
      );
    }

    const idToken = data?.id_token || '';
    const accessToken = data?.access_token || '';
    const tokenSubject = String(
      decodeTokenPayload(idToken || accessToken).sub || ''
    ).trim();

    if (!tokenSubject || tokenSubject !== expectedSubject) {
      clearNativeRefreshSession();
      throw nativeSessionError(
        'The restored session did not match the signed-in account.',
        'identity_mismatch'
      );
    }

    const rotatedRefreshToken = String(data?.refresh_token || '').trim();
    if (rotatedRefreshToken) {
      localStorage.setItem(NATIVE_REFRESH_TOKEN_KEY, rotatedRefreshToken);
    }

    return {
      ...data,
      refresh_token: rotatedRefreshToken || refreshToken,
      subject: expectedSubject,
    };
  })();

  nativeRefreshPromise = request;

  try {
    return await request;
  } finally {
    if (nativeRefreshPromise === request) {
      nativeRefreshPromise = null;
    }
  }
};

// Retained for older imports while native clients update.
export const exchangeAndroidCodeForTokens =
  exchangeNativeCodeForTokens;

if (
  !COGNITO_DOMAIN ||
  !COGNITO_CLIENT_ID ||
  !COGNITO_USER_POOL_ID
) {
  console.warn(
    'Missing Cognito environment values. ' +
    'Check VITE_COGNITO_DOMAIN, ' +
    'VITE_COGNITO_CLIENT_ID, and ' +
    'VITE_COGNITO_USER_POOL_ID.'
  );
}

Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: COGNITO_USER_POOL_ID,
      userPoolClientId: COGNITO_CLIENT_ID,

      loginWith: {
        email: true,

        oauth: {
          domain: COGNITO_DOMAIN,

          scopes: [
            'openid',
            'email',
            'profile',
          ],

          redirectSignIn: [
            redirectSignIn,
          ],

          redirectSignOut: [
            redirectSignOut,
          ],

          responseType: 'code',
        },
      },
    },
  },
});
