import React from 'react';
import { beforeEach, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import * as api from '../src/api/ApiClient';
import { resetFixtures } from '../src/api';
import { RecommendationsScreen } from '../src/components/recommendations/recommendationsScreen';
import { CityProvider, useCity } from '../src/cities/CityProvider';
import { testCities } from '../test-utils/cities';
import { Pressable } from 'react-native';

jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return { SafeAreaView: View };
});

beforeEach(() => {
  jest.restoreAllMocks();
  resetFixtures();
});

it('flips the existing postcard and opens its actual catalog place', async () => {
  const open = jest.fn();
  await render(<RecommendationsScreen onOpenPlace={open} />);
  await screen.findByLabelText('Read postcard for Jazz Alley by Maya');
  expect(screen.getAllByText(/Sample postcard/).length).toBeGreaterThan(0);
  expect(screen.queryByText(/Demo postcards/)).toBeNull();
  expect(screen.queryByText(/@maya/)).toBeNull();
  await fireEvent.press(screen.getByLabelText('Read postcard for Jazz Alley by Maya'));
  await screen.findByLabelText('Show photo for Jazz Alley by Maya');
  await fireEvent.press(screen.getByLabelText('See place: Jazz Alley, recommended by Maya'));
  expect(open).toHaveBeenCalledWith('p-jazz', 'r1');
});

it('shows a feed failure and recovers through retry', async () => {
  const original = api.callApi;
  let fail = true;
  jest.spyOn(api, 'callApi').mockImplementation((name, request) => {
    if (name === 'getFeed' && fail) return Promise.reject(new Error('offline'));
    return original(name, request);
  });
  await render(<RecommendationsScreen onOpenPlace={jest.fn()} />);
  await screen.findByText('Could not load postcards. Check your connection and try again.');
  fail = false;
  await fireEvent.press(screen.getByRole('button', { name: 'Retry postcards' }));
  await screen.findByLabelText('See place: Jazz Alley, recommended by Maya');
});

it('explains an empty feed without inventing postcards', async () => {
  jest.spyOn(api, 'callApi').mockResolvedValue({ items: [] });
  await render(<RecommendationsScreen onOpenPlace={jest.fn()} />);
  await screen.findByText('No postcards for Seattle yet.');
  expect(screen.queryByText('See place ›')).toBeNull();
});

it('keeps existing postcards after a failed refresh', async () => {
  await render(<RecommendationsScreen onOpenPlace={jest.fn()} />);
  await screen.findByLabelText('See place: Jazz Alley, recommended by Maya');
  jest.spyOn(api, 'callApi').mockRejectedValueOnce(new Error('offline'));
  await act(async () =>
    screen.getByTestId('postcards-list').props.refreshControl.props.onRefresh(),
  );
  await screen.findByText('Could not load postcards. Check your connection and try again.');
  expect(screen.getByLabelText('See place: Jazz Alley, recommended by Maya')).toBeTruthy();
  expect(screen.getByTestId('postcards-list').props.refreshControl.props.refreshing).toBe(false);
});

it('never relabels old postcards as a new city after failed loading and retry', async () => {
  function CitySwitch() {
    const { setCity } = useCity();
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Switch city"
        onPress={() => setCity(testCities[1])}
      />
    );
  }
  await render(
    <CityProvider>
      <CitySwitch />
      <RecommendationsScreen onOpenPlace={jest.fn()} />
    </CityProvider>,
  );
  await screen.findByLabelText('See place: Jazz Alley, recommended by Maya');
  jest.spyOn(api, 'callApi').mockRejectedValue(new Error('offline'));
  await fireEvent.press(screen.getByRole('button', { name: 'Switch city' }));
  await screen.findByText('Could not load postcards. Check your connection and try again.');
  expect(screen.queryByLabelText('See place: Jazz Alley, recommended by Maya')).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Retry postcards' }));
  await screen.findByText('Could not load postcards. Check your connection and try again.');
  expect(screen.queryByLabelText('See place: Jazz Alley, recommended by Maya')).toBeNull();
});

it('keeps postcards during a pull, updates the feed, and finishes a failed refresh', async () => {
  await render(<RecommendationsScreen onOpenPlace={jest.fn()} />);
  await screen.findByLabelText('See place: Jazz Alley, recommended by Maya');
  const original = api.callApi;
  let complete!: () => void;
  let fail = false;
  const calls = jest.spyOn(api, 'callApi').mockImplementation((name, request) => {
    if (name === 'getFeed') {
      if (fail) return Promise.reject(new Error('offline'));
      return new Promise((resolve) => {
        complete = () => resolve({ items: [] });
      });
    }
    return original(name, request);
  });
  await act(async () =>
    screen.getByTestId('postcards-list').props.refreshControl.props.onRefresh(),
  );
  expect(screen.getByTestId('postcards-list').props.refreshControl.props.refreshing).toBe(true);
  expect(screen.getByLabelText('See place: Jazz Alley, recommended by Maya')).toBeTruthy();
  await act(async () => complete());
  await screen.findByText('No postcards for Seattle yet.');
  expect(screen.getByTestId('postcards-list').props.refreshControl.props.refreshing).toBe(false);
  fail = true;
  await act(async () =>
    screen.getByTestId('postcards-list').props.refreshControl.props.onRefresh(),
  );
  await screen.findByText('Could not load postcards. Check your connection and try again.');
  expect(screen.getByTestId('postcards-list').props.refreshControl.props.refreshing).toBe(false);
  calls.mockImplementation(original);
  await act(async () =>
    screen.getByTestId('postcards-list').props.refreshControl.props.onRefresh(),
  );
  await screen.findByLabelText('See place: Jazz Alley, recommended by Maya');
});
