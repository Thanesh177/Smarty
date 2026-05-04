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

const hostname = window.location.hostname;
const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';

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

Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID,
      userPoolClientId: import.meta.env.VITE_COGNITO_CLIENT_ID,

      loginWith: {
        email: true,

        oauth: {
          domain: (import.meta.env.VITE_COGNITO_DOMAIN || '').replace(/^https?:\/\//, ''),
          scopes: ['email', 'openid', 'profile'],
          redirectSignIn: [redirectSignIn],
          redirectSignOut: [redirectSignOut],
          responseType: 'code',
        },
      },
    },
  },
});