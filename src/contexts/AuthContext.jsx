import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  signIn,
  signUp,
  signOut,
  getCurrentUser,
  fetchAuthSession,
  confirmSignUp,
} from 'aws-amplify/auth';
import { Hub } from 'aws-amplify/utils';
import { exchangeAndroidCodeForTokens } from '../lib/cognito';

const AuthContext = createContext(null);

function decodeJwtPayload(token) {
  try {
    const payload = token.split('.')[1];
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(normalized));
  } catch {
    return {};
  }
}

function getSafeName(payload = {}, email = '') {
  const trimmedEmail = email ? String(email).split('@')[0] : '';
  return payload.name || payload.given_name || payload.preferred_username || trimmedEmail || 'User';
}

function getSafeUsername(currentUser, payload = {}, email = '') {
  const trimmedEmail = email ? String(email).split('@')[0] : '';
  const rawUsername =
    payload.preferred_username ||
    payload['cognito:username'] ||
    currentUser?.username ||
    trimmedEmail ||
    'user';

  return String(rawUsername)
    .replace(/^google[_-]/i, '')
    .replace(/[^a-zA-Z0-9._]/g, '')
    .slice(0, 24) || trimmedEmail || 'user';
}

function saveAuthUser(authUser) {
  if (!authUser) return;

  if (authUser.token) {
    localStorage.setItem('eduscroll_token', authUser.token);
  }

  if (authUser.accessToken) {
    localStorage.setItem('eduscroll_access_token', authUser.accessToken);
  }

  localStorage.setItem('eduscroll_user', JSON.stringify(authUser));
}

function clearAuthStorage() {
  localStorage.removeItem('eduscroll_token');
  localStorage.removeItem('eduscroll_user');
  localStorage.removeItem('eduscroll_access_token');
}

function clearAmplifyAuthStorage() {
  const prefixes = [
    'CognitoIdentityServiceProvider.',
    'aws-amplify-cache',
    'amplify-signin-with-hostedUI',
  ];

  Object.keys(localStorage).forEach((key) => {
    if (prefixes.some((prefix) => key.startsWith(prefix))) {
      localStorage.removeItem(key);
    }
  });

  Object.keys(sessionStorage).forEach((key) => {
    if (prefixes.some((prefix) => key.startsWith(prefix))) {
      sessionStorage.removeItem(key);
    }
  });
}

function isRunningInsideNativeApp() {
  return Boolean(
    window.AndroidBridge ||
      window.SmartyAndroid ||
      window.__SMARTY_NATIVE_APP__ === true ||
      window.__SMARTY_PLATFORM__ === 'ios' ||
      window.__SMARTY_IS_NATIVE_APP__ === true ||
      navigator.userAgent.includes('SmartyAndroid') ||
      navigator.userAgent.includes('Smarty-iOS')
  );
}

function getCognitoLogoutUrl() {
  const cognitoDomain = String(
    import.meta.env.VITE_COGNITO_DOMAIN || ''
  ).replace(/^https?:\/\//, '');

  const clientId = import.meta.env.VITE_COGNITO_CLIENT_ID;
  const logoutUri = `${window.location.origin}/login`;

  if (!cognitoDomain || !clientId) {
    return logoutUri;
  }

  const params = new URLSearchParams({
    client_id: clientId,
    logout_uri: logoutUri,
  });

  return `https://${cognitoDomain}/logout?${params.toString()}`;
}

function isRunningInsideAndroidApp() {
  return Boolean(window.AndroidBridge || window.SmartyAndroid || navigator.userAgent.includes('SmartyAndroid'));
}

function normalizeRedirectPath(value) {
  const fallback = '/feed';
  const text = String(value || '').trim();

  if (!text || text === '/login' || text === '/register') {
    return fallback;
  }

  if (text.startsWith('/')) {
    return text;
  }

  try {
    const url = new URL(text);
    return `${url.pathname}${url.search || ''}${url.hash || ''}` || fallback;
  } catch {
    return fallback;
  }
}

function getPostLoginRedirect() {
  const fallback = '/feed';

  try {
    const currentPath = `${window.location.pathname}${window.location.search || ''}${window.location.hash || ''}`;

    if (
      window.location.pathname.startsWith('/rooms/invite/') ||
      window.location.pathname.startsWith('/rooms/join/') ||
      window.location.pathname.startsWith('/room-invites/')
    ) {
      return currentPath;
    }

    const stored =
      sessionStorage.getItem('smarty-post-login-redirect') ||
      localStorage.getItem('smarty-post-login-redirect') ||
      fallback;

    sessionStorage.removeItem('smarty-post-login-redirect');
    localStorage.removeItem('smarty-post-login-redirect');

    return normalizeRedirectPath(stored);
  } catch {
    return fallback;
  }
}

function redirectAfterLogin() {
  const targetPath = getPostLoginRedirect();
  const currentPath = `${window.location.pathname}${window.location.search || ''}${window.location.hash || ''}`;

  if (currentPath === targetPath) {
    sessionStorage.removeItem('smarty-auth-redirecting');
    return;
  }

  if (sessionStorage.getItem('smarty-auth-redirecting') === targetPath) {
    return;
  }

  sessionStorage.setItem('smarty-auth-redirecting', targetPath);
  window.location.replace(targetPath);
}

function mapCognitoUser(currentUser, session) {
  const idTokenObject = session?.tokens?.idToken;
  const accessTokenObject = session?.tokens?.accessToken;

  const idToken = idTokenObject?.toString() ?? null;
  const accessToken = accessTokenObject?.toString() ?? null;

  const payload = idTokenObject?.payload || accessTokenObject?.payload || {};
  const sub = payload.sub || currentUser?.userId || null;
  const email =
    payload.email ||
    currentUser?.signInDetails?.loginId ||
    '';

  const username = getSafeUsername(currentUser, payload, email);
  const name = getSafeName(payload, email);

  return {
    id: sub,
    userId: sub,
    sub,
    username,
    email,
    name,
    token: idToken,
    accessToken,
  };
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      try {
        sessionStorage.removeItem('smarty-auth-redirecting');
        const params = new URLSearchParams(window.location.search);
        const androidCode = params.get('code');
        const hasOAuthState = params.has('state');
        const isAndroidReturn =
          params.get('platform') === 'android' ||
          params.get('redirect_uri')?.startsWith('smarty://callback') ||
          isRunningInsideAndroidApp();

        if (isAndroidReturn && androidCode && hasOAuthState) {
          try {
            console.log('Android OAuth callback detected. Exchanging code with Cognito...');

            const tokens = await exchangeAndroidCodeForTokens(androidCode, {
              redirectUri: 'smarty://callback',
            });
            const payload = decodeJwtPayload(tokens.id_token);

            const email = payload.email || '';
            const authUser = {
              id: payload.sub || null,
              userId: payload.sub || null,
              sub: payload.sub || null,
              username: getSafeUsername(null, payload, email),
              email,
              name: getSafeName(payload, email),
              token: tokens.id_token,
              accessToken: tokens.access_token,
            };

            saveAuthUser(authUser);

            const stateRedirect = normalizeRedirectPath(params.get('state'));
            const redirectPath = stateRedirect.startsWith('/login') ? '/feed' : stateRedirect;

            window.history.replaceState({}, document.title, redirectPath);
            setUser(authUser);
            setLoading(false);
            sessionStorage.removeItem('smarty-auth-redirecting');
            return;
          } catch (androidOAuthError) {
            console.error('Android OAuth token exchange failed:', androidOAuthError);
            clearAuthStorage();
            setUser(null);
            setLoading(false);
            return;
          }
        }

        const cachedToken = localStorage.getItem('eduscroll_token');
        const cachedUser = localStorage.getItem('eduscroll_user');

        if (cachedToken && cachedUser) {
          try {
            setUser(JSON.parse(cachedUser));
          } catch {
            clearAuthStorage();
          }
        }

        const currentUser = await getCurrentUser();
        const session = await fetchAuthSession();

        const authUser = mapCognitoUser(currentUser, session);

        saveAuthUser(authUser);
        setUser(authUser);
      } catch (err) {
        const message = err?.name || err?.message || '';

        const isUnauthenticated =
          String(message).includes('UserUnAuthenticatedException') ||
          String(message).includes('needs to be authenticated') ||
          String(message).includes('No current user');

        if (!isUnauthenticated) {
          console.error('Auth init failed:', err);
        }

        const cachedUser = localStorage.getItem('eduscroll_user');

        if (cachedUser) {
          try {
            setUser(JSON.parse(cachedUser));
          } catch {
            setUser(null);
          }
        } else {
          setUser(null);
        }
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, []);

  useEffect(() => {
    const unsubscribe = Hub.listen('auth', async ({ payload }) => {
      if (
        payload.event === 'signedIn' ||
        payload.event === 'signInWithRedirect' ||
        payload.event === 'cognitoHostedUI'
      ) {
        try {
          const currentUser = await getCurrentUser();
          const session = await fetchAuthSession();
          const authUser = mapCognitoUser(currentUser, session);

          saveAuthUser(authUser);
          setUser(authUser);
          redirectAfterLogin();
        } catch (err) {
          console.error('OAuth login failed:', err);
        }
      }
    });

    return () => unsubscribe();
  }, []);

  const login = async (email, password) => {
    const result = await signIn({
      username: email,
      password,
    });

    if (result.isSignedIn) {
      const currentUser = await getCurrentUser();
      const session = await fetchAuthSession();
      const authUser = mapCognitoUser(currentUser, session);

      saveAuthUser(authUser);
      setUser(authUser);

      return { success: true };
    }

    return {
      success: false,
      nextStep: result.nextStep,
    };
  };

  const register = async (name, email, password) => {
    const result = await signUp({
      username: email,
      password,
      options: {
        userAttributes: {
          email,
          name,
        },
      },
    });

    return {
      success: true,
      isSignUpComplete: result.isSignUpComplete,
      nextStep: result.nextStep,
    };
  };

  const confirmRegistration = async (email, code) => {
    const result = await confirmSignUp({
      username: email,
      confirmationCode: code,
    });

    return result;
  };

const logout = async () => {
  clearAuthStorage();
  clearAmplifyAuthStorage();
  setUser(null);

  if (isRunningInsideNativeApp()) {
    try {
      await signOut({ global: false });
    } catch (error) {
      console.warn('Native local sign-out failed:', error);
    }

    window.location.replace('/login');
    return;
  }

  window.location.assign(getCognitoLogoutUrl());
};

  const refreshToken = async () => {
    const session = await fetchAuthSession({ forceRefresh: true });
    const idToken = session?.tokens?.idToken?.toString() ?? null;
    const accessToken = session?.tokens?.accessToken?.toString() ?? null;

    if (idToken) {
      setUser((prev) => {
        const nextUser = prev ? { ...prev, token: idToken, accessToken } : prev;
        if (nextUser) saveAuthUser(nextUser);
        return nextUser;
      });
    }

    return idToken;
  };

  const value = useMemo(
    () => ({
      user,
      loading,
      login,
      register,
      confirmRegistration,
      logout,
      refreshToken,
      isAuthenticated: !!user,
    }),
    [user, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}