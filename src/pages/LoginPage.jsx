import { useEffect, useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { signInWithRedirect } from 'aws-amplify/auth';
import { useAuth } from '../contexts/AuthContext';
import './LoginPage.css';

import {
  isNativeCognitoLogin,
  startNativeAppleLogin,
  startAndroidGoogleLogin,
} from '../lib/cognito';

export default function LoginPage() {
  const { user, loading, login } = useAuth();
  const location = useLocation();
  const from = location.state?.from?.pathname || '/feed';

  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
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

        if (isAndroidCognitoLogin()) {
          startAndroidGoogleLogin();
          return;
        }

        await signInWithRedirect({
          provider: 'Google',
        });
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

      if (isAndroidCognitoLogin()) {
        startAndroidGoogleLogin();
        return;
      }

      await signInWithRedirect({
        provider: 'Google',
      });
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

    if (isNativeCognitoLogin()) {
      startNativeAppleLogin();
      return;
    }

    await signInWithRedirect({
      provider: 'Apple',
    });
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
      <section className="login-hero">
        <div>
          <h1>Learn faster. Scroll smarter.</h1>
          <p>
            Sign in to access your personalized educational feed, saved reels,
            and creator tools.
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
          <div className="login-card-header">
            <h2>Welcome back</h2>
            <p>Access your personalized learning feed.</p>
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
            {submitting ? 'Please wait...' : 'Login'}
          </button>

<div className="social-login-stack">
  <button
    type="button"
    className="apple-login-btn"
    disabled={submitting}
    onClick={handleAppleLogin}
  >
    <span
      className="apple-icon"
      aria-hidden="true"
    >
      
    </span>

    {socialProvider === 'apple'
      ? 'Opening Apple...'
      : 'Continue with Apple'}
  </button>

  <button
    type="button"
    className="google-login-btn"
    data-google-login-button
    disabled={submitting}
    onClick={handleGoogleLogin}
  >
    <span
      className="google-icon"
      aria-hidden="true"
    >
      G
    </span>

    {socialProvider === 'google'
      ? 'Opening Google...'
      : 'Continue with Google'}
  </button>
</div>

          <div className="login-links">
            <Link className="text-btn" to="/register" state={{ from }}>
              New here? Create an account
            </Link>
          </div>
        </form>

        <aside className="login-side">
          <div className="login-tip">
            <span>Save</span>
            <p>Bookmark useful educational content and return to it anytime.</p>
          </div>

          <div className="login-tip">
            <span>Create</span>
            <p>Publish short knowledge posts that feel native to the app experience.</p>
          </div>

          <div className="login-tip">
            <span>Sync</span>
            <p>Your activity connects securely through Cognito and AWS APIs.</p>
          </div>
        </aside>
      </section>
    </main>
  );
}