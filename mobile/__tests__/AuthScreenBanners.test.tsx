import React from 'react';
import { beforeEach, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { AuthScreen } from '../src/auth/AuthScreens';
import { useAuth } from '../src/auth/AuthProvider';

jest.mock('../src/auth/AuthService', () => ({
  signIn: jest.fn(),
  signUp: jest.fn(),
  sendPasswordReset: jest.fn(),
}));
jest.mock('../src/auth/AuthProvider', () => ({ useAuth: jest.fn() }));
const mockUseAuth = jest.mocked(useAuth);
const retryCheck = jest.fn();

function auth(overrides: Partial<ReturnType<typeof useAuth>>) {
  mockUseAuth.mockReturnValue({
    user: null,
    loading: false,
    checkFailed: false,
    sessionExpired: false,
    retryCheck,
    ...overrides,
  });
}

beforeEach(() => {
  jest.clearAllMocks();
});

it('tells the user the sign-in check failed and lets them retry it', async () => {
  auth({ checkFailed: true });
  await render(<AuthScreen />);
  expect(screen.getByText(/could not check your sign-in/)).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
  expect(retryCheck).toHaveBeenCalledTimes(1);
});

it('explains an expired session without a retry button', async () => {
  auth({ sessionExpired: true });
  await render(<AuthScreen />);
  expect(screen.getByText('Your session expired. Please sign in again.')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
});

it('shows no banner on a normal first launch', async () => {
  auth({});
  await render(<AuthScreen />);
  expect(screen.queryByRole('alert')).toBeNull();
});
