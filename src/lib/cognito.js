import 'aws-amplify/auth/enable-oauth-listener';
import { Amplify } from 'aws-amplify';

const COGNITO_DOMAIN = (import.meta.env.VITE_COGNITO_DOMAIN || '').replace(/^https?:\/\//, '');
const COGNITO_CLIENT_ID = import.meta.env.VITE_COGNITO_CLIENT_ID;
const COGNITO_USER_POOL_ID = import.meta.env.VITE_COGNITO_USER_POOL_ID;

const WEB_REDIRECT_SIGN_IN = 'https://main.d3qiuefonbp8n9.amplifyapp.com/';
const WEB_REDIRECT_SIGN_OUT = 'https://main.d3qiuefonbp8n9.amplifyapp.com/login';
const LOCAL_REDIRECT_SIGN_IN = 'http://localhost:5173/';
const LOCAL_REDIRECT_SIGN_OUT = 'http://localhost:5173/login';
const ANDROID_REDIRECT_URI = 'smarty://callback';
const APP_ORIGIN = 'https://main.d3qiuefonbp8n9.amplifyapp.com';

const isBrowser = typeof window !== 'undefined';

const isLocalhost = isBrowser && (
  window.location.hostname === 'localhost' ||
  window.location.hostname === '127.0.0.1'
);

const isAndroidApp = () => {
  if (!isBrowser) return false;

  const search = window.location.search || '';
  const userAgent = window.navigator.userAgent || '';

  return (
    search.includes('platform=android') ||
    Boolean(window.AndroidBridge) ||
    /;\s*wv\)/i.test(userAgent) ||
    /\bwv\b/i.test(userAgent)
  );
};

const getWebRedirectSignIn = () => (
  isLocalhost ? LOCAL_REDIRECT_SIGN_IN : WEB_REDIRECT_SIGN_IN
);

const getWebRedirectSignOut = () => (
  isLocalhost ? LOCAL_REDIRECT_SIGN_OUT : WEB_REDIRECT_SIGN_OUT
);

const saveCurrentRedirectPath = () => {
  if (!isBrowser) return;

  const currentPath = `${window.location.pathname || '/'}${window.location.search || ''}${window.location.hash || ''}`;

  if (currentPath && currentPath !== '/login' && currentPath !== '/register') {
    sessionStorage.setItem('smarty-post-login-redirect', currentPath);
    localStorage.setItem('smarty-post-login-redirect', currentPath);
  }
};

const redirectSignIn = getWebRedirectSignIn();
const redirectSignOut = getWebRedirectSignOut();

export const isAndroidCognitoLogin = isAndroidApp;

export const startAndroidGoogleLogin = () => {
  if (!COGNITO_DOMAIN || !COGNITO_CLIENT_ID) {
    throw new Error('Missing Cognito domain or client ID. Check VITE_COGNITO_DOMAIN and VITE_COGNITO_CLIENT_ID.');
  }

  saveCurrentRedirectPath();

  const query = new URLSearchParams({
    identity_provider: 'Google',
    redirect_uri: ANDROID_REDIRECT_URI,
    response_type: 'code',
    client_id: COGNITO_CLIENT_ID,
    scope: 'openid email profile',
    state: sessionStorage.getItem('smarty-post-login-redirect') || '/feed',
  });

  window.location.href = `https://${COGNITO_DOMAIN}/oauth2/authorize?${query.toString()}`;
};

export const exchangeAndroidCodeForTokens = async (code, options = {}) => {
  if (!COGNITO_DOMAIN || !COGNITO_CLIENT_ID) {
    throw new Error('Missing Cognito domain or client ID. Check VITE_COGNITO_DOMAIN and VITE_COGNITO_CLIENT_ID.');
  }

  if (!code) {
    throw new Error('Missing authorization code from Android callback.');
  }

  const redirectUri = options.redirectUri || ANDROID_REDIRECT_URI;

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: COGNITO_CLIENT_ID,
    code,
    redirect_uri: redirectUri,
  });

  console.log('Android Cognito token request:', {
    tokenUrl: `https://${COGNITO_DOMAIN}/oauth2/token`,
    clientId: COGNITO_CLIENT_ID,
    redirectUri,
    hasCode: Boolean(code),
  });

  const response = await fetch(`https://${COGNITO_DOMAIN}/oauth2/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });

  const responseText = await response.text();
  let data = {};

  try {
    data = responseText ? JSON.parse(responseText) : {};
  } catch {
    data = { raw: responseText };
  }

  if (!response.ok) {
    console.error('Android Cognito token exchange failed:', {
      status: response.status,
      statusText: response.statusText,
      data,
    });
    throw new Error(data?.error_description || data?.error || responseText || 'Android OAuth token exchange failed.');
  }

  console.log('Android Cognito token exchange succeeded:', {
    hasIdToken: Boolean(data.id_token),
    hasAccessToken: Boolean(data.access_token),
    hasRefreshToken: Boolean(data.refresh_token),
  });

  return data;
};

if (!COGNITO_DOMAIN || !COGNITO_CLIENT_ID || !COGNITO_USER_POOL_ID) {
  console.warn('Missing Cognito environment values. Check VITE_COGNITO_DOMAIN, VITE_COGNITO_CLIENT_ID, and VITE_COGNITO_USER_POOL_ID.');
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
          scopes: ['openid', 'email', 'profile'],
          redirectSignIn: [redirectSignIn, WEB_REDIRECT_SIGN_IN, ANDROID_REDIRECT_URI],
          redirectSignOut: [redirectSignOut, WEB_REDIRECT_SIGN_OUT, ANDROID_REDIRECT_URI],
          responseType: 'code',
        },
      },
    },
  },
});