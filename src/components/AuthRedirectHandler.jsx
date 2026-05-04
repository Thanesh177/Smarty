import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { fetchAuthSession } from 'aws-amplify/auth';

export default function AuthRedirectHandler() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(location.search);

    const hasOAuthCode = params.has('code') && params.has('state');

    if (!hasOAuthCode) return;

    const finishLogin = async () => {
      try {
        await fetchAuthSession({ forceRefresh: true });
        navigate('/feed', { replace: true });
      } catch (error) {
        console.error('OAuth redirect handling failed:', error);
        navigate('/login', { replace: true });
      }
    };

    finishLogin();
  }, [location.search, navigate]);

  return null;
}