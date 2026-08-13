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

const isBrowser = typeof window !== 'undefined';

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

const getWebRedirectSignIn = () => {
  const origin = getCurrentOrigin();

  if (isLocalDevelopmentOrigin(origin)) {
    return `${origin}/`;
  }

  if (origin === LEGACY_AMPLIFY_ORIGIN) {
    return `${LEGACY_AMPLIFY_ORIGIN}/`;
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
    currentPath !== '/login' &&
    currentPath !== '/register'
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

export const startNativeSocialLogin = (
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
  const stateBytes = new Uint8Array(24);
  crypto.getRandomValues(stateBytes);
  const oauthState = Array.from(
    stateBytes,
    (byte) => byte.toString(16).padStart(2, '0')
  ).join('');

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
  });

  window.location.href =
    `https://${COGNITO_DOMAIN}` +
    `/oauth2/authorize?${query.toString()}`;
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
    startNativeSocialLogin(
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

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: COGNITO_CLIENT_ID,
    code,
    redirect_uri: redirectUri,
  });

  const response = await fetch(
    `https://${COGNITO_DOMAIN}/oauth2/token`,
    {
      method: 'POST',
      headers: {
        'Content-Type':
          'application/x-www-form-urlencoded',
      },
      body,
    }
  );

  const responseText = await response.text();
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
      data?.error_description ||
      data?.error ||
      responseText ||
      'Native OAuth token exchange failed.'
    );
  }

  return data;
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
