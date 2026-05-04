import { Amplify } from 'aws-amplify';

const hostname = window.location.hostname;

const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
const isAndroidWebView = window.navigator.userAgent.includes('wv');

const redirectSignIn = isAndroidWebView
  ? 'smarty://callback/'
  : isLocalhost
  ? 'http://localhost:5173/'
  : 'https://main.d3qiuefonbp8n9.amplifyapp.com/';

const redirectSignOut = isAndroidWebView
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