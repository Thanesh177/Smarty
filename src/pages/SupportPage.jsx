import './text.css';

export default function SupportPage() {
  return (
    <main className="legal-page">
      <div className="legal-container">

        <h1>Smarty Support</h1>

        <p className="updated">
          We're here to help.
        </p>

        <h2>Frequently Asked Questions</h2>

        <h3>I can't sign in</h3>

        <ul>
          <li>Sign in again using Google or Apple.</li>
          <li>Clear your browser cache.</li>
          <li>Update the app.</li>
          <li>Check your internet connection.</li>
        </ul>

        <h3>I forgot which account I used</h3>

        <p>
          Sign out and choose the correct Google or Apple account during login.
        </p>

        <h3>Report inappropriate content</h3>

        <p>
          Open the post or comment and select <strong>Report</strong>. Our moderation team reviews reports as quickly as possible.
        </p>

        <h3>Delete your account</h3>

        <p>
          Go to:
        </p>

        <p>
          <strong>Profile → Delete Account</strong>
        </p>

        <p>
          Account deletion permanently removes your Smarty account.
        </p>

        <h3>Notifications</h3>

        <p>
          Enable notifications from both your device settings and Smarty settings.
        </p>

        <h3>Found a bug?</h3>

        <p>Please include:</p>

        <ul>
          <li>Device</li>
          <li>Browser or App Version</li>
          <li>Screenshots</li>
          <li>Steps to reproduce</li>
        </ul>

        <h3>Feature Requests</h3>

        <p>
          We'd love to hear your ideas.
        </p>

        <p>
          <a href="mailto:ntthanesh@gmail.com">
            ntthanesh@gmail.com
          </a>
        </p>

        <h2>Contact Support</h2>

        <p>
          <strong>Email:</strong>{' '}
          <a href="mailto:ntthanesh@gmail.com">
            ntthanesh@gmail.com
          </a>
        </p>

      </div>
    </main>
  );
}