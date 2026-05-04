import { Amplify } from 'aws-amplify';

const isLocalhost = window.location.hostname === 'localhost';

const redirectSignIn = isLocalhost
  ? 'http://localhost:5173/'
  : 'https://main.d3qiuefonbp8n9.amplifyapp.com/';

const redirectSignOut = isLocalhost
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
          domain: import.meta.env.VITE_COGNITO_DOMAIN,
          scopes: ['email', 'openid', 'profile'],
          redirectSignIn: [redirectSignIn],
          redirectSignOut: [redirectSignOut],
          responseType: 'code',
        },
      },
    },
  },
});