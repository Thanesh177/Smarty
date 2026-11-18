import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { clearAuthDestination, readAuthDestination } from '../lib/authNavigation';

export default function OAuthCompletionPage({ children }) {
  const { user, loading, authError, restoreSession } = useAuth();
  const navigate = useNavigate();
  const signedIn = Boolean(user);
  const [destination] = useState(() => readAuthDestination('/feed?topic=All'));
  const [recoveryFailed, setRecoveryFailed] = useState(false);
  const recoveryRef = useRef(null);

  useEffect(() => {
    if (loading || signedIn) return;

    // The auth provider already bounds the lookup. A second UI timer can
    // declare failure before it has finished restoring a valid sign-in.
    // Reattach to the same recovery if React replays the effect.
    recoveryRef.current ||= Promise.resolve().then(() => restoreSession({ attempts: 8 }));
    let active = true;
    recoveryRef.current.catch(() => {
      if (active) setRecoveryFailed(true);
    });
    return () => { active = false; };
  }, [loading, restoreSession, signedIn]);

  useEffect(() => {
    if (!signedIn) return;

    clearAuthDestination();
    try { sessionStorage.removeItem('smarty-auth-redirecting'); } catch { /* restricted storage */ }
    navigate(destination, { replace: true });
  }, [destination, navigate, signedIn]);

  if (loading || signedIn || !recoveryFailed) return children;

  return (
    <div className="app-page-loader" role="alert">
      <div className="app-page-loader-card">
        <div>
          <strong>Sign-in could not finish</strong>
          <p>{authError || 'Please try again. Your account was not changed.'}</p>
        </div>
        <button type="button" onClick={() => navigate('/login', { replace: true })}>
          Back to sign in
        </button>
      </div>
    </div>
  );
}
