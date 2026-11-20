import { beforeEach, expect, it, jest } from '@jest/globals';
import {
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
} from 'firebase/auth';

import { AuthError } from '../src/auth/authErrors';
import {
  sendPasswordReset,
  signIn,
  signOut,
  subscribeToAuthChanges,
} from '../src/auth/AuthService';
import { getFirebaseAuth } from '../src/auth/firebase';

jest.mock('../src/auth/firebase', () => {
  const auth = {};
  return { getFirebaseAuth: () => auth };
});
jest.mock('firebase/auth', () => ({
  signInWithEmailAndPassword: jest.fn(),
  sendPasswordResetEmail: jest.fn(),
  onAuthStateChanged: jest.fn(),
  signOut: jest.fn(),
}));
const mockReset = jest.mocked(sendPasswordResetEmail);
const mockSignIn = jest.mocked(signInWithEmailAndPassword);
const mockListen = jest.mocked(onAuthStateChanged);
const mockFirebaseSignOut = jest.mocked(firebaseSignOut);

beforeEach(() => {
  jest.resetAllMocks();
});

it('trims the email, preserves the password, and returns the signed-in user', async () => {
  const user = { uid: 'user-1', email: 'roamer@example.com', displayName: 'Roamer' };
  mockSignIn.mockResolvedValue({ user } as Awaited<ReturnType<typeof signInWithEmailAndPassword>>);

  await expect(signIn('  roamer@example.com  ', ' password ')).resolves.toEqual(user);
  expect(mockSignIn).toHaveBeenCalledWith(getFirebaseAuth(), 'roamer@example.com', ' password ');
});

it('turns an invalid-credential error into a credentials AuthError', async () => {
  mockSignIn.mockRejectedValue({ code: 'auth/invalid-credential' });

  const error = await signIn('roamer@example.com', 'wrong-password').catch((e) => e);
  expect(error).toBeInstanceOf(AuthError);
  expect(error).toMatchObject({ category: 'credentials', retryable: false });
  expect(error.message).toContain('Incorrect email or password.');
});

it('marks a network failure as a retryable connection problem', async () => {
  mockSignIn.mockRejectedValue({ code: 'auth/network-request-failed' });

  const error = await signIn('roamer@example.com', 'password').catch((e) => e);
  expect(error).toMatchObject({ category: 'connection', retryable: true });
});

it('uses a generic message for unexpected errors and keeps the code for developers', async () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  mockSignIn.mockRejectedValue(new Error('Unexpected Firebase error'));

  await expect(signIn('roamer@example.com', 'password')).rejects.toThrow(
    'Something went wrong. Please try again.',
  );
  expect(warn).toHaveBeenCalled();
  warn.mockRestore();
});

it('sends a password reset to the trimmed email', async () => {
  mockReset.mockResolvedValue();
  await sendPasswordReset('  roamer@example.com ');
  expect(mockReset).toHaveBeenCalledWith(getFirebaseAuth(), 'roamer@example.com');
});

it('does not reveal whether an email has an account', async () => {
  mockReset.mockRejectedValue({ code: 'auth/user-not-found' });
  await expect(sendPasswordReset('nobody@example.com')).resolves.toBeUndefined();
});

it('reports a bad email or a network failure when resetting', async () => {
  mockReset.mockRejectedValue({ code: 'auth/invalid-email' });
  await expect(sendPasswordReset('nope')).rejects.toThrow(
    'That email address does not look right.',
  );
  mockReset.mockRejectedValue({ code: 'auth/network-request-failed' });
  await expect(sendPasswordReset('a@b.co')).rejects.toThrow('Cannot reach Roami');
});

function captureListener() {
  let listener: (user: { uid: string } | null) => void = () => {};
  mockListen.mockImplementation(((_auth: unknown, next: typeof listener) => {
    listener = next;
    return () => {};
  }) as unknown as typeof onAuthStateChanged);
  const calls: [string | null, boolean][] = [];
  subscribeToAuthChanges((user, info) =>
    calls.push([user?.uid ?? null, info?.sessionExpired ?? false]),
  );
  return { emit: (user: { uid: string } | null) => listener(user), calls };
}

it('flags a session that Firebase ended on its own as expired', () => {
  const { emit, calls } = captureListener();
  emit(null); // first answer at startup: nobody signed in, not an expiry
  emit({ uid: 'u1' });
  emit(null); // signed out without the user asking
  expect(calls).toEqual([
    [null, false],
    ['u1', false],
    [null, true],
  ]);
});

it('does not flag a sign-out the user asked for', async () => {
  mockFirebaseSignOut.mockResolvedValue();
  const { emit, calls } = captureListener();
  emit({ uid: 'u1' });
  await signOut();
  emit(null);
  expect(calls).toEqual([
    ['u1', false],
    [null, false],
  ]);
});
