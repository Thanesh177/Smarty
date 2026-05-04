import 'aws-amplify/auth/enable-oauth-listener';
import { Amplify } from 'aws-amplify';

const isAndroidApp = () => {
  const search = window.location.search || '';
  const userAgent = window.navigator.userAgent || '';

  return (
    search.includes('platform=android') ||
    userAgent.includes('wv') ||
    Boolean(window.AndroidBridge)
  );
};

const splitUrls = (value = '') => {
  const urls = value
    .split(',')
    .map((url) => url.trim())
    .filter(Boolean);

  const currentOrigin = window.location.origin;
  const appUrl = urls.find((url) => url.startsWith('smarty://'));

  // Android app must return ONLY the deep link, otherwise Amplify may choose the web URL.
  if (isAndroidApp() && appUrl) {
    return [appUrl];
  }

  const currentUrl = urls.find((url) => {
    if (!url.startsWith('http')) return false;

    try {
      return new URL(url).origin === currentOrigin;
    } catch {
      return false;
    }
  });

  return currentUrl ? [currentUrl] : urls;
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
          redirectSignIn: splitUrls(import.meta.env.VITE_REDIRECT_SIGN_IN),
          redirectSignOut: splitUrls(import.meta.env.VITE_REDIRECT_SIGN_OUT),
          responseType: 'code',
        },
      },
    },
  },
});