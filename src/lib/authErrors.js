const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeAuthEmail(value) {
  return String(value || '').trim().toLowerCase();
}

export function isValidAuthEmail(value) {
  return EMAIL_PATTERN.test(normalizeAuthEmail(value));
}

export function getPasswordChecks(value) {
  const password = String(value || '');

  return [
    { id: 'length', label: '10+ characters', valid: password.length >= 10 },
    { id: 'lower', label: 'lowercase', valid: /[a-z]/.test(password) },
    { id: 'upper', label: 'uppercase', valid: /[A-Z]/.test(password) },
    { id: 'number', label: 'number', valid: /\d/.test(password) },
  ];
}

export function isStrongPassword(value) {
  return getPasswordChecks(value).every((check) => check.valid);
}

export function getAuthErrorMessage(error, fallback = 'Something went wrong. Please try again.') {
  const name = String(error?.name || '');
  const message = String(error?.message || '');
  const combined = `${name} ${message}`.toLowerCase();

  if (combined.includes('notauthorizedexception') || combined.includes('incorrect username or password')) {
    return 'The email or password is incorrect.';
  }

  if (combined.includes('usernotfoundexception')) {
    return 'No account was found for this email.';
  }

  if (combined.includes('usernotconfirmedexception')) {
    return 'Verify your email before signing in.';
  }

  if (combined.includes('usernameexistsexception') || combined.includes('already exists')) {
    return 'This email is already registered. Sign in instead.';
  }

  if (combined.includes('code mismatch') || combined.includes('codemismatchexception')) {
    return 'That verification code is not correct.';
  }

  if (combined.includes('expiredcodeexception') || combined.includes('code has expired')) {
    return 'That verification code has expired. Request a new one.';
  }

  if (combined.includes('limitexceededexception') || combined.includes('too many')) {
    return 'Too many attempts. Wait a moment and try again.';
  }

  if (combined.includes('password') && (combined.includes('policy') || combined.includes('invalidpassword'))) {
    return 'Use at least 10 characters with uppercase, lowercase, and a number.';
  }

  if (combined.includes('network') || combined.includes('fetch')) {
    return 'We could not reach the sign-in service. Check your connection and try again.';
  }

  if (combined.includes('access_denied') || combined.includes('cancelled') || combined.includes('canceled')) {
    return 'Connected sign-in was cancelled. Your account was not changed.';
  }

  if (combined.includes('oauth') || combined.includes('hosted ui')) {
    return 'Connected sign-in could not be completed. Please try again.';
  }

  return message && !message.toLowerCase().includes('exception') ? message : fallback;
}

export function getChallengePresentation(nextStep = {}) {
  const step = nextStep.signInStep || '';
  const codePresentations = {
    CONFIRM_SIGN_IN_WITH_EMAIL_CODE: {
      title: 'Check your email',
      description: 'Enter the security code sent to your email.',
      label: 'Email security code',
      type: 'code',
      inputMode: 'numeric',
      autoComplete: 'one-time-code',
    },
    CONFIRM_SIGN_IN_WITH_SMS_CODE: {
      title: 'Check your messages',
      description: 'Enter the security code sent to your phone.',
      label: 'Text message code',
      type: 'code',
      inputMode: 'numeric',
      autoComplete: 'one-time-code',
    },
    CONFIRM_SIGN_IN_WITH_TOTP_CODE: {
      title: 'Authenticator check',
      description: 'Enter the current code from your authenticator app.',
      label: 'Authenticator code',
      type: 'code',
      inputMode: 'numeric',
      autoComplete: 'one-time-code',
    },
    CONFIRM_SIGN_IN_WITH_CUSTOM_CHALLENGE: {
      title: 'Verify sign-in',
      description: 'Complete the security check for your account.',
      label: 'Verification response',
      type: 'code',
      autoComplete: 'one-time-code',
    },
    CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED: {
      title: 'Choose a new password',
      description: 'Your account requires a new password before continuing.',
      label: 'New password',
      type: 'new-password',
      autoComplete: 'new-password',
    },
    CONFIRM_SIGN_IN_WITH_PASSWORD: {
      title: 'Confirm your password',
      description: 'Re-enter your password to finish signing in.',
      label: 'Password',
      type: 'password',
      autoComplete: 'current-password',
    },
    CONTINUE_SIGN_IN_WITH_EMAIL_SETUP: {
      title: 'Add a recovery email',
      description: 'Enter the email address to use for account verification.',
      label: 'Recovery email',
      type: 'email',
      inputMode: 'email',
      autoComplete: 'email',
    },
  };

  if (codePresentations[step]) {
    return codePresentations[step];
  }

  if (
    step === 'CONTINUE_SIGN_IN_WITH_MFA_SELECTION' ||
    step === 'CONTINUE_SIGN_IN_WITH_MFA_SETUP_SELECTION' ||
    step === 'CONTINUE_SIGN_IN_WITH_FIRST_FACTOR_SELECTION'
  ) {
    const options =
      nextStep.allowedMFATypes ||
      nextStep.availableChallenges ||
      ['EMAIL'];

    return {
      title: 'Choose a security check',
      description: 'Select how you want to verify this sign-in.',
      label: 'Verification method',
      type: 'selection',
      options,
    };
  }

  return null;
}
