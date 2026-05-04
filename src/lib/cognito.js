import 'aws-amplify/auth/enable-oauth-listener';
import { Amplify } from 'aws-amplify';

const DEFAULT_REDIRECT_SIGN_IN =
  'http://localhost:5173/,https://main.d3qiuefonbp8n9.amplifyapp.com/,smarty://callback/';

const DEFAULT_REDIRECT_SIGN_OUT =
  'http://localhost:5173/login,https://main.d3qiuefonbp8n9.amplifyapp.com/login,smarty://signout/';

const isAndroidApp = () => {
  const search = window.location.search || '';
  const userAgent = window.navigator.userAgent || '';

  return (
    search.includes('platform=android') ||
    userAgent.includes('wv') ||
    Boolean(window.AndroidBridge)
  );
};

const pickRedirectUrl = (value = '', fallback = '') => {
  const urls = (value || fallback)
    .split(',')
    .map((url) => url.trim())
    .filter(Boolean);

  const currentOrigin = window.location.origin;
  const appUrl = urls.find((url) => url.startsWith('smarty://'));

  // Android app must use only the deep link so Cognito returns to the app.
  if (isAndroidApp() && appUrl) {
    return appUrl;
  }

  const currentUrl = urls.find((url) => {
    if (!url.startsWith('http')) return false;

    try {
      return new URL(url).origin === currentOrigin;
    } catch {
      return false;
    }
  });

  return currentUrl || urls[0] || fallback.split(',')[0];
};

Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID,
      userPoolClientId: import.meta.env.VITE_COGNITO_CLIENT_ID,
      loginWith: {
        email: true,
        oauth: {
          domain: (import.meta.env.VITE_COGNITO_DOMAIN || '').replace(/^https?:\/\//, ''),
          scopes: ['openid', 'email', 'profile'],
          redirectSignIn: pickRedirectUrl(
            import.meta.env.VITE_REDIRECT_SIGN_IN,
            DEFAULT_REDIRECT_SIGN_IN
          ),
          redirectSignOut: pickRedirectUrl(
            import.meta.env.VITE_REDIRECT_SIGN_OUT,
            DEFAULT_REDIRECT_SIGN_OUT
          ),
          responseType: 'code',
        },
      },
    },
  },
});