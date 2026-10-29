import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import SmartyBrand from '../components/SmartyBrand';
import AppearanceSwitch from '../components/AppearanceSwitch';
import TermsAgreement, {
  recordTermsAcceptance,
} from '../components/TermsAgreement';
import { safeAuthDestination, saveAuthDestination } from '../lib/authNavigation';
import {
  getAuthErrorMessage,
  getPasswordChecks,
  isStrongPassword,
  isValidAuthEmail,
  isValidVerificationCode,
  normalizeAuthEmail,
} from '../lib/authErrors';
import './LoginPage.css';
import './RegisterPage.css';
import './AuthProduction.css';

export default function RegisterPage() {
  const {
    user,
    loading,
    register,
    login,
    confirmRegistration,
    resendRegistrationCode,
  } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const from = safeAuthDestination(location.state?.from);
  const actionRef = useRef(false);
  const mountedRef = useRef(true);
  const cooldownTimerRef = useRef(null);

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

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      window.clearTimeout(cooldownTimerRef.current);
    };
  }, []);

  if (user) return <Navigate to={from} replace />;
  if (loading) return <main className="login-page auth-loading-page" role="status">Restoring your session…</main>;

  const updateField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (actionRef.current) return;
    actionRef.current = true;
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

        if (form.name.trim().length < 2 || form.name.trim().length > 100) {
          setError('Use a name between 2 and 100 characters.');
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

        // Cognito owns account creation. A separate email lookup adds latency,
        // exposes account existence and cannot prove that registration is safe.
        const result = await register(form.name.trim(), cleanEmail, form.password);
        recordTermsAcceptance(cleanEmail);
        if (!mountedRef.current) return;
        setForm(current => ({ ...current, email: cleanEmail }));

        if (result?.isSignUpComplete) {
          setForm(current => ({ ...current, password: '', confirmPassword: '' }));
          setMessage('Account created. You can log in now.');
          setStep('done');
        } else {
          setMessage('Verification code sent to your email.');
          setStep('confirm');
          // Sending another code immediately after sign-up is unnecessary.
          setResendCooldown(true);
          cooldownTimerRef.current = window.setTimeout(() => setResendCooldown(false), 30_000);
        }
      }

      if (step === 'confirm') {
        const cleanEmail = normalizeAuthEmail(form.email);

        if (!isValidVerificationCode(form.code)) {
          setError('Enter the six-digit verification code from your email.');
          return;
        }

        const confirmed = await confirmRegistration(cleanEmail, form.code.trim());
        if (confirmed?.isSignUpComplete === false) throw new Error('Verification incomplete.');
        if (!mountedRef.current) return;
        // Confirmation and sign-in are separate transactions. Never ask a
        // verified user to confirm again when the subsequent sign-in fails.
        setStep('done');
        setMessage('Account verified. Sign in to continue.');
        try {
          saveAuthDestination(from);
          const signInResult = await login(cleanEmail, form.password);
          if (!mountedRef.current) return;
          if (signInResult?.success) navigate(from, { replace: true });
        } catch {
          // The account is still verified. Continue to the regular sign-in
          // flow for connection recovery or any additional security check.
        } finally {
          if (mountedRef.current) setForm(current => ({ ...current, password: '', confirmPassword: '', code: '' }));
        }
      }
    } catch (err) {
      if (mountedRef.current) setError(getAuthErrorMessage(err, 'Registration could not be completed.'));
    } finally {
      actionRef.current = false;
      if (mountedRef.current) setSubmitting(false);
    }
  };

  const handleResendCode = async () => {
    if (actionRef.current || resendCooldown) return;

    const cleanEmail = normalizeAuthEmail(form.email);

    if (!isValidAuthEmail(cleanEmail)) {
      setError('Enter the email used to create your account.');
      return;
    }

    actionRef.current = true;
    setSubmitting(true);
    setError('');
    setMessage('');

    try {
      await resendRegistrationCode(cleanEmail);
      if (!mountedRef.current) return;
      setMessage('A new verification code was sent.');
      setResendCooldown(true);
      window.clearTimeout(cooldownTimerRef.current);
      cooldownTimerRef.current = window.setTimeout(() => setResendCooldown(false), 30_000);
    } catch (err) {
      if (mountedRef.current) setError(getAuthErrorMessage(err, 'A new code could not be sent.'));
    } finally {
      actionRef.current = false;
      if (mountedRef.current) setSubmitting(false);
    }
  };

  return (
    <main className="login-page register-page">
      <div className="login-shell">
        <section className="login-hero">
          <div>
            <div className="auth-appearance-row"><SmartyBrand
              className="login-brand"
              tagline="Learn something worth keeping"
            /><AppearanceSwitch compact /></div>
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
          <form className="login-card register-card" onSubmit={handleSubmit} noValidate aria-busy={submitting} aria-describedby={error ? 'register-error' : undefined}>
            <nav className="auth-mode-switch" aria-label="Authentication options">
              <Link
                className="auth-mode-option"
                to="/login"
                state={{ from }}
                viewTransition
                onClick={prepareSignInTransition}
                aria-disabled={submitting}
                tabIndex={submitting ? -1 : undefined}
                onClickCapture={event => { if (submitting) event.preventDefault(); }}
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
                    name="name"
                    maxLength={100}
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
                    name="email"
                    inputMode="email"
                    autoCapitalize="none"
                    spellCheck={false}
                    maxLength={254}
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
                      name="new-password"
                      maxLength={256}
                      value={form.password}
                      disabled={submitting}
                      onChange={(e) => updateField('password', e.target.value)}
                    />
                    <button
                      className="auth-password-toggle"
                      type="button"
                      disabled={submitting}
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
                    name="confirm-password"
                    maxLength={256}
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
                    disabled
                    onChange={(e) => updateField('email', e.target.value)}
                  />
                </label>

                <label>
                  Verification code
                  <input
                    placeholder="Enter your code"
                    inputMode="numeric"
                    maxLength={6}
                    autoComplete="one-time-code"
                    value={form.code}
                    disabled={submitting}
                    onChange={(e) => updateField('code', e.target.value.replace(/\s/g, ''))}
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

            {error && <p id="register-error" className="status error" role="alert">{error}</p>}
            {message && <p className="status success" role="status">{message}</p>}

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
                state={{ from, verifiedEmail: form.email }}
                viewTransition
                onClick={prepareSignInTransition}
                aria-disabled={submitting}
                tabIndex={submitting ? -1 : undefined}
                onClickCapture={event => { if (submitting) event.preventDefault(); }}
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
              aria-disabled={submitting}
              tabIndex={submitting ? -1 : undefined}
              onClickCapture={event => { if (submitting) event.preventDefault(); }}
            >
              Already have an account? Sign in
            </Link>
          </form>
        </section>
      </div>
    </main>
  );
}
