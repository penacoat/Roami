import { expect, it, jest } from '@jest/globals';
import { initializeApp } from 'firebase/app';
import { initializeAuth, onAuthStateChanged } from 'firebase/auth';

import { getCurrentUser, signOut, subscribeToAuthChanges } from '../src/auth/AuthService';

jest.mock('../src/config/preview', () => ({ isFrontendPreview: true }));
jest.mock('firebase/app', () => ({ initializeApp: jest.fn() }));
jest.mock('firebase/auth', () => ({
  initializeAuth: jest.fn(),
  onAuthStateChanged: jest.fn(),
}));
jest.mock('@react-native-async-storage/async-storage', () => ({}));

it('opens as the sample user without starting Firebase or subscribing to real auth', async () => {
  const onChange = jest.fn();
  const unsubscribe = subscribeToAuthChanges(onChange);
  expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ uid: 'fixture-user' }));
  expect(getCurrentUser()?.uid).toBe('fixture-user');
  await signOut();
  unsubscribe();
  expect(initializeApp).not.toHaveBeenCalled();
  expect(initializeAuth).not.toHaveBeenCalled();
  expect(onAuthStateChanged).not.toHaveBeenCalled();
});

it('keeps API calls on sample data even when live mode is configured', async () => {
  const previous = process.env.EXPO_PUBLIC_API_MODE;
  try {
    process.env.EXPO_PUBLIC_API_MODE = 'live';
    let api!: typeof import('../src/api/ApiClient');
    jest.isolateModules(() => {
      api = require('../src/api/ApiClient');
    });
    const liveHandler = jest.fn<() => Promise<never>>();
    api.registerLiveHandlers({ listPlaces: liveHandler });
    expect(api.getApiMode()).toBe('fixtures');
    const result = await api.callApi('listPlaces', { city: 'Seattle' });
    expect(result.places.length).toBeGreaterThan(0);
    expect(liveHandler).not.toHaveBeenCalled();
  } finally {
    if (previous === undefined) delete process.env.EXPO_PUBLIC_API_MODE;
    else process.env.EXPO_PUBLIC_API_MODE = previous;
  }
});
