import { beforeEach, expect, it, jest } from '@jest/globals';
import { signInWithEmailAndPassword } from 'firebase/auth';

import { signIn } from '../src/auth/AuthService';
import { requireAuth } from '../src/auth/firebase';

jest.mock('../src/auth/firebase', () => {
  const auth = {};
  return { auth, requireAuth: () => auth };
});
jest.mock('firebase/auth', () => ({
  signInWithEmailAndPassword: jest.fn(),
}));

const mockSignIn = jest.mocked(signInWithEmailAndPassword);

beforeEach(() => {
  jest.resetAllMocks();
});

it('trims the email, preserves the password, and returns the signed-in user', async () => {
  const user = { uid: 'user-1', email: 'roamer@example.com', displayName: 'Roamer' };
  mockSignIn.mockResolvedValue({ user } as Awaited<ReturnType<typeof signInWithEmailAndPassword>>);

  await expect(signIn('  roamer@example.com  ', ' password ')).resolves.toEqual(user);
  expect(mockSignIn).toHaveBeenCalledWith(requireAuth(), 'roamer@example.com', ' password ');
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

it('explains how to fix an invalid Firebase API key', async () => {
  mockSignIn.mockRejectedValue({ code: 'auth/invalid-api-key' });
  await expect(signIn('roamer@example.com', 'password')).rejects.toThrow('EXPO_PUBLIC_FIREBASE_API_KEY');
});
