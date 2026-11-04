import React from 'react';
import { beforeEach, expect, it, jest } from '@jest/globals';
import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';

import App from '../App';
import SignIn from '../src/app/sign-in';
import AppTabs from '../src/app/(tabs)/_layout';
import ExploreRoute from '../src/app/(tabs)/index';
import PostcardsRoute from '../src/app/(tabs)/postcards';
import NewTripRoute from '../src/app/(tabs)/trip';
import SavedRoute from '../src/app/(tabs)/saved';
import { callApi, resetFixtures } from '../src/api';

jest.mock('../src/services', () => ({ registerServices: jest.fn() }));
// Font rendering is checked in the actual preview; Jest has no native font asset registry.
jest.mock('expo-font', () => ({ isLoaded: () => true, loadAsync: jest.fn() }));
jest.mock('../src/auth/AuthService', () => {
  const user = { uid: 'demo-user', displayName: 'Demo', email: 'demo@example.test' };
  let notify: (value: typeof user | null) => void = () => {};
  return {
    signIn: jest.fn(async () => {
      notify(user);
      return user;
    }),
    signUp: jest.fn(async () => {
      notify(user);
      return user;
    }),
    signOut: jest.fn(async () => {
      notify(null);
    }),
    subscribeToAuthChanges: (callback: typeof notify) => {
      notify = callback;
      callback(null);
      return () => {};
    },
  };
});
jest.mock('react-native-maps', () => {
  const ReactModule = jest.requireActual<typeof import('react')>('react');
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  class Map extends ReactModule.Component<React.PropsWithChildren<{ onMapReady: () => void }>> {
    animateToRegion = jest.fn();
    fitToCoordinates = jest.fn();
    componentDidMount() {
      this.props.onMapReady();
    }
    render() {
      return ReactModule.createElement(View, null, this.props.children);
    }
  }
  return { __esModule: true, default: Map, Marker: View };
});
jest.mock(
  'react-native-safe-area-context',
  () =>
    jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

beforeEach(() => {
  jest.clearAllMocks();
  resetFixtures();
});

it('protects deep links, signs in with upstream UI, switches real screens, opens postcards on the map, and signs out', async () => {
  await renderRouter(
    {
      _layout: App,
      'sign-in': SignIn,
      '(tabs)/_layout': AppTabs,
      '(tabs)/index': ExploreRoute,
      '(tabs)/postcards': PostcardsRoute,
      '(tabs)/trip': NewTripRoute,
      '(tabs)/saved': SavedRoute,
    },
    { initialUrl: '/postcards' },
  );
  await screen.findByText('Welcome back');
  expect(screen).toHavePathname('/sign-in');
  await fireEvent.changeText(screen.getByPlaceholderText('Email'), 'demo@example.test');
  await fireEvent.changeText(screen.getByPlaceholderText('Password'), 'demo-test-password');
  await fireEvent.press(screen.getByText('Sign in'));
  await screen.findByLabelText('Open Jazz Alley');
  await fireEvent.press(screen.getByRole('button', { name: 'Expand places panel' }));
  await fireEvent.changeText(screen.getByLabelText('Search places'), 'jazz');
  await fireEvent.press(screen.getByLabelText('Open Jazz Alley'));
  await fireEvent.press(screen.getByRole('button', { name: 'Save place' }));
  await screen.findByText('Saved ✓ · Unsave');
  await fireEvent.press(screen.getByLabelText('Saved, tab, 4 of 4'));
  expect(screen).toHavePathname('/saved');
  await screen.findByRole('button', { name: 'Open saved place: Jazz Alley' });
  await fireEvent.press(screen.getByRole('button', { name: 'Unsave Jazz Alley' }));
  await screen.findByText('Save a place in Explore to find it here.');
  await fireEvent.press(screen.getByLabelText('Explore, tab, 1 of 4'));
  await screen.findByRole('button', { name: 'Save place' });
  await fireEvent.press(screen.getByRole('button', { name: 'Save place' }));
  await screen.findByText('Saved ✓ · Unsave');
  await fireEvent.press(screen.getByLabelText('Saved, tab, 4 of 4'));
  await fireEvent.press(
    await screen.findByRole('button', { name: 'Open saved place: Jazz Alley' }),
  );
  expect(screen).toHavePathname('/');
  await screen.findByText('Saved ✓ · Unsave');
  await fireEvent.press(screen.getByLabelText('Close place details'));
  await fireEvent.changeText(screen.getByLabelText('Search places'), 'jazz');
  await fireEvent.press(screen.getByLabelText('Postcards, tab, 2 of 4'));
  await screen.findByText('Postcards from Seattle');
  expect(screen).toHavePathname('/postcards');
  await screen.findByLabelText('Read postcard for Jazz Alley by Maya');
  await fireEvent.press(screen.getByLabelText('Read postcard for Jazz Alley by Maya'));
  await screen.findByLabelText('Show photo for Jazz Alley by Maya');
  await fireEvent.press(screen.getByLabelText('Explore, tab, 1 of 4'));
  expect(screen).toHavePathname('/');
  expect(screen.getByLabelText('Search places')).toHaveDisplayValue('jazz');
  await screen.findByRole('button', { name: 'Saved · 1' });
  await fireEvent.press(screen.getByLabelText('Postcards, tab, 2 of 4'));
  await fireEvent.press(screen.getByLabelText('See place: Jazz Alley, recommended by Maya'));
  // Complete the place handoff while another tab is focused; only Explore's params should clear.
  await fireEvent.press(screen.getByLabelText('Build Trip, tab, 3 of 4'));
  await jest.advanceTimersByTimeAsync(250);
  await fireEvent.press(screen.getByLabelText('Explore, tab, 1 of 4'));
  await screen.findByText('Saved ✓ · Unsave');
  expect(screen).toHavePathname('/');
  await fireEvent.press(screen.getByLabelText('Close place details'));
  expect(await screen.findByLabelText('Search places')).toHaveDisplayValue('');
  await fireEvent.press(screen.getByLabelText('Postcards, tab, 2 of 4'));
  await fireEvent.press(screen.getByLabelText('See place: Jazz Alley, recommended by Maya'));
  await screen.findByText('Saved ✓ · Unsave');
  await fireEvent.press(screen.getByRole('button', { name: 'Unsave place' }));
  await screen.findByText('Removed from Saved. You can save this place again.');
  await fireEvent.press(screen.getByLabelText('Close place details'));
  await fireEvent.press(screen.getByLabelText('Change city: Seattle'));
  await fireEvent.changeText(screen.getByLabelText('City name'), 'Los Angeles');
  await fireEvent.press(screen.getByRole('button', { name: 'Apply city' }));
  await screen.findByText('No places in the catalog for Los Angeles. Change city or refresh.');
  await fireEvent.press(screen.getByLabelText('Postcards, tab, 2 of 4'));
  await fireEvent.press(screen.getByLabelText('See place: Jazz Alley, recommended by Maya'));
  await screen.findByLabelText('Change city: Seattle');
  await screen.findByLabelText('Close place details');
  await fireEvent.press(screen.getByLabelText('Build Trip, tab, 3 of 4'));
  expect(screen).toHavePathname('/trip');
  await screen.findByLabelText('City or destination');
  await fireEvent.press(screen.getByRole('button', { name: 'Seattle' }));
  const today = new Date().toLocaleDateString('en-US', { dateStyle: 'full' });
  await fireEvent.press(screen.getByRole('button', { name: today }));
  await fireEvent.press(screen.getByRole('button', { name: today }));
  const create = fireEvent.press(screen.getByRole('button', { name: 'Create trip' }));
  await jest.advanceTimersByTimeAsync(200);
  await create;
  await screen.findByText('1 day to explore');
  const listing = callApi('listTrips', {});
  await jest.advanceTimersByTimeAsync(200);
  expect((await listing).trips.some((trip) => trip.city === 'Seattle')).toBe(true);
  await fireEvent.press(screen.getByLabelText('Explore, tab, 1 of 4'));
  await screen.findByLabelText('Close place details');
  await fireEvent.press(screen.getByRole('button', { name: 'Sign out' }));
  await screen.findByText('Welcome back');
  expect(screen).toHavePathname('/sign-in');
  expect(screen.queryByLabelText('Postcards, tab, 2 of 4')).toBeNull();
}, 20000);
