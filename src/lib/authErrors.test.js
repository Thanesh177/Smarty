import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getAuthErrorMessage, getChallengePresentation, isStrongPassword, isValidAuthEmail, isValidVerificationCode } from './authErrors.js';

test('authentication validation bounds passwords, email and verification codes', () => {
  assert.ok(isValidAuthEmail(' User@Example.com '));
  assert.ok(!isValidAuthEmail('a'.repeat(255) + '@example.com'));
  assert.ok(isStrongPassword('Synthetic-Value9'));
  assert.ok(!isStrongPassword('Synthetic-Value9' + 'a'.repeat(256)));
  assert.ok(isValidVerificationCode(' 123456 '));
  for (const code of ['', 'abc123', '12345', '1234567']) assert.ok(!isValidVerificationCode(code));
});

test('authentication errors never expose unrecognized provider details or account existence on login', () => {
  assert.equal(getAuthErrorMessage({ name: 'UserNotFoundException' }), getAuthErrorMessage({ name: 'NotAuthorizedException' }));
  assert.equal(getAuthErrorMessage(Error('internal https://provider.invalid/callback?code=synthetic')), 'Something went wrong. Please try again.');
  assert.match(getAuthErrorMessage({ name: 'TooManyRequestsException' }), /Too many/);
  assert.match(getAuthErrorMessage({ name: 'AbortError' }), /too long/);
  assert.match(getAuthErrorMessage({ name: 'CodeMismatchException' }), /not correct/);
});

test('authenticator setup and all supported security code challenges have usable presentations', () => {
  assert.equal(getChallengePresentation({ signInStep: 'CONTINUE_SIGN_IN_WITH_TOTP_SETUP' }).type, 'totp-setup');
  for (const step of ['CONFIRM_SIGN_IN_WITH_TOTP_CODE', 'CONFIRM_SIGN_IN_WITH_SMS_CODE', 'CONFIRM_SIGN_IN_WITH_EMAIL_CODE']) {
    assert.equal(getChallengePresentation({ signInStep: step }).autoComplete, 'one-time-code');
  }
});
