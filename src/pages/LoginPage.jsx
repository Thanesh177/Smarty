import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './LoginPage.css';

export default function LoginPage() {
  const { user, login } = useAuth();

  const [form, setForm] = useState({ email: '', password: '' });
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
    <main className="login-page">
      <section className="login-hero">
        <div>
          <span className="login-pill">Smarty Web</span>
          <h1>Learn faster. Scroll smarter.</h1>
          <p>
            Sign in to access your personalized educational feed, saved reels,
            and creator tools.
          </p>
        </div>

        <div className="login-highlights">
          <div>
            <strong>01</strong>
            <span>Personalized feed</span>
          </div>
          <div>
            <strong>02</strong>
            <span>Save useful posts</span>
          </div>
          <div>
            <strong>03</strong>
            <span>Create knowledge reels</span>
          </div>
        </div>
      </section>

      <section className="login-layout">
        <form className="login-card" onSubmit={handleSubmit}>
          <div className="login-card-header">
            <h2>Welcome back</h2>
            <p>Access your personalized learning feed.</p>
          </div>

          <label>
            Email
            <input
              placeholder="you@example.com"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </label>

          <label>
            Password
            <input
              placeholder="Enter your password"
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </label>

          {error && <p className="status error">{error}</p>}
          {message && <p className="status success">{message}</p>}

          <button className="primary-btn login-submit" disabled={submitting} type="submit">
            {submitting ? 'Please wait...' : 'Login'}
          </button>

          <div className="login-links">
            <Link className="text-btn" to="/register">
              Need an account? Register
            </Link>


          </div>
        </form>

        <aside className="login-side">

          <div className="login-tip">
            <span>Save</span>
            <p>Bookmark useful educational content and return to it anytime.</p>
          </div>

          <div className="login-tip">
            <span>Create</span>
            <p>Publish short knowledge posts that feel native to the app experience.</p>
          </div>

          <div className="login-tip">
            <span>Sync</span>
            <p>Your activity connects securely through Cognito and AWS APIs.</p>
          </div>
        </aside>
      </section>
    </main>
  );
}