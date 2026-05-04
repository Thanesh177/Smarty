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

console.log('AuthContext loaded');

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

function mapCognitoUser(currentUser, session) {
  const idTokenObject = session?.tokens?.idToken;
  const accessTokenObject = session?.tokens?.accessToken;

  const idToken = idTokenObject?.toString() ?? null;
  const accessToken = accessTokenObject?.toString() ?? null;

  const payload = idTokenObject?.payload || {};
  const sub = payload.sub || currentUser?.userId || null;
  const email =
    payload.email ||
    currentUser?.signInDetails?.loginId ||
    currentUser?.username ||
    null;

  return {
    id: sub,
    userId: sub,
    sub,
    username: currentUser?.username || email,
    email,
    name: payload.name || email,
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

          const authUser = {
            id: payload.sub || null,
            userId: payload.sub || null,
            sub: payload.sub || null,
            username: payload.email || payload['cognito:username'] || null,
            email: payload.email || null,
            name: payload.name || payload.email || 'User',
            token: tokens.id_token,
            accessToken: tokens.access_token,
          };

          localStorage.setItem('eduscroll_token', tokens.id_token);
          localStorage.setItem('eduscroll_access_token', tokens.access_token);
          localStorage.setItem('eduscroll_user', JSON.stringify(authUser));
          setUser(authUser);
          setLoading(false);
          window.location.replace('/feed');
          return;
        }

        const cachedToken = localStorage.getItem('eduscroll_token');
const cachedUser = localStorage.getItem('eduscroll_user');

if (cachedToken && cachedUser) {
  setUser(JSON.parse(cachedUser));
  setLoading(false);
  return;
}

        const currentUser = await getCurrentUser();
        const session = await fetchAuthSession();
        console.log('Session loaded:', session);

        const authUser = mapCognitoUser(currentUser, session);

        if (authUser.token) {
          localStorage.setItem('eduscroll_token', authUser.token);
        }
        if (authUser.accessToken) {
          localStorage.setItem('eduscroll_access_token', authUser.accessToken);
        }
        localStorage.setItem('eduscroll_user', JSON.stringify(authUser));
        setUser(authUser);
      } catch (err) {
        console.error('Auth init failed:', err);
        localStorage.removeItem('eduscroll_token');
        localStorage.removeItem('eduscroll_user');
        localStorage.removeItem('eduscroll_access_token');
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

          if (authUser.token) {
            localStorage.setItem('eduscroll_token', authUser.token);
          }
          if (authUser.accessToken) {
            localStorage.setItem('eduscroll_access_token', authUser.accessToken);
          }

          localStorage.setItem('eduscroll_user', JSON.stringify(authUser));
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

    if (authUser.token) {
      localStorage.setItem('eduscroll_token', authUser.token);
    }
    if (authUser.accessToken) {
      localStorage.setItem('eduscroll_access_token', authUser.accessToken);
    }
    localStorage.setItem('eduscroll_user', JSON.stringify(authUser));
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
    localStorage.removeItem('eduscroll_token');
    localStorage.removeItem('eduscroll_user');
    localStorage.removeItem('eduscroll_access_token');
    setUser(null);
  };

  const refreshToken = async () => {
    const session = await fetchAuthSession({ forceRefresh: true });
    const idToken = session?.tokens?.idToken?.toString() ?? null;
    const accessToken = session?.tokens?.accessToken?.toString() ?? null;

    if (idToken) {
      localStorage.setItem('eduscroll_token', idToken);
      if (accessToken) {
        localStorage.setItem('eduscroll_access_token', accessToken);
      }
      setUser((prev) => (prev ? { ...prev, token: idToken, accessToken } : prev));
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