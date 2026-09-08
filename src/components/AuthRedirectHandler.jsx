import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getAuthErrorMessage } from '../lib/authErrors';

export default function AuthRedirectHandler() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const hasOAuthError = params.has('error') || params.has('error_description');
    const isOAuthResponse =
      params.has('state') ||
      params.has('oauth_error') ||
      location.pathname === '/';

    if (hasOAuthError && isOAuthResponse) {
      const errorMessage = params.get('error_description') || params.get('error') || 'Sign-in could not be completed.';
      console.error('OAuth returned an error:', errorMessage);
      navigate('/login', {
        replace: true,
        state: {
          oauthError: getAuthErrorMessage(
            new Error(errorMessage),
            'Connected sign-in could not be completed. Please try again.'
          ),
        },
      });
    }
  }, [location.pathname, location.search, navigate]);

  return null;
}
