import { expect, it } from '@jest/globals';

import {
  authErrorFromCode,
  MAX_NAME_LENGTH,
  validateAuthForm,
  type AuthErrorCategory,
  type AuthField,
} from '../src/auth/authErrors';

// code, category, field it belongs to (if any), message
const cases: [string, AuthErrorCategory, AuthField | undefined, string][] = [
  [
    'auth/invalid-email',
    'input',
    'email',
    'That email address does not look right. Check for typos.',
  ],
  ['auth/missing-email', 'input', 'email', 'Enter your email.'],
  ['auth/missing-password', 'input', 'password', 'Enter your password.'],
  [
    'auth/email-already-in-use',
    'input',
    'email',
    'An account with that email already exists. Try signing in.',
  ],
  ['auth/weak-password', 'input', 'password', 'Use a password with at least 6 characters.'],
  [
    'auth/password-does-not-meet-requirements',
    'input',
    'password',
    'Use a password with at least 6 characters.',
  ],
  [
    'auth/invalid-credential',
    'credentials',
    undefined,
    'Incorrect email or password. Try again, or reset your password.',
  ],
  [
    'auth/wrong-password',
    'credentials',
    undefined,
    'Incorrect email or password. Try again, or reset your password.',
  ],
  [
    'auth/user-not-found',
    'credentials',
    undefined,
    'Incorrect email or password. Try again, or reset your password.',
  ],
  [
    'auth/invalid-login-credentials',
    'credentials',
    undefined,
    'Incorrect email or password. Try again, or reset your password.',
  ],
  [
    'auth/user-token-expired',
    'credentials',
    undefined,
    'Your session expired. Please sign in again.',
  ],
  [
    'auth/invalid-user-token',
    'credentials',
    undefined,
    'Your session expired. Please sign in again.',
  ],
  [
    'auth/user-token-revoked',
    'credentials',
    undefined,
    'Your session expired. Please sign in again.',
  ],
  [
    'auth/invalid-refresh-token',
    'credentials',
    undefined,
    'Your session expired. Please sign in again.',
  ],
  [
    'auth/network-request-failed',
    'connection',
    undefined,
    'Cannot reach Roami. Check your internet connection and try again.',
  ],
  [
    'auth/timeout',
    'connection',
    undefined,
    'The request timed out. Check your internet connection and try again.',
  ],
  [
    'auth/internal-error',
    'connection',
    undefined,
    'Something went wrong on our end. Try again in a moment.',
  ],
  [
    'auth/too-many-requests',
    'blocked',
    undefined,
    'Too many attempts. Wait a few minutes and try again, or reset your password.',
  ],
  [
    'auth/user-disabled',
    'blocked',
    undefined,
    'This account has been disabled. Contact the Roami team.',
  ],
  [
    'auth/operation-not-allowed',
    'app',
    undefined,
    'Sign-in is not available right now. Please try again later.',
  ],
  [
    'auth/invalid-api-key',
    'app',
    undefined,
    'Sign-in is not available right now. Please try again later.',
  ],
  [
    'auth/app-not-authorized',
    'app',
    undefined,
    'Sign-in is not available right now. Please try again later.',
  ],
  ['auth/something-new', 'app', undefined, 'Something went wrong. Please try again.'],
  ['', 'app', undefined, 'Something went wrong. Please try again.'],
];

it.each(cases)(
  '%s maps to the %s category with the right message',
  (code, category, field, message) => {
    const error = authErrorFromCode(code);
    expect(error.category).toBe(category);
    expect(error.field).toBe(field);
    expect(error.message).toBe(message);
  },
);

it('only connection problems are retryable', () => {
  for (const [code, category] of cases) {
    expect(authErrorFromCode(code).retryable).toBe(category === 'connection');
  }
});

it('keeps wrong password and unknown email on the same message so accounts are not revealed', () => {
  expect(authErrorFromCode('auth/wrong-password').message).toBe(
    authErrorFromCode('auth/user-not-found').message,
  );
});

it('gives every message a plain-language sentence under 100 characters so it fits on a phone', () => {
  for (const [, , , message] of cases) {
    expect(message.length).toBeLessThan(100);
    expect(message).not.toMatch(/auth\//);
  }
});

it('reports every blank sign-in field at once', () => {
  expect(validateAuthForm('signIn', { name: '', email: ' ', password: '' })).toEqual({
    email: 'Enter your email.',
    password: 'Enter your password.',
  });
});

it('checks the name when signing up, including the profile length limit', () => {
  const ok = { email: 'a@b.co', password: 'secret1' };
  expect(validateAuthForm('signUp', { ...ok, name: '  ' })).toEqual({ name: 'Enter your name.' });
  expect(validateAuthForm('signUp', { ...ok, name: 'x'.repeat(MAX_NAME_LENGTH + 1) })).toEqual({
    name: 'Names can be at most 60 characters.',
  });
  expect(validateAuthForm('signUp', { ...ok, name: 'x'.repeat(MAX_NAME_LENGTH) })).toEqual({});
});

it('does not require a name when signing in', () => {
  expect(validateAuthForm('signIn', { name: '', email: 'a@b.co', password: 'secret1' })).toEqual(
    {},
  );
});
