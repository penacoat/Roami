import React from 'react';
import { beforeEach, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

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
  const original = api.callApi;
  jest.spyOn(api, 'callApi').mockImplementation((name, request) => {
    if (name === 'getFeed') return Promise.resolve({ items: [] });
    return original(name, request);
  });
  await render(<RecommendationsScreen onOpenPlace={jest.fn()} />);
  await screen.findByText('No postcards for Seattle yet.');
  expect(screen.queryByText('See place ›')).toBeNull();
});

it('follows a postcard author and shows their recommendations in the Following feed', async () => {
  await render(<RecommendationsScreen onOpenPlace={jest.fn()} />);
  await screen.findByLabelText('Read postcard for Jazz Alley by Maya');
  await fireEvent.press(screen.getAllByRole('button', { name: 'Follow Maya' })[0]);
  await waitFor(() =>
    expect(screen.getAllByText('Following · Unfollow').length).toBeGreaterThan(0),
  );
  await fireEvent.press(screen.getByRole('button', { name: 'Following' }));
  await screen.findByText('Following · Seattle');
  await screen.findByLabelText('Read postcard for Jazz Alley by Maya');
  expect(screen.queryByLabelText(/by .* other than Maya/)).toBeNull();
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

async function twoPages() {
  const original = api.callApi;
  const { items } = await original('getFeed', { city: 'Seattle' });
  expect(items.length).toBeGreaterThan(2);
  const first = items.slice(0, 2);
  const rest = items.slice(2);
  const calls: unknown[] = [];
  jest.spyOn(api, 'callApi').mockImplementation(((name: string, request: unknown) => {
    if (name !== 'getFeed') return original(name as 'getFeed', request as never);
    calls.push(request);
    const cursor = (request as { cursor?: string }).cursor;
    return Promise.resolve(
      cursor === undefined
        ? { items: first, nextCursor: 'page-2' }
        : { items: rest, nextCursor: null },
    );
  }) as typeof api.callApi);
  return { first, rest, calls };
}

it('loads more postcards below the ones shown, then hides the button', async () => {
  const { first, rest, calls } = await twoPages();
  await render(<RecommendationsScreen onOpenPlace={jest.fn()} />);
  await screen.findByLabelText(new RegExp(`^Read postcard for ${first[0]!.place.name}`));
  expect(
    screen.queryByLabelText(new RegExp(`^Read postcard for ${rest[0]!.place.name} by`)),
  ).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Load more postcards' }));
  await screen.findAllByLabelText(/^Read postcard for/);
  await waitForCount(first.length + rest.length);
  expect(calls[1]).toEqual({ city: 'Seattle', cursor: 'page-2' });
  expect(screen.queryByRole('button', { name: 'Load more postcards' })).toBeNull();
});

it('keeps the postcards and offers a retry when loading more fails', async () => {
  const { first } = await twoPages();
  const paged = jest.mocked(api.callApi).getMockImplementation()!;
  let fail = true;
  jest.spyOn(api, 'callApi').mockImplementation(((name: string, request: unknown) => {
    if (name === 'getFeed' && (request as { cursor?: string }).cursor && fail) {
      return Promise.reject(new Error('offline'));
    }
    return paged(name as 'getFeed', request as never);
  }) as typeof api.callApi);
  await render(<RecommendationsScreen onOpenPlace={jest.fn()} />);
  await fireEvent.press(await screen.findByRole('button', { name: 'Load more postcards' }));
  await screen.findByText('Could not load more postcards. Please try again.');
  expect(screen.getAllByLabelText(/^Read postcard for/)).toHaveLength(first.length);
  fail = false;
  await fireEvent.press(screen.getByRole('button', { name: 'Retry loading more' }));
  await waitFor(() =>
    expect(screen.queryByRole('button', { name: 'Retry loading more' })).toBeNull(),
  );
  expect(screen.getAllByLabelText(/^Read postcard for/).length).toBeGreaterThan(first.length);
});

it('shows no Load more button when everything fits on one page', async () => {
  await render(<RecommendationsScreen onOpenPlace={jest.fn()} />);
  await screen.findByLabelText('Read postcard for Jazz Alley by Maya');
  expect(screen.queryByRole('button', { name: 'Load more postcards' })).toBeNull();
});

async function waitForCount(count: number) {
  await waitFor(() => expect(screen.getAllByLabelText(/^Read postcard for/)).toHaveLength(count));
}

it('discards an old pagination response after changing cities and forwards the new city ID', async () => {
  const { rest } = await twoPages();
  const paged = jest.mocked(api.callApi).getMockImplementation()!;
  let finish!: () => void;
  const calls = jest.spyOn(api, 'callApi').mockImplementation((name, request) => {
    if (name === 'getFeed' && 'cursor' in request)
      return new Promise((resolve) => {
        finish = () => resolve({ items: rest, nextCursor: null });
      });
    if (name === 'getFeed' && 'city' in request && request.city === 'Portland')
      return Promise.resolve({ items: [], nextCursor: null });
    return paged(name, request);
  });
  function CitySwitch() {
    const { setCity } = useCity();
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Switch city"
        onPress={() => setCity({ ...testCities[1], cityId: 'osm-relation-186579' })}
      />
    );
  }
  await render(
    <CityProvider>
      <CitySwitch />
      <RecommendationsScreen onOpenPlace={jest.fn()} />
    </CityProvider>,
  );
  await fireEvent.press(await screen.findByRole('button', { name: 'Load more postcards' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Switch city' }));
  await screen.findByText('No postcards for Portland yet.');
  await act(async () => finish());
  expect(screen.queryAllByLabelText(/^Read postcard for/)).toHaveLength(0);
  expect(calls).toHaveBeenCalledWith('getFeed', {
    city: 'Portland',
    cityId: 'osm-relation-186579',
  });
});
