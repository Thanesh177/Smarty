import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function RegisterPage() {
  const { user, register, confirmRegistration } = useAuth();

  const [step, setStep] = useState('register'); // register | confirm
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    code: '',
  });
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (user) return <Navigate to="/feed" replace />;

  const handleRegister = async () => {
    const result = await register(form.name, form.email, form.password);

    if (result?.isSignUpComplete) {
      setMessage('Account created successfully. You can log in now.');
      setStep('register');
      return;
    }

    setMessage('Verification code sent to your email. Enter it below.');
    setStep('confirm');
  };

  const handleConfirm = async () => {
    await confirmRegistration(form.email, form.code);
    setMessage('Account verified successfully. You can log in now.');
    setStep('done');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setMessage('');
    setSubmitting(true);

    try {
      if (step === 'register') {
        await handleRegister();
      } else if (step === 'confirm') {
        await handleConfirm();
      }
    } catch (err) {
      setError(err?.message || 'Registration failed. Check your Cognito configuration.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="auth-shell">
      <form className="auth-card" onSubmit={handleSubmit}>
        <h2>
          {step === 'register' && 'Create account'}
          {step === 'confirm' && 'Confirm your email'}
          {step === 'done' && 'Account ready'}
        </h2>

        <p>
          {step === 'register' && 'Start publishing educational content.'}
          {step === 'confirm' && 'Enter the verification code sent to your email.'}
          {step === 'done' && 'Your account has been verified successfully.'}
        </p>

        {step === 'register' && (
          <>
            <input
              placeholder="Name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />

            <input
              placeholder="Email"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />

            <input
              placeholder="Password"
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </>
        )}

        {step === 'confirm' && (
          <>
            <input
              placeholder="Email"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />

            <input
              placeholder="Verification code"
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
            />
          </>
        )}

        {error && <p className="status error">{error}</p>}
        {message && <p className="status success">{message}</p>}

        {step !== 'done' ? (
          <button className="primary-btn" disabled={submitting} type="submit">
            {submitting
              ? 'Please wait...'
              : step === 'register'
              ? 'Register'
              : 'Confirm account'}
          </button>
        ) : (
          <Link className="primary-btn" to="/login">
            Go to login
          </Link>
        )}

        {step !== 'done' && (
          <Link className="text-btn" to="/login">
            Already have an account? Login
          </Link>
        )}
      </form>
    </section>
  );
}