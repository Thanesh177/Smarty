import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function LoginPage() {
  const { user, login } = useAuth();

  const [form, setForm] = useState({
    email: '',
    password: '',
  });
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (user) return <Navigate to="/feed" replace />;

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setMessage('');
    setSubmitting(true);

    try {
      const result = await login(form.email, form.password);

      if (result?.success === false) {
        const step = result?.nextStep?.signInStep;

        if (step === 'CONFIRM_SIGN_UP') {
          setError('Your account is not confirmed yet. Please verify your email on the confirmation page.');
          return;
        }

        setError(`Next sign-in step: ${step || 'unknown'}`);
      }
    } catch (err) {
      setError(err?.message || 'Login failed. Check your Cognito configuration.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="auth-shell">
      <form className="auth-card" onSubmit={handleSubmit}>
        <h2>Welcome back</h2>
        <p>Access your personalized learning feed.</p>

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

        {error && <p className="status error">{error}</p>}
        {message && <p className="status success">{message}</p>}

        <button className="primary-btn" disabled={submitting} type="submit">
          {submitting ? 'Please wait...' : 'Login'}
        </button>

        <Link className="text-btn" to="/register">
          Need an account? Register
        </Link>

        <Link className="text-btn" to="/confirm">
          Already have a code? Confirm account
        </Link>
      </form>
    </section>
  );
}