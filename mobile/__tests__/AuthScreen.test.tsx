import React from 'react';
import { beforeEach, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { AuthScreen } from '../src/auth/AuthScreens';
import { sendPasswordReset } from '../src/auth/AuthService';

jest.mock('../src/auth/AuthService', () => ({
  signIn: jest.fn(),
  signUp: jest.fn(),
  sendPasswordReset: jest.fn(),
}));
const mockReset = jest.mocked(sendPasswordReset);

beforeEach(() => {
  jest.resetAllMocks();
});

async function openReset() {
  await render(<AuthScreen />);
  await fireEvent.press(screen.getByRole('button', { name: 'Forgot password?' }));
}

it('offers password recovery from the sign-in screen and hides the password field', async () => {
  await openReset();
  expect(screen.getByText('Reset your password')).toBeTruthy();
  expect(screen.queryByPlaceholderText('Password')).toBeNull();
});

it('asks for an email before sending', async () => {
  await openReset();
  await fireEvent.press(screen.getByRole('button', { name: 'Send reset link' }));
  expect(await screen.findByRole('alert')).toBeTruthy();
  expect(mockReset).not.toHaveBeenCalled();
});

it('sends the link and shows a confirmation that works for any email', async () => {
  mockReset.mockResolvedValue();
  await openReset();
  await fireEvent.changeText(screen.getByPlaceholderText('Email'), 'roamer@example.com');
  await fireEvent.press(screen.getByRole('button', { name: 'Send reset link' }));
  expect(await screen.findByText(/we sent a link to reset your password/)).toBeTruthy();
  expect(mockReset).toHaveBeenCalledWith('roamer@example.com');
});

it('shows an error when sending fails and can go back to sign in', async () => {
  mockReset.mockRejectedValue(new Error('Network error. Check your connection and try again.'));
  await openReset();
  await fireEvent.changeText(screen.getByPlaceholderText('Email'), 'roamer@example.com');
  await fireEvent.press(screen.getByRole('button', { name: 'Send reset link' }));
  expect(await screen.findByText(/Network error/)).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Back to sign in' }));
  expect(screen.getByText('Welcome back')).toBeTruthy();
});
