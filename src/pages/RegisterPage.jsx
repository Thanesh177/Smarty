import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './RegisterPage.css';

export default function RegisterPage() {
  const { user, register, confirmRegistration } = useAuth();

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
        const result = await register(form.name, form.email, form.password);

        if (result?.isSignUpComplete) {
          setMessage('Account created. You can log in now.');
          setStep('done');
        } else {
          setMessage('Verification code sent to your email.');
          setStep('confirm');
        }
      }

      if (step === 'confirm') {
        await confirmRegistration(form.email, form.code);
        setMessage('Account verified. You can log in now.');
        setStep('done');
      }
    } catch (err) {
      setError(err?.message || 'Registration failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="register-page">
      <form className="register-card" onSubmit={handleSubmit}>
        <span className="register-logo">Smarty</span>

        <h1>
          {step === 'register' && 'Create account'}
          {step === 'confirm' && 'Verify email'}
          {step === 'done' && 'Account ready'}
        </h1>

        <p>
          {step === 'register' && 'Start sharing educational content.'}
          {step === 'confirm' && 'Enter the code sent to your email.'}
          {step === 'done' && 'Your email has been confirmed.'}
        </p>

        {step === 'register' && (
          <>
            <input
              placeholder="Name"
              value={form.name}
              onChange={(e) => updateField('name', e.target.value)}
            />

            <input
              placeholder="Email"
              type="email"
              value={form.email}
              onChange={(e) => updateField('email', e.target.value)}
            />

            <input
              placeholder="Password"
              type="password"
              value={form.password}
              onChange={(e) => updateField('password', e.target.value)}
            />
          </>
        )}

        {step === 'confirm' && (
          <>
            <input
              placeholder="Email"
              type="email"
              value={form.email}
              onChange={(e) => updateField('email', e.target.value)}
            />

            <input
              placeholder="Verification code"
              value={form.code}
              onChange={(e) => updateField('code', e.target.value)}
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
              : 'Confirm'}
          </button>
        ) : (
          <Link className="primary-btn" to="/login">
            Go to login
          </Link>
        )}

        <Link className="text-btn" to="/login">
          Already have an account?
        </Link>
      </form>
    </main>
  );
}