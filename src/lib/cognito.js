import 'aws-amplify/auth/enable-oauth-listener';
import { Amplify } from 'aws-amplify';

const splitUrls = (value = '') => {
  const urls = value
    .split(',')
    .map((url) => url.trim())
    .filter(Boolean);

  // 🔥 Ensure web URL comes first (important for Amplify redirect handling)
  const webUrl = urls.find((u) => u.startsWith('http'));
  const appUrl = urls.find((u) => u.startsWith('smarty://'));

  const ordered = [];
  if (webUrl) ordered.push(webUrl);
  if (appUrl) ordered.push(appUrl);

  return ordered.length ? ordered : urls;
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