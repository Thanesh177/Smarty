import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

export default function AuthRedirectHandler() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const hasOAuthError = params.has('error') || params.has('error_description');

    if (hasOAuthError) {
      const errorMessage = params.get('error_description') || params.get('error') || 'Google sign-in failed.';
      console.error('OAuth returned an error:', errorMessage);
      navigate('/login', {
        replace: true,
        state: { oauthError: errorMessage },
      });
    }
  }, [location.pathname, location.search, navigate]);

  return null;
}
