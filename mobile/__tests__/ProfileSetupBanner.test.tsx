import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { beforeEach, expect, it, jest } from '@jest/globals';

import { callApi } from '../src/api';
import { ProfileSetupBanner } from '../src/auth/ProfileSetupBanner';
import { clearProfileSetupFailed, reportProfileSetupFailed } from '../src/auth/profileSetup';

jest.mock('../src/api', () => ({ callApi: jest.fn() }));
jest.mock(
  'react-native-safe-area-context',
  () => require('react-native-safe-area-context/jest/mock').default,
);
const mockCallApi = jest.mocked(callApi);

beforeEach(() => {
  jest.resetAllMocks();
  clearProfileSetupFailed();
});

it('shows nothing until a profile problem is reported', async () => {
  await render(<ProfileSetupBanner />);
  expect(screen.queryByRole('alert')).toBeNull();
  await act(async () => reportProfileSetupFailed());
  expect(screen.getByText(/could not save your profile/)).toBeTruthy();
});

it('Try again saves the profile and removes the banner', async () => {
  mockCallApi.mockResolvedValue({} as never);
  await render(<ProfileSetupBanner />);
  await act(async () => reportProfileSetupFailed());
  await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
  expect(mockCallApi).toHaveBeenCalledWith('ensureProfile', {});
  await act(async () => {});
  expect(screen.queryByRole('alert')).toBeNull();
});

it('keeps the banner and the button when the retry fails', async () => {
  mockCallApi.mockRejectedValue(new Error('offline'));
  await render(<ProfileSetupBanner />);
  await act(async () => reportProfileSetupFailed());
  await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
  await act(async () => {});
  expect(screen.getByText(/could not save your profile/)).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
});
