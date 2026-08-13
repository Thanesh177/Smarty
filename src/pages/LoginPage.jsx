import { useEffect, useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import SmartyBrand from '../components/SmartyBrand';
import './LoginPage.css';

import {
  startSocialLogin,
} from '../lib/cognito';

export default function LoginPage() {
  const { user, loading, login } = useAuth();
  const location = useLocation();
  const fromState = location.state?.from;
  const from =
    (typeof fromState === 'string'
      ? fromState
      : fromState?.pathname) || '/feed';

  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState(() => {
    const oauthError = new URLSearchParams(window.location.search)
      .get('oauth_error');

    if (oauthError === 'apple') {
      return 'Apple sign-in could not be completed. Please try again.';
    }

    if (oauthError === 'google') {
      return 'Google sign-in could not be completed. Please try again.';
    }

    if (oauthError) {
      return 'Sign-in could not be completed. Please try again.';
    }

    return location.state?.oauthError || '';
  });
  const [message, setMessage] = useState('');
const [submitting, setSubmitting] = useState(false);
const [socialProvider, setSocialProvider] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    if (params.get('google') !== '1') {
      return;
    }

    const startGoogleRedirect = async () => {
      try {
        const redirectTarget = from === '/login' ? '/profile' : from;
        sessionStorage.setItem('smarty-post-login-redirect', redirectTarget);
        localStorage.setItem('smarty-post-login-redirect', redirectTarget);

        await startSocialLogin('Google', redirectTarget);
      } catch (error) {
        console.error('Automatic Google login failed:', error);
      }
    };

    startGoogleRedirect();
  }, [from]);

  if (loading) return <p className="status">Loading...</p>;
  if (user) return <Navigate to={from === '/login' ? '/profile' : from} replace />;

const handleGoogleLogin = async () => {
  setError('');
  setMessage('');

  if (submitting) return;

  setSubmitting(true);
  setSocialProvider('google');

    try {
      const redirectTarget = from === '/login' ? '/profile' : from;
      sessionStorage.setItem('smarty-post-login-redirect', redirectTarget);
      localStorage.setItem('smarty-post-login-redirect', redirectTarget);

      await startSocialLogin('Google', redirectTarget);
} catch (err) {
  setSocialProvider('');
  setError(
    err?.message ||
      'Google login failed. Please try again in Chrome or Safari.'
  );

  setSubmitting(false);
  setSocialProvider('');
}
  };



const handleAppleLogin = async () => {
  setError('');
  setMessage('');

  if (submitting) return;

  setSubmitting(true);
  setSocialProvider('apple');

  try {
    const redirectTarget =
      from === '/login' ? '/profile' : from;

    sessionStorage.setItem(
      'smarty-post-login-redirect',
      redirectTarget
    );

    localStorage.setItem(
      'smarty-post-login-redirect',
      redirectTarget
    );

    await startSocialLogin('Apple', redirectTarget);
  } catch (err) {
    console.error('Apple login failed:', err);

    setError(
      err?.message ||
        'Apple login failed. Please try again.'
    );

    setSubmitting(false);
    setSocialProvider('');
  }
};

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setMessage('');
    const email = form.email.trim();
    const password = form.password;

    if (!email || !password) {
      setError('Please enter both email and password.');
      return;
    }

    setSubmitting(true);

    try {
      const result = await login(email, password);

      if (result?.success === false) {
        const step = result?.nextStep?.signInStep;

        if (step === 'CONFIRM_SIGN_UP') {
          setError('Your account is not confirmed yet. Please verify your email on the confirmation page.');
          return;
        }

        setError(`Next sign-in step: ${step || 'unknown'}`);
        return;
      }

      setMessage('Login successful. Loading your profile...');
      sessionStorage.setItem('smarty-post-login-redirect', from);
      localStorage.setItem('smarty-post-login-redirect', from);

      window.setTimeout(() => {
        window.location.replace(from);
      }, 250);
    } catch (err) {
      setError(err?.message || 'Login failed. Check your Cognito configuration.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="login-page">
      <div className="login-shell">
        <section className="login-hero">
          <div>
            <SmartyBrand
              className="login-brand"
              tagline="Learn something worth keeping"
            />
            <h1>Welcome back.</h1>
            <p>
              Continue learning, saving, and creating from where you left off.
            </p>
          </div>

          <div className="login-highlights">
            <div>
              <strong>01</strong>
              <span>Personalized feed</span>
            </div>
            <div>
              <strong>02</strong>
              <span>Save useful posts</span>
            </div>
            <div>
              <strong>03</strong>
              <span>Create knowledge reels</span>
            </div>
          </div>
        </section>

        <section className="login-layout">
          <form className="login-card" onSubmit={handleSubmit}>
          <nav className="auth-mode-switch" aria-label="Authentication options">
            <span className="auth-mode-option active" aria-current="page">
              Sign in
            </span>
            <Link
              className="auth-mode-option"
              to="/register"
              state={{ from }}
              viewTransition
            >
              Sign up
            </Link>
          </nav>

          <div className="login-card-header">
            <h2>Sign in</h2>
            <p>Use your email or a connected account.</p>
          </div>

          <label>
            Email
            <input
              placeholder="you@example.com"
              type="email"
              value={form.email}
              autoComplete="email"
              disabled={submitting}
              onChange={(e) => setForm((current) => ({ ...current, email: e.target.value }))}
            />
          </label>

          <label>
            Password
            <input
              placeholder="Enter your password"
              type="password"
              value={form.password}
              autoComplete="current-password"
              disabled={submitting}
              onChange={(e) => setForm((current) => ({ ...current, password: e.target.value }))}
            />
          </label>

          {error && <p className="status error">{error}</p>}
          {message && <p className="status success">{message}</p>}

          <button
            className="primary-btn login-submit"
            disabled={submitting || !form.email.trim() || !form.password}
            type="submit"
          >
            {submitting && !socialProvider ? 'Signing in...' : 'Sign in'}
          </button>

          <div className="login-divider">
            <span>or continue with</span>
          </div>

            <div className="social-login-stack" aria-label="Social sign in options">
              <button
                type="button"
                className="apple-login-btn"
                disabled={submitting}
                onClick={handleAppleLogin}
              >
                <span className="apple-icon" aria-hidden="true">
                  
                </span>
                {socialProvider === 'apple' ? 'Opening...' : 'Apple'}
              </button>

              <button
                type="button"
                className="google-login-btn"
                data-google-login-button
                disabled={submitting}
                onClick={handleGoogleLogin}
              >
                <span className="google-icon" aria-hidden="true">
                  G
                </span>
                {socialProvider === 'google' ? 'Opening...' : 'Google'}
              </button>
            </div>

            <p className="login-legal-note">
              By creating an account, you agree to Smarty&apos;s{' '}
              <Link to="/terms" target="_blank" rel="noreferrer">
                Terms of Use and EULA
              </Link>{' '}
              and acknowledge the{' '}
              <Link to="/privacy" target="_blank" rel="noreferrer">
                Privacy Policy
              </Link>
              . Smarty has zero tolerance for objectionable content or abusive
              behavior.
            </p>
          </form>
        </section>
      </div>
    </main>
  );
}
