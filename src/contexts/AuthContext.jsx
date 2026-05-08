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
        const params = new URLSearchParams(window.location.search);
        const androidCode = params.get('code');
        const isAndroidReturn = params.get('platform') === 'android';
console.log('AUTH URL:', window.location.href);

console.log('ANDROID CODE:', androidCode)
        if (isAndroidReturn && androidCode) {
          const tokens = await exchangeAndroidCodeForTokens(androidCode);
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
          setUser(authUser);
          setLoading(false);
          window.location.replace('/feed');
          return;
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
        console.log('Session loaded:', session);

        const authUser = mapCognitoUser(currentUser, session);

        saveAuthUser(authUser);
        setUser(authUser);
} catch (err) {
  const message =
    err?.name ||
    err?.message ||
    '';

  const isUnauthenticated =
    String(message).includes('UserUnAuthenticatedException') ||
    String(message).includes('needs to be authenticated') ||
    String(message).includes('No current user');

  if (!isUnauthenticated) {
    console.error('Auth init failed:', err);
  }

  clearAuthStorage();
  setUser(null);
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
          console.log('Auth event:', payload.event);
          const currentUser = await getCurrentUser();
          const session = await fetchAuthSession();
          const authUser = mapCognitoUser(currentUser, session);

          saveAuthUser(authUser);
          setUser(authUser);
          window.location.replace('/feed');
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
    await signOut();
    clearAuthStorage();
    setUser(null);
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