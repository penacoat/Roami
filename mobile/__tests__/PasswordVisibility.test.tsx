import React from 'react';
import { beforeEach, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { AuthScreen } from '../src/auth/AuthScreens';

jest.mock('../src/auth/AuthService', () => ({
  signIn: jest.fn(),
  signUp: jest.fn(),
  sendPasswordReset: jest.fn(),
}));

beforeEach(() => {
  jest.clearAllMocks();
});

it('hides the password by default and toggles it with the eye button', async () => {
  await render(<AuthScreen />);
  expect(screen.getByPlaceholderText('Password').props.secureTextEntry).toBe(true);

  await fireEvent.press(screen.getByRole('button', { name: 'Show password' }));
  expect(screen.getByPlaceholderText('Password').props.secureTextEntry).toBe(false);

  await fireEvent.press(screen.getByRole('button', { name: 'Hide password' }));
  expect(screen.getByPlaceholderText('Password').props.secureTextEntry).toBe(true);
});

it('keeps what was typed when toggling', async () => {
  await render(<AuthScreen />);
  await fireEvent.changeText(screen.getByPlaceholderText('Password'), 'hunter22');
  await fireEvent.press(screen.getByRole('button', { name: 'Show password' }));
  expect(screen.getByPlaceholderText('Password').props.value).toBe('hunter22');
});

it('hides the password again when switching between sign in and sign up', async () => {
  await render(<AuthScreen />);
  await fireEvent.press(screen.getByRole('button', { name: 'Show password' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Create an account' }));
  expect(screen.getByPlaceholderText('Password').props.secureTextEntry).toBe(true);
});

it('has no password field or eye button on the reset screen', async () => {
  await render(<AuthScreen />);
  await fireEvent.press(screen.getByRole('button', { name: 'Forgot password?' }));
  expect(screen.queryByPlaceholderText('Password')).toBeNull();
  expect(screen.queryByRole('button', { name: 'Show password' })).toBeNull();
});
