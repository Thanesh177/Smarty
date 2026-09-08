import { useMemo, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import SmartyBrand from '../components/SmartyBrand';
import TermsAgreement, {
  recordTermsAcceptance,
} from '../components/TermsAgreement';
import { userApi } from '../api/client';
import {
  getAuthErrorMessage,
  getPasswordChecks,
  isStrongPassword,
  isValidAuthEmail,
  normalizeAuthEmail,
} from '../lib/authErrors';
import './LoginPage.css';
import './RegisterPage.css';

export default function RegisterPage() {
  const {
    user,
    register,
    login,
    confirmRegistration,
    resendRegistrationCode,
  } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const fromState = location.state?.from;
  const from =
    (typeof fromState === 'string'
      ? fromState
      : fromState?.pathname) || '/feed';

  const [step, setStep] = useState('register');
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    code: '',
  });
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(false);
  const passwordChecks = useMemo(
    () => getPasswordChecks(form.password),
    [form.password]
  );

  const prepareSignInTransition = () => {
    document.documentElement.dataset.authDirection = 'backward';
  };

  if (user) return <Navigate to="/feed" replace />;

  const updateField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setMessage('');
    setSubmitting(true);

    try {
      if (step === 'register') {
        const cleanEmail = normalizeAuthEmail(form.email);

        if (!termsAccepted) {
          setError('Please agree to the Terms of Use and EULA before registering.');
          return;
        }

        if (form.name.trim().length < 2) {
          setError('Enter your name.');
          return;
        }

        if (!isValidAuthEmail(cleanEmail)) {
          setError('Enter a valid email address.');
          return;
        }

        if (!isStrongPassword(form.password)) {
          setError('Use at least 10 characters with uppercase, lowercase, and a number.');
          return;
        }

        if (form.password !== form.confirmPassword) {
          setError('The passwords do not match.');
          return;
        }

        try {
          const existing = await userApi.checkEmailExists(cleanEmail);

          if (existing.exists) {
            console.info('Account record found; Cognito will verify whether sign-up can continue.');
          }
        } catch (lookupError) {
          console.info('Account lookup unavailable; continuing with secure registration.', lookupError);
        }

        const result = await register(form.name.trim(), cleanEmail, form.password);
        recordTermsAcceptance(cleanEmail);

        if (result?.isSignUpComplete) {
          setMessage('Account created. You can log in now.');
          setStep('done');
        } else {
          setMessage('Verification code sent to your email.');
          setStep('confirm');
        }
      }

      if (step === 'confirm') {
        const cleanEmail = normalizeAuthEmail(form.email);

        if (!form.code.trim()) {
          setError('Enter the verification code from your email.');
          return;
        }

        await confirmRegistration(cleanEmail, form.code.trim());
        const signInResult = await login(cleanEmail, form.password);

        if (signInResult?.success) {
          navigate(from, { replace: true });
          return;
        }

        setMessage('Account verified. Sign in to continue.');
        setStep('done');
      }
    } catch (err) {
      setError(getAuthErrorMessage(err, 'Registration could not be completed.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleResendCode = async () => {
    if (submitting || resendCooldown) return;

    const cleanEmail = normalizeAuthEmail(form.email);

    if (!isValidAuthEmail(cleanEmail)) {
      setError('Enter the email used to create your account.');
      return;
    }

    setSubmitting(true);
    setError('');
    setMessage('');

    try {
      await resendRegistrationCode(cleanEmail);
      setMessage('A new verification code was sent.');
      setResendCooldown(true);
      window.setTimeout(() => setResendCooldown(false), 30_000);
    } catch (err) {
      setError(getAuthErrorMessage(err, 'A new code could not be sent.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="login-page register-page">
      <div className="login-shell">
        <section className="login-hero">
          <div>
            <SmartyBrand
              className="login-brand"
              tagline="Learn something worth keeping"
            />
            <h1>Make learning yours.</h1>
            <p>
              Create one account for your feed, saved ideas, conversations,
              quizzes, and everything you publish.
            </p>
          </div>

          <div className="login-highlights">
            <div>
              <strong>01</strong>
              <span>Follow your interests</span>
            </div>
            <div>
              <strong>02</strong>
              <span>Learn at your pace</span>
            </div>
            <div>
              <strong>03</strong>
              <span>Share what matters</span>
            </div>
          </div>
        </section>

        <section className="login-layout">
          <form className="login-card register-card" onSubmit={handleSubmit}>
            <nav className="auth-mode-switch" aria-label="Authentication options">
              <Link
                className="auth-mode-option"
                to="/login"
                state={{ from }}
                viewTransition
                onClick={prepareSignInTransition}
              >
                Sign in
              </Link>
              <span className="auth-mode-option active" aria-current="page">
                Sign up
              </span>
            </nav>

            <div className="login-card-header">
              <h2>
                {step === 'register' && 'Create account'}
                {step === 'confirm' && 'Verify email'}
                {step === 'done' && 'Account ready'}
              </h2>
              <p>
                {step === 'register' && 'A few details, then you’re in.'}
                {step === 'confirm' && 'Enter the code sent to your email.'}
                {step === 'done' && 'Your email has been confirmed.'}
              </p>
            </div>

            {step === 'register' && (
              <>
                <label>
                  Name
                  <input
                    placeholder="Your name"
                    autoComplete="name"
                    value={form.name}
                    disabled={submitting}
                    onChange={(e) => updateField('name', e.target.value)}
                  />
                </label>

                <label>
                  Email
                  <input
                    placeholder="you@example.com"
                    type="email"
                    autoComplete="email"
                    value={form.email}
                    disabled={submitting}
                    onChange={(e) => updateField('email', e.target.value)}
                  />
                </label>

                <label>
                  Password
                  <span className="auth-password-control">
                    <input
                      placeholder="Create a strong password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      value={form.password}
                      disabled={submitting}
                      onChange={(e) => updateField('password', e.target.value)}
                    />
                    <button
                      className="auth-password-toggle"
                      type="button"
                      onClick={() => setShowPassword((current) => !current)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? 'Hide' : 'Show'}
                    </button>
                  </span>
                </label>

                <div className="auth-password-checks" aria-label="Password requirements">
                  {passwordChecks.map((check) => (
                    <span className={check.valid ? 'is-valid' : ''} key={check.id}>
                      <i aria-hidden="true" />
                      {check.label}
                    </span>
                  ))}
                </div>

                <label>
                  Confirm password
                  <input
                    placeholder="Repeat your password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={form.confirmPassword}
                    disabled={submitting}
                    onChange={(e) => updateField('confirmPassword', e.target.value)}
                  />
                </label>

                <TermsAgreement
                  checked={termsAccepted}
                  disabled={submitting}
                  onChange={setTermsAccepted}
                />
              </>
            )}

            {step === 'confirm' && (
              <>
                <label>
                  Email
                  <input
                    placeholder="you@example.com"
                    type="email"
                    autoComplete="email"
                    value={form.email}
                    disabled={submitting}
                    onChange={(e) => updateField('email', e.target.value)}
                  />
                </label>

                <label>
                  Verification code
                  <input
                    placeholder="Enter your code"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    value={form.code}
                    disabled={submitting}
                    onChange={(e) => updateField('code', e.target.value)}
                  />
                </label>

                <button
                  className="auth-recovery-link"
                  type="button"
                  disabled={submitting || resendCooldown}
                  onClick={handleResendCode}
                >
                  {resendCooldown ? 'Code sent · try again shortly' : 'Send a new code'}
                </button>
              </>
            )}

            {error && <p className="status error">{error}</p>}
            {message && <p className="status success">{message}</p>}

            {step !== 'done' ? (
              <button
                className="primary-btn register-submit"
                disabled={
                  submitting ||
                  (step === 'register' &&
                    (!form.name.trim() ||
                      !form.email.trim() ||
                      !form.password ||
                      !form.confirmPassword ||
                      !termsAccepted)) ||
                  (step === 'confirm' && !form.code.trim())
                }
                type="submit"
              >
                {submitting
                  ? 'Please wait...'
                  : step === 'register'
                  ? 'Create account'
                  : 'Confirm email'}
              </button>
            ) : (
              <Link
                className="primary-btn register-submit"
                to="/login"
                state={{ from }}
                viewTransition
                onClick={prepareSignInTransition}
              >
                Continue to sign in
              </Link>
            )}

            <Link
              className="text-btn register-signin-link"
              to="/login"
              state={{ from }}
              viewTransition
              onClick={prepareSignInTransition}
            >
              Already have an account? Sign in
            </Link>
          </form>
        </section>
      </div>
    </main>
  );
}
