import { afterEach, beforeEach, expect, it, jest } from '@jest/globals';
import { initializeApp } from 'firebase/app';
import { initializeAuth } from 'firebase/auth';

jest.mock('firebase/app', () => ({ initializeApp: jest.fn(() => ({})) }));
jest.mock('firebase/auth', () => ({
  initializeAuth: jest.fn(() => ({ name: 'test-auth' })),
  getReactNativePersistence: jest.fn(),
}));
jest.mock('@react-native-async-storage/async-storage', () => ({}));

const names = ['EXPO_PUBLIC_FIREBASE_API_KEY', 'EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN', 'EXPO_PUBLIC_FIREBASE_PROJECT_ID', 'EXPO_PUBLIC_FIREBASE_APP_ID'];
let previous: (string | undefined)[];

beforeEach(() => {
  jest.clearAllMocks();
  previous = names.map(name => process.env[name]);
  names.forEach(name => { delete process.env[name]; });
});

afterEach(() => {
  names.forEach((name, index) => {
    if (previous[index] === undefined) delete process.env[name];
    else process.env[name] = previous[index];
  });
});

function loadFirebase(): typeof import('../src/auth/firebase') {
  let firebase!: typeof import('../src/auth/firebase');
  jest.isolateModules(() => { firebase = require('../src/auth/firebase'); });
  return firebase;
}

it('does not initialize Firebase or crash when configuration is missing', () => {
  const firebase = loadFirebase();
  expect(firebase.auth).toBeNull();
  expect(firebase.firebaseSetupError).toContain('EXPO_PUBLIC_FIREBASE_API_KEY');
  expect(initializeApp).not.toHaveBeenCalled();
  expect(() => firebase.requireAuth()).toThrow('Missing Firebase settings');
});

it('exposes a setup error instead of throwing during invalid-key initialization', () => {
  names.forEach(name => { process.env[name] = 'test-value'; });
  jest.mocked(initializeAuth).mockImplementationOnce(() => { throw new Error('auth/invalid-api-key'); });
  const firebase = loadFirebase();
  expect(firebase.auth).toBeNull();
  expect(firebase.firebaseSetupError).toContain('Firebase could not start');
});

it('initializes authentication when configuration is present', () => {
  names.forEach(name => { process.env[name] = 'test-value'; });
  const firebase = loadFirebase();
  expect(firebase.firebaseSetupError).toBeNull();
  expect(firebase.requireAuth()).toEqual({ name: 'test-auth' });
});
