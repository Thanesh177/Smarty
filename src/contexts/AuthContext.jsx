import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  signIn,
  signUp,
  signOut,
  getCurrentUser,
  fetchAuthSession,
  confirmSignUp,
} from 'aws-amplify/auth';
import '../lib/cognito';

const AuthContext = createContext(null);

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
        const currentUser = await getCurrentUser();
        const session = await fetchAuthSession();

        const authUser = mapCognitoUser(currentUser, session);

        if (authUser.token) {
          localStorage.setItem('eduscroll_token', authUser.token);
        }
        localStorage.setItem('eduscroll_user', JSON.stringify(authUser));
        setUser(authUser);
      } catch {
        localStorage.removeItem('eduscroll_token');
        localStorage.removeItem('eduscroll_user');
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    initAuth();
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
    setUser(null);
  };

  const refreshToken = async () => {
    const session = await fetchAuthSession({ forceRefresh: true });
    const idToken = session?.tokens?.idToken?.toString() ?? null;

    if (idToken) {
      localStorage.setItem('eduscroll_token', idToken);
      setUser((prev) => (prev ? { ...prev, token: idToken } : prev));
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