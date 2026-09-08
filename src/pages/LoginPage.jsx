import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Link,
  Navigate,
  useLocation,
  useNavigate,
} from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import SmartyBrand from '../components/SmartyBrand';
import { startSocialLogin } from '../lib/cognito';
import {
  getAuthErrorMessage,
  getChallengePresentation,
  isStrongPassword,
  isValidAuthEmail,
  normalizeAuthEmail,
} from '../lib/authErrors';
import './LoginPage.css';

function getSafeDestination(location) {
  const fromState = location.state?.from;
  const candidate =
    (typeof fromState === 'string'
      ? fromState
      : fromState?.pathname
        ? `${fromState.pathname}${fromState.search || ''}${fromState.hash || ''}`
        : '') || '/feed';

  if (
    !candidate.startsWith('/') ||
    candidate.startsWith('//') ||
    candidate.includes('\\') ||
    candidate === '/login' ||
    candidate === '/register'
  ) {
    return '/feed';
  }

  return candidate;
}

function getInitialAuthError(location) {
  const oauthError = new URLSearchParams(window.location.search).get('oauth_error');

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
}

export default function LoginPage() {
  const {
    user,
    loading,
    login,
    confirmLogin,
    beginPasswordReset,
    finishPasswordReset,
  } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const from = getSafeDestination(location);
  const autoSocialStartedRef = useRef(false);

  const [mode, setMode] = useState('sign-in');
  const [form, setForm] = useState({
    email: normalizeAuthEmail(location.state?.verifiedEmail),
    password: '',
    code: '',
    newPassword: '',
    challengeResponse: '',
  });
  const [challenge, setChallenge] = useState(null);
  const [error, setError] = useState(() => getInitialAuthError(location));
  const [message, setMessage] = useState(() =>
    new URLSearchParams(window.location.search).get('loggedOut') === '1'
      ? 'You have been signed out securely.'
      : ''
  );
  const [submitting, setSubmitting] = useState(false);
  const [socialProvider, setSocialProvider] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [capsLockOn, setCapsLockOn] = useState(false);

  const updateField = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const prepareSignUpTransition = () => {
    document.documentElement.dataset.authDirection = 'forward';
  };

  const returnToSignIn = () => {
    setMode('sign-in');
    setChallenge(null);
    setError('');
    setMessage('');
    updateField('challengeResponse', '');
  };

  const finishSignIn = useCallback(() => {
    sessionStorage.setItem('smarty-post-login-redirect', from);
    localStorage.setItem('smarty-post-login-redirect', from);
    navigate(from, { replace: true });
  }, [from, navigate]);

  const continueFromNextStep = useCallback(
    (nextStep) => {
      const step = nextStep?.signInStep || '';

      if (step === 'CONFIRM_SIGN_UP') {
        navigate('/confirm', {
          state: { email: normalizeAuthEmail(form.email), from },
        });
        return;
      }

      if (step === 'RESET_PASSWORD') {
        setMode('forgot-password');
        setMessage('Reset your password to continue signing in.');
        return;
      }

      const presentation = getChallengePresentation(nextStep);

      if (presentation) {
        setChallenge({ nextStep, presentation });
        setMode('challenge');
        updateField(
          'challengeResponse',
          presentation.type === 'selection'
            ? presentation.options?.[0] || ''
            : ''
        );
        return;
      }

      setError(
        step === 'CONTINUE_SIGN_IN_WITH_TOTP_SETUP'
          ? 'Authenticator setup is required. Open account security settings in a browser to finish setup.'
          : 'This account requires an additional verification step. Please try a connected account or contact support.'
      );
    },
    [form.email, from, navigate]
  );

  const handleSocialLogin = useCallback(
    async (provider) => {
      if (submitting) return;

      setError('');
      setMessage('');
      setSubmitting(true);
      setSocialProvider(provider.toLowerCase());

      try {
        sessionStorage.setItem('smarty-post-login-redirect', from);
        localStorage.setItem('smarty-post-login-redirect', from);
        await startSocialLogin(provider, from);
      } catch (socialError) {
        console.error(`${provider} sign-in failed:`, socialError);
        setError(
          getAuthErrorMessage(
            socialError,
            `${provider} sign-in could not be opened. Please try again.`
          )
        );
        setSubmitting(false);
        setSocialProvider('');
      }
    },
    [from, submitting]
  );

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    if (params.get('google') !== '1' || autoSocialStartedRef.current) {
      return;
    }

    autoSocialStartedRef.current = true;
    handleSocialLogin('Google');
  }, [handleSocialLogin]);

  if (loading) {
    return (
      <main className="login-page auth-loading-page" role="status" aria-live="polite">
        <div className="auth-loading-card">
          <span className="auth-loading-mark" aria-hidden="true">S</span>
          <div>
            <strong>Restoring your session</strong>
            <p>This should only take a moment.</p>
          </div>
        </div>
      </main>
    );
  }

  if (user) return <Navigate to={from} replace />;

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (submitting) return;

    const email = normalizeAuthEmail(form.email);
    setError('');
    setMessage('');

    if (mode !== 'challenge' && !isValidAuthEmail(email)) {
      setError('Enter a valid email address.');
      return;
    }

    setSubmitting(true);

    try {
      if (mode === 'sign-in') {
        if (!form.password) {
          setError('Enter your password.');
          return;
        }

        sessionStorage.setItem('smarty-post-login-redirect', from);
        localStorage.setItem('smarty-post-login-redirect', from);

        const result = await login(email, form.password);

        if (result?.success) {
          finishSignIn();
          return;
        }

        continueFromNextStep(result?.nextStep);
      }

      if (mode === 'forgot-password') {
        const result = await beginPasswordReset(email);

        if (result?.isPasswordReset) {
          setMode('sign-in');
          setMessage('Your password is ready to use. Sign in below.');
          return;
        }

        setMode('reset-password');
        setMessage(
          result?.nextStep?.codeDeliveryDetails?.destination
            ? `A reset code was sent to ${result.nextStep.codeDeliveryDetails.destination}.`
            : 'A password reset code was sent to your email.'
        );
      }

      if (mode === 'reset-password') {
        if (!form.code.trim()) {
          setError('Enter the reset code from your email.');
          return;
        }

        if (!isStrongPassword(form.newPassword)) {
          setError('Use at least 10 characters with uppercase, lowercase, and a number.');
          return;
        }

        await finishPasswordReset(email, form.code, form.newPassword);
        setMode('sign-in');
        setForm((current) => ({
          ...current,
          password: '',
          code: '',
          newPassword: '',
        }));
        setMessage('Password updated. Sign in with your new password.');
      }

      if (mode === 'challenge') {
        const response = form.challengeResponse.trim();

        if (!response) {
          setError('Complete the verification step to continue.');
          return;
        }

        const result = await confirmLogin(response);

        if (result?.success) {
          finishSignIn();
          return;
        }

        continueFromNextStep(result?.nextStep);
      }
    } catch (authError) {
      setError(getAuthErrorMessage(authError));
    } finally {
      setSubmitting(false);
    }
  };

  const isRecoveryMode = mode === 'forgot-password' || mode === 'reset-password';
  const challengePresentation = challenge?.presentation;

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

          <div className="login-highlights" aria-label="Account benefits">
            <div><strong>01</strong><span>Personalized feed</span></div>
            <div><strong>02</strong><span>Save useful posts</span></div>
            <div><strong>03</strong><span>Secure sync</span></div>
          </div>
        </section>

        <section className="login-layout">
          <form
            className="login-card"
            onSubmit={handleSubmit}
            aria-busy={submitting}
            noValidate
          >
            {!isRecoveryMode && mode !== 'challenge' && (
              <nav className="auth-mode-switch" aria-label="Authentication options">
                <span className="auth-mode-option active" aria-current="page">
                  Sign in
                </span>
                <Link
                  className="auth-mode-option"
                  to="/register"
                  state={{ from }}
                  viewTransition
                  onClick={prepareSignUpTransition}
                >
                  Sign up
                </Link>
              </nav>
            )}

            <div className="login-card-header">
              <h2>
                {mode === 'sign-in' && 'Sign in'}
                {mode === 'forgot-password' && 'Reset password'}
                {mode === 'reset-password' && 'Enter reset code'}
                {mode === 'challenge' && (challengePresentation?.title || 'Verify sign-in')}
              </h2>
              <p>
                {mode === 'sign-in' && 'Use your email or a connected account.'}
                {mode === 'forgot-password' && 'We’ll send a secure code to your email.'}
                {mode === 'reset-password' && 'Create a new password for your account.'}
                {mode === 'challenge' && challengePresentation?.description}
              </p>
            </div>

            {mode !== 'challenge' && (
              <label>
                Email
                <input
                  placeholder="you@example.com"
                  type="email"
                  value={form.email}
                  autoComplete="email"
                  inputMode="email"
                  disabled={submitting || mode === 'reset-password'}
                  onChange={(event) => updateField('email', event.target.value)}
                />
              </label>
            )}

            {mode === 'sign-in' && (
              <label>
                <span className="auth-field-label">
                  Password
                  <button
                    className="auth-inline-action"
                    type="button"
                    onClick={() => setShowPassword((current) => !current)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </span>
                <input
                  placeholder="Enter your password"
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  autoComplete="current-password"
                  disabled={submitting}
                  onKeyUp={(event) => setCapsLockOn(event.getModifierState('CapsLock'))}
                  onBlur={() => setCapsLockOn(false)}
                  onChange={(event) => updateField('password', event.target.value)}
                />
                {capsLockOn && <small className="auth-field-hint">Caps Lock is on</small>}
              </label>
            )}

            {mode === 'reset-password' && (
              <>
                <label>
                  Reset code
                  <input
                    placeholder="6-digit code"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    value={form.code}
                    disabled={submitting}
                    onChange={(event) => updateField('code', event.target.value.replace(/\s/g, ''))}
                  />
                </label>
                <label>
                  <span className="auth-field-label">
                    New password
                    <button
                      className="auth-inline-action"
                      type="button"
                      onClick={() => setShowPassword((current) => !current)}
                    >
                      {showPassword ? 'Hide' : 'Show'}
                    </button>
                  </span>
                  <input
                    placeholder="Create a strong password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={form.newPassword}
                    disabled={submitting}
                    onChange={(event) => updateField('newPassword', event.target.value)}
                  />
                  <small className="auth-field-hint">10+ characters · uppercase · lowercase · number</small>
                </label>
              </>
            )}

            {mode === 'challenge' && challengePresentation?.type === 'selection' ? (
              <label>
                {challengePresentation.label}
                <select
                  value={form.challengeResponse}
                  disabled={submitting}
                  onChange={(event) => updateField('challengeResponse', event.target.value)}
                >
                  {challengePresentation.options.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </label>
            ) : mode === 'challenge' ? (
              <label>
                {challengePresentation?.label || 'Verification value'}
                <input
                  type={
                    challengePresentation?.type === 'password' ||
                    challengePresentation?.type === 'new-password'
                      ? 'password'
                      : challengePresentation?.type === 'email'
                        ? 'email'
                        : 'text'
                  }
                  inputMode={challengePresentation?.inputMode}
                  autoComplete={challengePresentation?.autoComplete}
                  value={form.challengeResponse}
                  disabled={submitting}
                  onChange={(event) => updateField('challengeResponse', event.target.value)}
                />
              </label>
            ) : null}

            {error && <p className="status error" role="alert">{error}</p>}
            {message && <p className="status success" role="status">{message}</p>}

            <button
              className="primary-btn login-submit"
              disabled={submitting}
              type="submit"
            >
              {submitting
                ? 'Please wait…'
                : mode === 'sign-in'
                  ? 'Sign in'
                  : mode === 'forgot-password'
                    ? 'Send reset code'
                    : mode === 'reset-password'
                      ? 'Update password'
                      : 'Continue securely'}
            </button>

            {mode === 'sign-in' && (
              <button
                className="auth-recovery-link"
                type="button"
                onClick={() => {
                  setMode('forgot-password');
                  setError('');
                  setMessage('');
                }}
              >
                Forgot password?
              </button>
            )}

            {(isRecoveryMode || mode === 'challenge') && (
              <button className="auth-recovery-link" type="button" onClick={returnToSignIn}>
                Back to sign in
              </button>
            )}

            {mode === 'sign-in' && (
              <>
                <div className="login-divider"><span>or continue with</span></div>

                <div className="social-login-stack" aria-label="Connected sign in options">
                  <button
                    type="button"
                    className="apple-login-btn"
                    disabled={submitting}
                    onClick={() => handleSocialLogin('Apple')}
                  >
                    <span className="apple-icon" aria-hidden="true"></span>
                    {socialProvider === 'apple' ? 'Opening…' : 'Apple'}
                  </button>

                  <button
                    type="button"
                    className="google-login-btn"
                    data-google-login-button
                    disabled={submitting}
                    onClick={() => handleSocialLogin('Google')}
                  >
                    <span className="google-icon" aria-hidden="true">G</span>
                    {socialProvider === 'google' ? 'Opening…' : 'Google'}
                  </button>
                </div>

                <p className="login-legal-note">
                  New accounts agree to Smarty&apos;s{' '}
                  <Link to="/terms" target="_blank" rel="noreferrer">Terms of Use and EULA</Link>{' '}
                  and acknowledge the{' '}
                  <Link to="/privacy" target="_blank" rel="noreferrer">Privacy Policy</Link>.
                </p>
              </>
            )}
          </form>
        </section>
      </div>
    </main>
  );
}
