import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import SmartyBrand from '../components/SmartyBrand';
import { useAuth } from '../contexts/AuthContext';
import {
  getAuthErrorMessage,
  isValidAuthEmail,
  normalizeAuthEmail,
} from '../lib/authErrors';
import './LoginPage.css';
import './RegisterPage.css';

export default function ConfirmPage() {
  const { user, confirmRegistration, resendRegistrationCode } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const mountedRef = useRef(true);
  const redirectTimerRef = useRef(null);
  const initialEmail = normalizeAuthEmail(location.state?.email);
  const fromState = location.state?.from;
  const from =
    typeof fromState === 'string'
      ? fromState
      : fromState?.pathname || '/feed';

  const [form, setForm] = useState({
    email: initialEmail,
    code: '',
  });
  const [error, setError] = useState('');
  const [message, setMessage] = useState(
    initialEmail ? 'Enter the code sent to your email.' : ''
  );
  const [submitting, setSubmitting] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(false);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      if (redirectTimerRef.current) {
        window.clearTimeout(redirectTimerRef.current);
      }
    };
  }, []);

  if (user) return <Navigate to={from} replace />;

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (submitting) return;

    const email = normalizeAuthEmail(form.email);
    const code = form.code.trim();

    if (!isValidAuthEmail(email) || !code) {
      setError('Enter your email and verification code.');
      return;
    }

    setError('');
    setMessage('');
    setSubmitting(true);

    try {
      await confirmRegistration(email, code);
      if (!mountedRef.current) return;

      setMessage('Account verified. Taking you back to sign in…');
      redirectTimerRef.current = window.setTimeout(() => {
        if (mountedRef.current) {
          navigate('/login', {
            replace: true,
            state: { from, verifiedEmail: email },
          });
        }
      }, 650);
    } catch (confirmationError) {
      if (!mountedRef.current) return;
      setError(
        getAuthErrorMessage(
          confirmationError,
          'Verification could not be completed.'
        )
      );
    } finally {
      if (mountedRef.current) setSubmitting(false);
    }
  };

  const handleResend = async () => {
    if (submitting || resendCooldown) return;

    const email = normalizeAuthEmail(form.email);

    if (!isValidAuthEmail(email)) {
      setError('Enter the email used to create your account.');
      return;
    }

    setSubmitting(true);
    setError('');
    setMessage('');

    try {
      await resendRegistrationCode(email);
      if (!mountedRef.current) return;
      setMessage('A new verification code was sent.');
      setResendCooldown(true);
      window.setTimeout(() => {
        if (mountedRef.current) setResendCooldown(false);
      }, 30_000);
    } catch (resendError) {
      if (!mountedRef.current) return;
      setError(getAuthErrorMessage(resendError, 'A new code could not be sent.'));
    } finally {
      if (mountedRef.current) setSubmitting(false);
    }
  };

  return (
    <main className="login-page register-page confirm-page">
      <div className="login-shell">
        <section className="login-hero">
          <div>
            <SmartyBrand className="login-brand" tagline="Learn something worth keeping" />
            <h1>One quick check.</h1>
            <p>Confirm your email so your learning, saved posts, and conversations stay securely connected.</p>
          </div>
        </section>

        <section className="login-layout">
          <form className="login-card register-card" onSubmit={handleSubmit} aria-busy={submitting} noValidate>
            <div className="login-card-header">
              <h2>Verify email</h2>
              <p>Enter the short code sent when you created your account.</p>
            </div>

            <label>
              Email
              <input
                placeholder="you@example.com"
                type="email"
                value={form.email}
                autoComplete="email"
                inputMode="email"
                disabled={submitting}
                onChange={(event) => setForm((current) => ({
                  ...current,
                  email: event.target.value,
                }))}
              />
            </label>

            <label>
              Verification code
              <input
                placeholder="6-digit code"
                value={form.code}
                inputMode="numeric"
                autoComplete="one-time-code"
                disabled={submitting}
                onChange={(event) => setForm((current) => ({
                  ...current,
                  code: event.target.value.replace(/\s/g, ''),
                }))}
              />
            </label>

            {error && <p className="status error" role="alert">{error}</p>}
            {message && <p className="status success" role="status">{message}</p>}

            <button className="primary-btn register-submit" disabled={submitting} type="submit">
              {submitting ? 'Please wait…' : 'Verify account'}
            </button>

            <button
              className="auth-recovery-link"
              type="button"
              disabled={submitting || resendCooldown}
              onClick={handleResend}
            >
              {resendCooldown ? 'Code sent · try again shortly' : 'Send a new code'}
            </button>

            <Link className="text-btn register-signin-link" to="/login" state={{ from }}>
              Back to sign in
            </Link>
          </form>
        </section>
      </div>
    </main>
  );
}
