import React from 'react';
import { afterEach, beforeEach, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Pressable, Text } from 'react-native';

import { AuthProvider, useAuth } from '../src/auth/AuthProvider';
import { subscribeToAuthChanges, type AuthUser } from '../src/auth/AuthService';

jest.mock('../src/auth/AuthService', () => ({ subscribeToAuthChanges: jest.fn() }));
const mockSubscribe = jest.mocked(subscribeToAuthChanges);

type Listener = Parameters<typeof subscribeToAuthChanges>[0];
let listeners: Listener[] = [];
const unsubscribes: jest.Mock[] = [];

function Probe() {
  const { user, loading, checkFailed, sessionExpired, retryCheck } = useAuth();
  return (
    <>
      <Text>{`user:${user?.uid ?? 'none'} loading:${loading} failed:${checkFailed} expired:${sessionExpired}`}</Text>
      <Pressable accessibilityRole="button" onPress={retryCheck}>
        <Text>retry</Text>
      </Pressable>
    </>
  );
}

const state = () => screen.getByText(/^user:/).props.children as string;
const emit = (user: AuthUser | null, sessionExpired = false) =>
  act(() => listeners[listeners.length - 1](user, { sessionExpired }));

beforeEach(() => {
  jest.useFakeTimers();
  mockSubscribe.mockReset();
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  listeners = [];
  unsubscribes.length = 0;
  mockSubscribe.mockImplementation((listener) => {
    listeners.push(listener);
    const unsubscribe = jest.fn();
    unsubscribes.push(unsubscribe);
    return unsubscribe as () => void;
  });
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

const roamer: AuthUser = { uid: 'u1', email: 'r@example.com', displayName: 'R' };

it('reports a failed startup check after 8 seconds and stops showing the spinner', async () => {
  await render(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  );
  expect(state()).toContain('loading:true failed:false');
  await act(async () => {
    jest.advanceTimersByTime(8000);
  });
  expect(state()).toContain('loading:false failed:true');
});

it('retrying the check subscribes again and clears the failure when Firebase answers', async () => {
  await render(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  );
  await act(async () => {
    jest.advanceTimersByTime(8000);
  });
  await fireEvent.press(screen.getByRole('button', { name: 'retry' }));
  expect(mockSubscribe).toHaveBeenCalledTimes(2);
  expect(unsubscribes[0]).toHaveBeenCalled();
  expect(state()).toContain('loading:true failed:false');
  await emit(null);
  expect(state()).toContain('loading:false failed:false');
});

it('marks the session expired when Firebase ends it, and clears that on the next sign-in', async () => {
  await render(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  );
  await emit(roamer);
  await emit(null, true);
  expect(state()).toContain('user:none');
  expect(state()).toContain('expired:true');
  await emit(roamer);
  expect(state()).toContain('expired:false');
});

it('does not mark the session expired for a normal sign-out', async () => {
  await render(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  );
  await emit(roamer);
  await emit(null, false);
  expect(state()).toContain('expired:false');
});
