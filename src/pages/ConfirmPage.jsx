import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function ConfirmPage() {
  const { user, confirmRegistration } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    email: '',
    code: '',
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
      await confirmRegistration(form.email, form.code);
      setMessage('Account verified successfully. Redirecting to login...');
      setTimeout(() => navigate('/login'), 1200);
    } catch (err) {
      setError(err?.message || 'Confirmation failed. Please check the code and try again.');
    } finally {
      setSubmitting(false);
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
          onChange={(e) => setForm({ ...form, email: e.target.value })}
        />

        <input
          placeholder="Verification code"
          value={form.code}
          onChange={(e) => setForm({ ...form, code: e.target.value })}
        />

        {error && <p className="status error">{error}</p>}
        {message && <p className="status success">{message}</p>}

        <button className="primary-btn" disabled={submitting} type="submit">
          {submitting ? 'Please wait...' : 'Confirm account'}
        </button>

        <Link className="text-btn" to="/login">
          Back to login
        </Link>
      </form>
    </section>
  );
}