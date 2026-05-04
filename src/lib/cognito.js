import 'aws-amplify/auth/enable-oauth-listener';
import { Amplify } from 'aws-amplify';

const splitUrls = (value = '') => {
  const urls = value
    .split(',')
    .map((url) => url.trim())
    .filter(Boolean);

  const currentOrigin = window.location.origin;

  // ✅ pick URL matching current environment (localhost / amplify)
  const currentUrl = urls.find((url) => {
    if (url.startsWith('http')) {
      try {
        return new URL(url).origin === currentOrigin;
      } catch {
        return false;
      }
    }
    return false;
  });

  // Android deep link fallback
  const appUrl = urls.find((url) => url.startsWith('smarty://'));

  const ordered = [];

  if (currentUrl) ordered.push(currentUrl);
  if (appUrl) ordered.push(appUrl);

  // add remaining urls (avoid duplicates)
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