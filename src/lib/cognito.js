import 'aws-amplify/auth/enable-oauth-listener';
import { Amplify } from 'aws-amplify';

const splitUrls = (value = '') =>
  value
    .split(',')
    .map((url) => url.trim())
    .filter(Boolean);

Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID,
      userPoolClientId: import.meta.env.VITE_COGNITO_CLIENT_ID,
      loginWith: {
        email: true,
        oauth: {
          domain: import.meta.env.VITE_COGNITO_DOMAIN.replace(/^https?:\/\//, ''),
          scopes: ['openid', 'email', 'profile'],
          redirectSignIn: splitUrls(import.meta.env.VITE_REDIRECT_SIGN_IN),
          redirectSignOut: splitUrls(import.meta.env.VITE_REDIRECT_SIGN_OUT),
          responseType: 'code',
        },
      },
    },
  },
});