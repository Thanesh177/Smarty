import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { fetchAuthSession } from 'aws-amplify/auth';

function getSavedRedirectPath() {
  const fallback = '/feed';

  try {
    const savedPath =
      sessionStorage.getItem('smarty-post-login-redirect') ||
      localStorage.getItem('smarty-post-login-redirect') ||
      fallback;

    sessionStorage.removeItem('smarty-post-login-redirect');
    localStorage.removeItem('smarty-post-login-redirect');

    if (!savedPath || savedPath === '/login' || savedPath === '/register') {
      return fallback;
    }

    return savedPath;
  } catch {
    return fallback;
  }
}

function isRoomInvitePath(pathname = '') {
  return pathname.startsWith('/rooms/join/') || pathname.startsWith('/rooms/invite/');
}

export default function AuthRedirectHandler() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(location.search);

    const hasOAuthCode = params.has('code') && params.has('state');

    if (isRoomInvitePath(location.pathname) && !hasOAuthCode) {
      return;
    }

    if (!hasOAuthCode) return;

    const finishLogin = async () => {
      try {
        await fetchAuthSession({ forceRefresh: true });

        if (isRoomInvitePath(location.pathname)) {
          navigate(location.pathname, { replace: true });
          return;
        }

        navigate(getSavedRedirectPath(), { replace: true });
      } catch (error) {
        console.error('OAuth redirect handling failed:', error);
        const currentPath = `${location.pathname}${location.search || ''}`;

        if (currentPath && currentPath !== '/login') {
          sessionStorage.setItem('smarty-post-login-redirect', currentPath);
          localStorage.setItem('smarty-post-login-redirect', currentPath);
        }

        navigate('/login', { replace: true, state: { from: currentPath } });
      }
    };

    finishLogin();
  }, [location.pathname, location.search, navigate]);

  return null;
}