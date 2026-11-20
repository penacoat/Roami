import React from 'react';
import { beforeEach, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { callApi } from '../src/api';
import { AuthError, authErrorFromCode } from '../src/auth/authErrors';
import { AuthScreen } from '../src/auth/AuthScreens';
import { sendPasswordReset, signIn, signUp } from '../src/auth/AuthService';
import { reportProfileSetupFailed } from '../src/auth/profileSetup';

jest.mock('../src/auth/AuthService', () => ({
  signIn: jest.fn(),
  signUp: jest.fn(),
  sendPasswordReset: jest.fn(),
}));
jest.mock('../src/api', () => ({ callApi: jest.fn() }));
jest.mock('../src/auth/profileSetup', () => ({ reportProfileSetupFailed: jest.fn() }));
const mockReset = jest.mocked(sendPasswordReset);
const mockSignIn = jest.mocked(signIn);
const mockSignUp = jest.mocked(signUp);
const mockCallApi = jest.mocked(callApi);

const fail = (code: string): AuthError => authErrorFromCode(code);

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

async function fillSignIn(email = 'roamer@example.com', password = 'secret1') {
  await render(<AuthScreen />);
  await fireEvent.changeText(screen.getByPlaceholderText('Email'), email);
  await fireEvent.changeText(screen.getByPlaceholderText('Password'), password);
}

const submit = () => fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));

it('shows a message next to each blank sign-in field and does not call Firebase', async () => {
  await render(<AuthScreen />);
  await submit();
  expect(screen.getByText('Enter your email.')).toBeTruthy();
  expect(screen.getByText('Enter your password.')).toBeTruthy();
  expect(mockSignIn).not.toHaveBeenCalled();
});

it('clears a field message as soon as the user starts fixing that field', async () => {
  await render(<AuthScreen />);
  await submit();
  await fireEvent.changeText(screen.getByPlaceholderText('Email'), 'a');
  expect(screen.queryByText('Enter your email.')).toBeNull();
  expect(screen.getByText('Enter your password.')).toBeTruthy();
});

it('puts a bad-email error under the email field', async () => {
  mockSignIn.mockRejectedValue(fail('auth/invalid-email'));
  await fillSignIn('nope');
  await submit();
  expect(await screen.findByText(/does not look right/)).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
});

it('shows one wrong-password message with no retry button', async () => {
  mockSignIn.mockRejectedValue(fail('auth/invalid-credential'));
  await fillSignIn();
  await submit();
  expect(await screen.findByText(/Incorrect email or password/)).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
});

it.each([
  ['auth/too-many-requests', /Too many attempts/],
  ['auth/user-disabled', /account has been disabled/],
  ['auth/operation-not-allowed', /not available right now/],
])('shows a banner without a retry button for %s', async (code, text) => {
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  mockSignIn.mockRejectedValue(fail(code));
  await fillSignIn();
  await submit();
  expect(await screen.findByText(text)).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
});

it.each([
  ['auth/network-request-failed', /Cannot reach Roami/],
  ['auth/timeout', /timed out/],
  ['auth/internal-error', /on our end/],
])('shows a Try again button for the connection problem %s', async (code, text) => {
  mockSignIn.mockRejectedValue(fail(code));
  await fillSignIn();
  await submit();
  expect(await screen.findByText(text)).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
});

it('Try again repeats the same sign-in and clears the message when it works', async () => {
  mockSignIn
    .mockRejectedValueOnce(fail('auth/network-request-failed'))
    .mockResolvedValueOnce({ uid: 'u1', email: 'roamer@example.com', displayName: 'R' });
  await fillSignIn('roamer@example.com', 'secret1');
  await submit();
  await fireEvent.press(await screen.findByRole('button', { name: 'Try again' }));
  await waitFor(() => expect(mockSignIn).toHaveBeenCalledTimes(2));
  expect(mockSignIn).toHaveBeenLastCalledWith('roamer@example.com', 'secret1');
  await waitFor(() => expect(screen.queryByText(/Cannot reach Roami/)).toBeNull());
});

it('keeps showing the connection message if Try again fails again', async () => {
  mockSignIn.mockRejectedValue(fail('auth/network-request-failed'));
  await fillSignIn();
  await submit();
  await fireEvent.press(await screen.findByRole('button', { name: 'Try again' }));
  await waitFor(() => expect(mockSignIn).toHaveBeenCalledTimes(2));
  expect(await screen.findByText(/Cannot reach Roami/)).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
});

async function openSignUp() {
  await render(<AuthScreen />);
  await fireEvent.press(screen.getByRole('button', { name: 'Create an account' }));
}

it('refuses a sign-up name longer than 60 characters before creating the account', async () => {
  await openSignUp();
  await fireEvent.changeText(screen.getByPlaceholderText('Name'), 'x'.repeat(61));
  await fireEvent.changeText(screen.getByPlaceholderText('Email'), 'roamer@example.com');
  await fireEvent.changeText(screen.getByPlaceholderText('Password'), 'secret1');
  await fireEvent.press(screen.getByRole('button', { name: 'Sign up' }));
  expect(screen.getByText('Names can be at most 60 characters.')).toBeTruthy();
  expect(mockSignUp).not.toHaveBeenCalled();
});

it('shows email-already-in-use and weak-password under their own fields', async () => {
  mockSignUp.mockRejectedValueOnce(fail('auth/email-already-in-use'));
  await openSignUp();
  await fireEvent.changeText(screen.getByPlaceholderText('Name'), 'Roamer');
  await fireEvent.changeText(screen.getByPlaceholderText('Email'), 'roamer@example.com');
  await fireEvent.changeText(screen.getByPlaceholderText('Password'), 'secret1');
  await fireEvent.press(screen.getByRole('button', { name: 'Sign up' }));
  expect(await screen.findByText(/already exists/)).toBeTruthy();

  mockSignUp.mockRejectedValueOnce(fail('auth/weak-password'));
  await fireEvent.press(screen.getByRole('button', { name: 'Sign up' }));
  expect(await screen.findByText(/at least 6 characters/)).toBeTruthy();
});

it('reports a failed profile save after sign-up to the app-level banner', async () => {
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  mockSignUp.mockResolvedValue({ uid: 'u1', email: 'roamer@example.com', displayName: 'Roamer' });
  mockCallApi.mockRejectedValue(new Error('permission-denied'));
  await openSignUp();
  await fireEvent.changeText(screen.getByPlaceholderText('Name'), 'Roamer');
  await fireEvent.changeText(screen.getByPlaceholderText('Email'), 'roamer@example.com');
  await fireEvent.changeText(screen.getByPlaceholderText('Password'), 'secret1');
  await fireEvent.press(screen.getByRole('button', { name: 'Sign up' }));
  await waitFor(() => expect(reportProfileSetupFailed).toHaveBeenCalledTimes(1));
});

it('stops the name field at 60 characters so the limit can never be hit', async () => {
  await openSignUp();
  expect(screen.getByPlaceholderText('Name').props.maxLength).toBe(60);
});
