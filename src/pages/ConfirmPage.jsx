import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function ConfirmPage() {
  const { user, confirmRegistration } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const mountedRef = useRef(true);
  const redirectTimerRef = useRef(null);

  const [form, setForm] = useState({
    email: '',
    code: '',
  });
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (redirectTimerRef.current) {
        window.clearTimeout(redirectTimerRef.current);
      }
    };
  }, []);

  const from = location.state?.from?.pathname || '/feed';
  if (user) return <Navigate to={from} replace />;

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (submitting) return;

    const email = form.email.trim();
    const code = form.code.trim();

    if (!email || !code) {
      setError('Please enter both email and verification code.');
      return;
    }

    setError('');
    setMessage('');
    setSubmitting(true);

    try {
      await confirmRegistration(email, code);
      if (!mountedRef.current) return;

      setMessage('Account verified successfully. Redirecting to login...');

      redirectTimerRef.current = window.setTimeout(() => {
        if (mountedRef.current) navigate('/login', { state: { from } });
      }, 900);
    } catch (err) {
      if (!mountedRef.current) return;
      setError(err?.message || 'Confirmation failed. Please check the code and try again.');
    } finally {
      if (mountedRef.current) setSubmitting(false);
    }
  };

  return (
    <section className="auth-shell">
      <form className="auth-card" onSubmit={handleSubmit}>
        <h2>Confirm your account</h2>
        <p>Enter the verification code sent to your email.</p>

        <input
          placeholder="Email"
          type="email"
          value={form.email}
          autoComplete="email"
          disabled={submitting}
          onChange={(e) => setForm((cur) => ({ ...cur, email: e.target.value }))}
        />

        <input
          placeholder="Verification code"
          value={form.code}
          inputMode="numeric"
          autoComplete="one-time-code"
          disabled={submitting}
          onChange={(e) => setForm((cur) => ({ ...cur, code: e.target.value }))}
        />

        {error && <p className="status error">{error}</p>}
        {message && <p className="status success">{message}</p>}

        <button
          className="primary-btn"
          disabled={submitting || !form.email.trim() || !form.code.trim()}
          type="submit"
        >
          {submitting ? 'Please wait...' : 'Confirm account'}
        </button>

        <Link className="text-btn" to="/login" state={{ from }}>
          Back to login
        </Link>
      </form>
    </section>
  );
}