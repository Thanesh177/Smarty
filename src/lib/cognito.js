import 'aws-amplify/auth/enable-oauth-listener';
import { Amplify } from 'aws-amplify';

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

const LOCAL_ORIGIN = 'http://localhost:5173';

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

const getWebRedirectSignIn = () => {
  const origin = getCurrentOrigin();

  if (origin === LOCAL_ORIGIN) {
    return `${LOCAL_ORIGIN}/`;
  }

  if (origin === LEGACY_AMPLIFY_ORIGIN) {
    return `${LEGACY_AMPLIFY_ORIGIN}/`;
  }

  return `${PRODUCTION_ORIGIN}/`;
};

const getWebRedirectSignOut = () => {
  const origin = getCurrentOrigin();

  if (origin === LOCAL_ORIGIN) {
    return `${LOCAL_ORIGIN}/login`;
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

export const startAndroidGoogleLogin = () => {
  if (!COGNITO_DOMAIN || !COGNITO_CLIENT_ID) {
    throw new Error(
      'Missing Cognito domain or client ID. ' +
      'Check VITE_COGNITO_DOMAIN and VITE_COGNITO_CLIENT_ID.'
    );
  }

  saveCurrentRedirectPath();

  const query = new URLSearchParams({
    identity_provider: 'Google',
    redirect_uri: NATIVE_REDIRECT_URI,
    response_type: 'code',
    client_id: COGNITO_CLIENT_ID,
    scope: 'openid email profile',
    state:
      sessionStorage.getItem(
        'smarty-post-login-redirect'
      ) || '/feed',
  });

  window.location.href =
    `https://${COGNITO_DOMAIN}` +
    `/oauth2/authorize?${query.toString()}`;
};

export const exchangeAndroidCodeForTokens = async (
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

  console.log('Native Cognito token request:', {
    tokenUrl:
      `https://${COGNITO_DOMAIN}/oauth2/token`,
    clientId: COGNITO_CLIENT_ID,
    redirectUri,
    hasCode: Boolean(code),
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
    console.error(
      'Native Cognito token exchange failed:',
      {
        status: response.status,
        statusText: response.statusText,
        data,
      }
    );

    throw new Error(
      data?.error_description ||
      data?.error ||
      responseText ||
      'Native OAuth token exchange failed.'
    );
  }

  console.log(
    'Native Cognito token exchange succeeded:',
    {
      hasIdToken: Boolean(data.id_token),
      hasAccessToken: Boolean(data.access_token),
      hasRefreshToken: Boolean(data.refresh_token),
    }
  );

  return data;
};

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