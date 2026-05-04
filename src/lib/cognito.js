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

  const currentUrl = urls.find((url) => {
    if (!url.startsWith('http')) return false;

    try {
      return new URL(url).origin === currentOrigin;
    } catch {
      return false;
    }
  });

  const ordered = [];

  // Android app must use smarty:// first so Cognito returns to the app.
  if (isAndroidApp() && appUrl) ordered.push(appUrl);

  // Web/local must use the URL matching the current origin.
  if (currentUrl) ordered.push(currentUrl);

  // Non-Android can keep app deep link as fallback.
  if (!isAndroidApp() && appUrl) ordered.push(appUrl);

  urls.forEach((url) => {
    if (!ordered.includes(url)) ordered.push(url);
  });

  return ordered;
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