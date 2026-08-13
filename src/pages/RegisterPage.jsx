import { useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import SmartyBrand from '../components/SmartyBrand';
import TermsAgreement, {
  recordTermsAcceptance,
} from '../components/TermsAgreement';
import { userApi } from '../api/client';
import './LoginPage.css';
import './RegisterPage.css';

export default function RegisterPage() {
  const { user, register, confirmRegistration } = useAuth();
  const location = useLocation();
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
    code: '',
  });
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);

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
        const cleanEmail = form.email.trim().toLowerCase();

        if (!termsAccepted) {
          setError('Please agree to the Terms of Use and EULA before registering.');
          return;
        }

        if (!cleanEmail) {
          setError('Please enter your email.');
          return;
        }

        const existing = await userApi.checkEmailExists(cleanEmail);

        if (existing.exists) {
          console.warn('Email found in SmartyUsers, continuing signup so Cognito can confirm duplicate status.');
        }

        const result = await register(form.name, cleanEmail, form.password);
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
        await confirmRegistration(form.email.trim().toLowerCase(), form.code);
        setMessage('Account verified. You can log in now.');
        setStep('done');
      }
    } catch (err) {
      const errorName = err?.name || '';
      const errorMessage = err?.message || '';
      const combinedError = `${errorName} ${errorMessage}`;

      if (
        combinedError.includes('UsernameExistsException') ||
        combinedError.toLowerCase().includes('already exists') ||
        combinedError.toLowerCase().includes('already signed up') ||
        combinedError.toLowerCase().includes('account with the given email')
      ) {
        setError('This email is already signed up. Please log in instead.');
      } else {
        setError(errorMessage || 'Registration failed.');
      }
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
                  <input
                    placeholder="Create a password"
                    type="password"
                    autoComplete="new-password"
                    value={form.password}
                    disabled={submitting}
                    onChange={(e) => updateField('password', e.target.value)}
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
                    (!form.email.trim() || !form.password || !termsAccepted)) ||
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
