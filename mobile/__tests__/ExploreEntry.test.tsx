import React from 'react';
import { expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';

import App from '../App';
import { useAuth } from '../src/auth/AuthProvider';
import { signOut } from '../src/auth/AuthService';

jest.mock('../src/auth/AuthProvider', () => ({
  AuthProvider: ({ children }: React.PropsWithChildren) => children,
  useAuth: jest.fn(),
}));
jest.mock('../src/auth/AuthScreens', () => {
  const ReactModule = jest.requireActual<typeof import('react')>('react');
  const { Text } = jest.requireActual<typeof import('react-native')>('react-native');
  return { AuthScreen: () => ReactModule.createElement(Text, null, 'Existing upstream sign-in') };
});
jest.mock('../src/auth/AuthService', () => ({
  signOut: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
}));
jest.mock('../src/services', () => ({ registerServices: jest.fn() }));
jest.mock('../src/api', () => ({
  callApi: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
}));
jest.mock('../src/screens/MapScreen', () => {
  const ReactModule = jest.requireActual<typeof import('react')>('react');
  const { Pressable, Text } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    MapScreen: ({ onSignOut }: { onSignOut: () => void }) =>
      ReactModule.createElement(
        Pressable,
        { onPress: onSignOut, accessibilityRole: 'button' },
        ReactModule.createElement(Text, null, 'Explore sign-out'),
      ),
  };
});
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: ({ children }: React.PropsWithChildren) => children,
}));

it('uses upstream sign-in, opens Explore for the signed-in user, and returns after sign-out', async () => {
  jest.mocked(useAuth).mockReturnValue({ user: null, loading: false });
  const view = await render(<App />);
  expect(screen.getByText('Existing upstream sign-in')).toBeTruthy();
  jest.mocked(useAuth).mockReturnValue({
    user: { uid: 'map-demo', displayName: 'Demo', email: null },
    loading: false,
  });
  await view.rerender(<App />);
  await fireEvent.press(screen.getByRole('button', { name: 'Explore sign-out' }));
  expect(signOut).toHaveBeenCalledTimes(1);
  jest.mocked(useAuth).mockReturnValue({ user: null, loading: false });
  await view.rerender(<App />);
  expect(screen.getByText('Existing upstream sign-in')).toBeTruthy();
});
