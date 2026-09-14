import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  signIn,
  signUp,
  signOut,
  getCurrentUser,
  fetchAuthSession,
  confirmSignIn,
  confirmSignUp,
  resendSignUpCode,
  resetPassword,
  confirmResetPassword,
} from 'aws-amplify/auth';
import { Hub } from 'aws-amplify/utils';
import {
  clearNativeRefreshSession,
  exchangeNativeCodeForTokens,
  hasNativeRefreshSession,
  persistNativeRefreshSession,
  refreshNativeSession,
} from '../lib/cognito';
import { removeLegacyAccountCacheKeys } from '../lib/userScopedStorage';
import { normalizeGroups } from '../lib/adminAccess';

const AuthContext = createContext(null);

function decodeJwtPayload(token) {
  try {
    const payload = token.split('.')[1];
    const normalized = payload
      .replace(/-/g, '+')
      .replace(/_/g, '/')
      .padEnd(Math.ceil(payload.length / 4) * 4, '=');
    return JSON.parse(atob(normalized));
  } catch {
    return {};
  }
}

function normalizeIdentity(value) {
  return String(value || '').trim();
}

function isCurrentJwt(token, expectedSubject = '') {
  if (!token) return false;

  const payload = decodeJwtPayload(token);
  const subject = normalizeIdentity(payload.sub);
  const expected = normalizeIdentity(expectedSubject);
  const expiresAt = Number(payload.exp || 0) * 1000;

  if (!subject || !expiresAt || expiresAt <= Date.now() + 30_000) {
    return false;
  }

  return !expected || subject === expected;
}

function notifyAuthChanged() {
  window.dispatchEvent(new CustomEvent('smarty:auth-changed'));
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

  const subject = normalizeIdentity(authUser.userId || authUser.sub || authUser.id);

  if (!subject || !isCurrentJwt(authUser.token, subject)) {
    throw new Error('Refusing to persist an unverified authentication session.');
  }

  try {
    const previousUser = JSON.parse(localStorage.getItem('eduscroll_user') || 'null');
    const previousSubject = normalizeIdentity(
      previousUser?.userId || previousUser?.sub || previousUser?.id
    );

    if (previousSubject && previousSubject !== subject) {
      removeLegacyAccountCacheKeys();
    }
  } catch {
    removeLegacyAccountCacheKeys();
  }

  if (authUser.token) {
    localStorage.setItem('eduscroll_token', authUser.token);
  }

  if (authUser.accessToken) {
    localStorage.setItem('eduscroll_access_token', authUser.accessToken);
  }

  localStorage.setItem('eduscroll_user', JSON.stringify(authUser));
  notifyAuthChanged();
}

function clearAuthStorage() {
  clearNativeRefreshSession();
  localStorage.removeItem('eduscroll_token');
  localStorage.removeItem('eduscroll_user');
  localStorage.removeItem('eduscroll_access_token');
  localStorage.removeItem('accessToken');
  localStorage.removeItem('idToken');
  sessionStorage.removeItem('eduscroll_access_token');
  sessionStorage.removeItem('accessToken');
  sessionStorage.removeItem('idToken');
  removeLegacyAccountCacheKeys();
  notifyAuthChanged();
}

function pendingNativeState() {
  return sessionStorage.getItem('smarty-native-oauth-state') ||
    localStorage.getItem('smarty-native-oauth-state') || '';
}

function staleAuthOperation() {
  const error = new Error('A newer sign-in operation has replaced this attempt.');
  error.name = 'StaleAuthOperation';
  return error;
}

function clearNativeOAuthStorage(expectedState) {
  if (expectedState && pendingNativeState() !== expectedState) return;
  [
    'smarty-native-oauth-state',
    'smarty-native-oauth-provider',
    'smarty-native-oauth-nonce',
    'smarty-native-oauth-code-verifier',
  ].forEach((key) => {
    sessionStorage.removeItem(key);
    localStorage.removeItem(key);
  });
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

function mapCognitoUser(currentUser, session) {
  const idTokenObject = session?.tokens?.idToken;
  const accessTokenObject = session?.tokens?.accessToken;

  const idToken = idTokenObject?.toString() ?? null;
  const accessToken = accessTokenObject?.toString() ?? null;

  const payload = idTokenObject?.payload || accessTokenObject?.payload || {};
  const sub = payload.sub || currentUser?.userId || null;
  const currentUserId = normalizeIdentity(currentUser?.userId);
  const sessionSubject = normalizeIdentity(sub);

  if (
    !sessionSubject ||
    (currentUserId && currentUserId !== sessionSubject) ||
    !isCurrentJwt(idToken || accessToken, sessionSubject)
  ) {
    throw new Error('Cognito session identity could not be verified.');
  }

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
    groups: normalizeGroups(payload['cognito:groups']),
    token: idToken,
    accessToken,
  };
}

function getVerifiedNativeCachedUser() {
  const cachedUser = getNativeCachedIdentity();
  if (!cachedUser || !isCurrentJwt(cachedUser.token, cachedUser.sub)) {
    return null;
  }

  return cachedUser;
}

function getNativeCachedIdentity() {
  if (!isRunningInsideNativeApp()) return null;

  try {
    const cachedUser = JSON.parse(localStorage.getItem('eduscroll_user') || 'null');
    const subject = normalizeIdentity(
      cachedUser?.userId || cachedUser?.sub || cachedUser?.id
    );
    const token = cachedUser?.token || localStorage.getItem('eduscroll_token') || '';
    const tokenSubject = normalizeIdentity(decodeJwtPayload(token).sub);

    if (!cachedUser || !subject || tokenSubject !== subject) {
      return null;
    }

    return {
      ...cachedUser,
      id: subject,
      userId: subject,
      sub: subject,
      token,
    };
  } catch {
    return null;
  }
}

function mapNativeTokens(tokens, cachedUser = null) {
  const idToken = String(tokens?.id_token || '');
  const accessToken = String(tokens?.access_token || '');
  const payload = decodeJwtPayload(idToken || accessToken);
  const subject = normalizeIdentity(payload.sub);
  const cachedSubject = normalizeIdentity(
    cachedUser?.userId || cachedUser?.sub || cachedUser?.id
  );

  if (
    !subject ||
    (cachedSubject && cachedSubject !== subject) ||
    !isCurrentJwt(idToken || accessToken, subject)
  ) {
    throw new Error('The restored session identity could not be verified.');
  }

  const email = payload.email || cachedUser?.email || '';
  const name =
    payload.name ||
    payload.given_name ||
    payload.preferred_username ||
    cachedUser?.name ||
    getSafeName(payload, email);
  const groups = payload['cognito:groups'] === undefined
    ? cachedUser?.groups
    : payload['cognito:groups'];

  return {
    id: subject,
    userId: subject,
    sub: subject,
    username: getSafeUsername(cachedUser, payload, email),
    email,
    name,
    groups: normalizeGroups(groups),
    token: idToken || accessToken,
    accessToken,
  };
}

async function waitForCognitoSession(attempts = 1, forceRefresh = false) {
  let lastError;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const currentUser = await getCurrentUser();
      const session = await fetchAuthSession({ forceRefresh });
      return { currentUser, session };
    } catch (error) {
      lastError = error;

      if (attempt < attempts - 1) {
        await new Promise((resolve) => window.setTimeout(resolve, 220));
      }
    }
  }

  throw lastError || new Error('Authentication session was not available.');
}

async function withAuthDeadline(operation, message = 'Session restoration took too long. Please sign in again.') {
  let timer;
  try {
    return await Promise.race([
      operation,
      new Promise((_, reject) => {
        timer = window.setTimeout(() => reject(new Error(message)), 15000);
      }),
    ]);
  } finally {
    window.clearTimeout(timer);
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);
  const [authError, setAuthError] = useState('');
  const authBootStartedRef = useRef(false);
  const sessionRestorePromiseRef = useRef(null);
  const nativeCompletionRef = useRef(null);
  const sessionRevisionRef = useRef(0);
  const loggingOutRef = useRef(false);

  const invalidatePendingSession = useCallback(() => {
    sessionRevisionRef.current += 1;
    sessionRestorePromiseRef.current = null;
  }, []);

  const completeNativeLogin = useCallback((params) => {
    const state = params.get('state') || '';
    // The system browser and onOpenURL may deliver the same callback. Keep
    // the settled promise too: an authorization code must never be reused.
    if (state && nativeCompletionRef.current?.state === state) {
      return nativeCompletionRef.current.promise;
    }

    // Validate before changing ownership. An old callback must not invalidate
    // a newer attempt or erase its PKCE material.
    if (!state || state !== pendingNativeState()) return Promise.reject(staleAuthOperation());
    invalidatePendingSession();
    const revision = sessionRevisionRef.current;
    setAuthError('');
    const promise = (async () => {
      const expectedState = pendingNativeState();
      const expectedNonce = sessionStorage.getItem('smarty-native-oauth-nonce') ||
        localStorage.getItem('smarty-native-oauth-nonce') || '';
      if (!state || !expectedState || state !== expectedState) {
        throw new Error('The sign-in response could not be verified. Please start sign-in again.');
      }
      if (params.has('error')) {
        throw new Error(params.get('error') === 'access_denied'
          ? 'Sign-in was cancelled.'
          : 'Google or Apple could not finish sign-in. Please try again.');
      }

      const tokens = await exchangeNativeCodeForTokens(params.get('code'), {
        redirectUri: 'smarty://callback',
      });
      if (revision !== sessionRevisionRef.current || pendingNativeState() !== state) {
        throw staleAuthOperation();
      }
      const payload = decodeJwtPayload(tokens.id_token);
      const subject = normalizeIdentity(payload.sub);
      if (!subject || !isCurrentJwt(tokens.id_token, subject) ||
          !expectedNonce || payload.nonce !== expectedNonce) {
        throw new Error('The sign-in response could not be verified. Please start sign-in again.');
      }

      const email = payload.email || '';
      const authUser = {
        id: subject, userId: subject, sub: subject,
        username: getSafeUsername(null, payload, email),
        email, name: getSafeName(payload, email),
        groups: normalizeGroups(payload['cognito:groups']),
        token: tokens.id_token, accessToken: tokens.access_token,
      };
      if (!persistNativeRefreshSession(tokens, subject)) {
        throw new Error('A lasting sign-in session could not be created. Please try again.');
      }
      saveAuthUser(authUser);
      clearNativeOAuthStorage(state);
      setUser(authUser);
      setLoading(false);
      return authUser;
    })();
    nativeCompletionRef.current = { state, promise };
    return promise;
  }, [invalidatePendingSession]);

  useEffect(() => {
    // Acknowledge receipt synchronously so native code never reloads the page
    // while the exchange is running. Deliver only from the trusted WKWebView.
    const handleCallback = (callbackUrl) => {
      if (!isRunningInsideNativeApp()) return false;
      let callback;
      try { callback = new URL(callbackUrl); } catch { return false; }
      if (callback.protocol !== 'smarty:' || callback.hostname !== 'callback') return false;
      const state = callback.searchParams.get('state') || '';
      // Acknowledge stale deliveries so the native wrapper does not reload
      // the page and accidentally restart a consumed authorization code.
      if (!state || (state !== pendingNativeState() && nativeCompletionRef.current?.state !== state)) return true;
      const wasCancelled = callback.searchParams.get('error') === 'access_denied';
      completeNativeLogin(callback.searchParams).catch((error) => {
        if (error.name === 'StaleAuthOperation' || pendingNativeState() !== state) return;
        clearNativeOAuthStorage(state);
        setLoading(false);
        setAuthError(wasCancelled ? '' : error.message);
        window.dispatchEvent(new CustomEvent('smarty:native-auth-status', {
          detail: {
            status: wasCancelled ? 'cancelled' : 'failed',
            state,
            message: wasCancelled ? '' : error.message,
          },
        }));
      });
      return true;
    };
    const handleStarted = () => {
      invalidatePendingSession();
      setAuthError('');
      setUser(null);
      clearAuthStorage();
      setLoading(false);
    };
    window.__SMARTY_COMPLETE_NATIVE_OAUTH__ = handleCallback;
    window.addEventListener('smarty:native-auth-started', handleStarted);
    return () => {
      window.removeEventListener('smarty:native-auth-started', handleStarted);
      if (window.__SMARTY_COMPLETE_NATIVE_OAUTH__ === handleCallback) {
        delete window.__SMARTY_COMPLETE_NATIVE_OAUTH__;
      }
    };
  }, [completeNativeLogin, invalidatePendingSession]);

  const establishSession = useCallback(async ({
    attempts = 1,
    forceRefresh = false,
  } = {}) => {
    const nativeUser = getVerifiedNativeCachedUser();
    if (nativeUser && !forceRefresh) {
      setUser(nativeUser);
      setLoading(false);
      return nativeUser;
    }
    if (isRunningInsideNativeApp() && pendingNativeState()) throw staleAuthOperation();
    if (!forceRefresh && sessionRestorePromiseRef.current) {
      return sessionRestorePromiseRef.current;
    }

    const revision = sessionRevisionRef.current;
    const restorePromise = (async () => {
      const cachedNativeIdentity = getNativeCachedIdentity();
      if (
        cachedNativeIdentity &&
        hasNativeRefreshSession(cachedNativeIdentity.sub)
      ) {
        const nativeTokens = await withAuthDeadline(
          refreshNativeSession(),
          'Session restoration took too long. Check your connection and try again.'
        );
        if (revision !== sessionRevisionRef.current) throw staleAuthOperation();
        if (!nativeTokens) {
          throw new Error('The saved native session was not available.');
        }

        const authUser = mapNativeTokens(nativeTokens, cachedNativeIdentity);
        saveAuthUser(authUser);
        setUser(authUser);
        setAuthError('');
        setLoading(false);
        return authUser;
      }

      const { currentUser, session } = await withAuthDeadline(waitForCognitoSession(attempts, forceRefresh));
      if (revision !== sessionRevisionRef.current) throw staleAuthOperation();
      const authUser = mapCognitoUser(currentUser, session);

      saveAuthUser(authUser);
      setUser(authUser);
      setAuthError('');
      setLoading(false);

      return authUser;
    })();

    if (!forceRefresh) {
      sessionRestorePromiseRef.current = restorePromise;
    }

    try {
      return await restorePromise;
    } finally {
      if (sessionRestorePromiseRef.current === restorePromise) {
        sessionRestorePromiseRef.current = null;
      }
    }
  }, []);

  useEffect(() => {
    // React StrictMode intentionally re-runs effects in development. An OAuth
    // authorization code is single-use, so the callback must only be exchanged
    // once for the lifetime of this provider instance.
    if (authBootStartedRef.current) return;
    authBootStartedRef.current = true;

    const initAuth = async () => {
      const bootRevision = sessionRevisionRef.current;
      try {
        sessionStorage.removeItem('smarty-auth-redirecting');
        const params = new URLSearchParams(window.location.search);
        const nativeCode = params.get('code');
        const hasOAuthState = params.has('state');
        const isNativeReturn =
          params.get('platform') === 'android' ||
          params.get('platform') === 'ios' ||
          params.get('native_oauth') === 'android' ||
          params.get('native_oauth') === 'ios' ||
          params.get('redirect_uri')?.startsWith('smarty://callback') ||
          isRunningInsideNativeApp();
        const isWebOAuthReturn = Boolean(
          !isNativeReturn && nativeCode && hasOAuthState
        );
        const nativeProviderError = params.get('error');
        const nativeProvider =
          sessionStorage.getItem('smarty-native-oauth-provider') ||
          localStorage.getItem('smarty-native-oauth-provider') ||
          'social';

        if (isNativeReturn && (nativeCode || nativeProviderError) && hasOAuthState) {
          try {
            await completeNativeLogin(params);
            sessionStorage.removeItem('smarty-auth-redirecting');
            return;
          } catch (nativeOAuthError) {
            if (nativeOAuthError.name === 'StaleAuthOperation' || pendingNativeState() !== params.get('state')) return;
            console.error('Native OAuth token exchange failed:', nativeOAuthError);
            clearAuthStorage();
            setUser(null);
            setLoading(false);
            clearNativeOAuthStorage(params.get('state'));
            window.location.replace(
              `/login?oauth_error=${encodeURIComponent(nativeProvider)}`
            );
            return;
          }
        }

        await establishSession({ attempts: isWebOAuthReturn ? 14 : 1 });
      } catch (err) {
        if (bootRevision !== sessionRevisionRef.current || err.name === 'StaleAuthOperation') return;
        const message = err?.name || err?.message || '';

        const isUnauthenticated =
          String(message).includes('UserUnAuthenticatedException') ||
          String(message).includes('needs to be authenticated') ||
          String(message).includes('No current user');

        if (!isUnauthenticated) {
          console.error('Auth init failed:', err);
          setAuthError('Your session could not be restored. Please sign in again.');
        }

        const nativeCachedUser = getNativeCachedIdentity();
        const canRetryNativeSession = Boolean(
          nativeCachedUser &&
          hasNativeRefreshSession(nativeCachedUser.sub) &&
          !err?.invalidSession
        );

        if (canRetryNativeSession) {
          setUser(nativeCachedUser);
          setAuthError('');
        } else {
          clearAuthStorage();
          setUser(null);
        }
      } finally {
        if (bootRevision === sessionRevisionRef.current) setLoading(false);
      }
    };

    initAuth();
  }, [completeNativeLogin, establishSession]);

  useEffect(() => {
    const unsubscribe = Hub.listen('auth', async ({ payload }) => {
      if (loggingOutRef.current && payload.event !== 'signedOut') return;
      if (
        payload.event === 'signedIn' ||
        payload.event === 'signInWithRedirect' ||
        payload.event === 'cognitoHostedUI'
      ) {
        try {
          await establishSession({ attempts: 8 });
        } catch (err) {
          if (err.name === 'StaleAuthOperation') return;
          console.error('OAuth login failed:', err);
          setAuthError('Sign-in could not be completed. Please try again.');
          setLoading(false);
        }
      }

      if (payload.event === 'signInWithRedirect_failure') {
        const cachedNativeUser = getNativeCachedIdentity();
        if (
          isRunningInsideNativeApp() &&
          (
            pendingNativeState() ||
            getVerifiedNativeCachedUser() ||
            (cachedNativeUser && hasNativeRefreshSession(cachedNativeUser.sub))
          )
        ) return;
        invalidatePendingSession();
        setAuthError('Connected sign-in could not be completed. Please try again.');
        setLoading(false);
      }

      if (payload.event === 'signedOut') {
        invalidatePendingSession();
        clearAuthStorage();
        setUser(null);
      }
    });

    return () => unsubscribe();
  }, [establishSession, invalidatePendingSession]);

  const login = async (email, password) => {
    invalidatePendingSession();
    clearNativeOAuthStorage();
    setAuthError('');
    try {
      await withAuthDeadline(getCurrentUser());
      await withAuthDeadline(signOut({ global: false }));
    } catch {
      // No existing Cognito session.
    }

    clearAuthStorage();

    const result = await withAuthDeadline(signIn({
      username: email,
      password,
    }), 'Sign-in took too long. Check your connection and try again.');

    if (result.isSignedIn) {
      const authUser = await establishSession({ attempts: 3 });

      return { success: true, user: authUser };
    }

    return {
      success: false,
      nextStep: result.nextStep,
    };
  };

  const confirmLogin = async (challengeResponse) => {
    const response = String(challengeResponse || '').trim();

    if (!response) {
      throw new Error('Enter the requested verification value.');
    }

    const result = await withAuthDeadline(confirmSignIn({ challengeResponse: response }), 'Verification took too long. Please try again.');

    if (result.isSignedIn) {
      const authUser = await establishSession({ attempts: 3 });
      return { success: true, user: authUser };
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

  const resendRegistrationCode = async (email) => {
    return resendSignUpCode({ username: String(email || '').trim().toLowerCase() });
  };

  const beginPasswordReset = async (email) => {
    return resetPassword({ username: String(email || '').trim().toLowerCase() });
  };

  const finishPasswordReset = async (email, code, newPassword) => {
    await confirmResetPassword({
      username: String(email || '').trim().toLowerCase(),
      confirmationCode: String(code || '').trim(),
      newPassword,
    });

    return { success: true };
  };

  const restoreSession = useCallback(
    async ({ forceRefresh = false, attempts = 4 } = {}) => {
      try {
        return await establishSession({ attempts, forceRefresh });
      } catch (error) {
        const cachedUser = getNativeCachedIdentity();

        if (
          cachedUser &&
          hasNativeRefreshSession(cachedUser.sub) &&
          !error?.invalidSession
        ) {
          setUser(cachedUser);
          return cachedUser;
        }

        throw error;
      }
    },
    [establishSession]
  );

  const logout = async () => {
    if (loggingOutRef.current) return;
    loggingOutRef.current = true;

    setLoggingOut(true);
    invalidatePendingSession();
    nativeCompletionRef.current = null;
    setUser(null);
    clearAuthStorage();

    sessionStorage.removeItem('smarty-auth-redirecting');
    sessionStorage.removeItem('smarty-post-login-redirect');
    localStorage.removeItem('smarty-post-login-redirect');
    clearNativeOAuthStorage();

    try {
      // Amplify must see its own session records before they are cleared so it
      // can revoke the local Cognito session and federated hosted-UI session.
      await withAuthDeadline(signOut({ global: false }));
    } catch (error) {
      console.warn('Cognito sign-out failed; using hosted logout fallback.', error);
    } finally {
      clearAuthStorage();
      clearAmplifyAuthStorage();
    }

    const logoutTarget = isRunningInsideNativeApp()
      ? '/login?loggedOut=1'
      : getCognitoLogoutUrl();

    window.location.replace(logoutTarget);
  };

  const refreshToken = async () => {
    const authUser = await restoreSession({ forceRefresh: true, attempts: 3 });
    return authUser?.token || null;
  };

  const value = useMemo(
    () => ({
      user,
      loading,
      authError,
      login,
      confirmLogin,
      register,
      confirmRegistration,
      resendRegistrationCode,
      beginPasswordReset,
      finishPasswordReset,
      restoreSession,
      logout,
      loggingOut,
      refreshToken,
      isAuthenticated: !!user,
    }),
    [user, loading, loggingOut, authError, restoreSession]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
