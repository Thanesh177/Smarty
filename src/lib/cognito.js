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

const isLocalhost =
  window.location.hostname === 'localhost' ||
  window.location.hostname === '127.0.0.1';

const redirectSignIn = isAndroidApp()
  ? 'smarty://callback/'
  : isLocalhost
  ? 'http://localhost:5173/'
  : 'https://main.d3qiuefonbp8n9.amplifyapp.com/';

const redirectSignOut = isAndroidApp()
  ? 'smarty://signout/'
  : isLocalhost
  ? 'http://localhost:5173/login'
  : 'https://main.d3qiuefonbp8n9.amplifyapp.com/login';

export const isAndroidCognitoLogin = isAndroidApp;

export const startAndroidGoogleLogin = () => {
  const domain = (import.meta.env.VITE_COGNITO_DOMAIN || '').replace(/^https?:\/\//, '');
  const clientId = import.meta.env.VITE_COGNITO_CLIENT_ID;

  const query = new URLSearchParams({
    identity_provider: 'Google',
    redirect_uri: 'smarty://callback/',
    response_type: 'code',
    client_id: clientId,
    scope: 'openid email profile',
  });

  window.location.href = `https://${domain}/oauth2/authorize?${query.toString()}`;
};

console.log('COGNITO REDIRECT IN:', redirectSignIn);
console.log('COGNITO REDIRECT OUT:', redirectSignOut);

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
          redirectSignIn: [redirectSignIn],
          redirectSignOut: [redirectSignOut],
          responseType: 'code',
        },
      },
    },
  },
});