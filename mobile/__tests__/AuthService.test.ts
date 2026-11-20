import { beforeEach, expect, it, jest } from '@jest/globals';
import { sendPasswordResetEmail, signInWithEmailAndPassword } from 'firebase/auth';

import { sendPasswordReset, signIn } from '../src/auth/AuthService';
import { getFirebaseAuth } from '../src/auth/firebase';

jest.mock('../src/auth/firebase', () => {
  const auth = {};
  return { getFirebaseAuth: () => auth };
});
jest.mock('firebase/auth', () => ({
  signInWithEmailAndPassword: jest.fn(),
  sendPasswordResetEmail: jest.fn(),
}));
const mockReset = jest.mocked(sendPasswordResetEmail);

const mockSignIn = jest.mocked(signInWithEmailAndPassword);

beforeEach(() => {
  jest.resetAllMocks();
});

it('trims the email, preserves the password, and returns the signed-in user', async () => {
  const user = { uid: 'user-1', email: 'roamer@example.com', displayName: 'Roamer' };
  mockSignIn.mockResolvedValue({ user } as Awaited<ReturnType<typeof signInWithEmailAndPassword>>);

  await expect(signIn('  roamer@example.com  ', ' password ')).resolves.toEqual(user);
  expect(mockSignIn).toHaveBeenCalledWith(getFirebaseAuth(), 'roamer@example.com', ' password ');
});

it('turns an invalid-credential error into a helpful message', async () => {
  mockSignIn.mockRejectedValue({ code: 'auth/invalid-credential' });

  await expect(signIn('roamer@example.com', 'wrong-password')).rejects.toThrow(
    'Incorrect email or password.',
  );
});

it('uses a fallback message for unexpected errors', async () => {
  mockSignIn.mockRejectedValue(new Error('Unexpected Firebase error'));

  await expect(signIn('roamer@example.com', 'password')).rejects.toThrow(
    'Something went wrong. Please try again.',
  );
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
  await expect(sendPasswordReset('a@b.co')).rejects.toThrow('Network error');
});
