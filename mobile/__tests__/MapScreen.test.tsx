import React from 'react';
import { Linking } from 'react-native';
import { beforeEach, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import * as api from '../src/api/ApiClient';
import { resetFixtures } from '../src/api';
import { MapScreen } from '../src/screens/MapScreen';

// Keep user interactions real while replacing the native map surface.
jest.mock('react-native-maps', () => {
  const ReactModule = jest.requireActual<typeof import('react')>('react');
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  const animate = jest.fn();
  const fit = jest.fn();
  class Map extends ReactModule.Component<React.PropsWithChildren<{ onMapReady: () => void }>> {
    animateToRegion = animate;
    fitToCoordinates = fit;
    componentDidMount() {
      this.props.onMapReady();
    }
    render() {
      return ReactModule.createElement(View, null, this.props.children);
    }
  }
  return { __esModule: true, default: Map, Marker: View, mapCalls: { animate, fit } };
});

jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return { SafeAreaView: View };
});

beforeEach(() => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
  resetFixtures();
});

it('explains an unavailable postcard target instead of opening an unrelated place', async () => {
  const consumed = jest.fn();
  await render(
    <MapScreen
      onSignOut={jest.fn<() => Promise<void>>().mockResolvedValue(undefined)}
      requestedPlaceId="removed-place"
      onPlaceRequestHandled={consumed}
    />,
  );
  await screen.findByText('This place is no longer available in the Seattle catalog.');
  expect(screen.queryByLabelText('Close place details')).toBeNull();
  expect(consumed).toHaveBeenCalledTimes(1);
});

it('opens a map pin, saves its recommendation source, and finds it in Saved', async () => {
  await render(
    <MapScreen onSignOut={jest.fn<() => Promise<void>>().mockResolvedValue(undefined)} />,
  );
  await screen.findByLabelText('Map pin for Jazz Alley');
  await fireEvent.press(screen.getByLabelText('Map pin for Jazz Alley'));
  await screen.findByRole('button', { name: 'Save recommendation by Maya' });
  await fireEvent.press(screen.getByRole('button', { name: 'Save recommendation by Maya' }));
  await screen.findByText('Saved with this recommendation.');
  const { saved } = await api.callApi('listSavedPlaces', {});
  expect(saved).toHaveLength(1);
  expect(saved[0].place.id).toBe('p-jazz');
  expect(saved[0].recommendations.map((rec) => rec.id)).toEqual(['r1']);
  await fireEvent.press(screen.getByLabelText('Close place details'));
  await fireEvent.press(screen.getByRole('button', { name: 'Saved · 1' }));
  await screen.findByLabelText('Open Jazz Alley');
  expect(screen.queryByLabelText('Map pin for Pike Place Market')).toBeNull();
});

it('filters names and categories and explains an empty result', async () => {
  await render(
    <MapScreen onSignOut={jest.fn<() => Promise<void>>().mockResolvedValue(undefined)} />,
  );
  await screen.findByLabelText('Open Pike Place Market');
  await fireEvent.changeText(screen.getByLabelText('Search places'), 'MUSEUM');
  expect(screen.getByLabelText('Open Seattle Art Museum')).toBeTruthy();
  expect(screen.queryByLabelText('Map pin for Jazz Alley')).toBeNull();
  await fireEvent.changeText(screen.getByLabelText('Search places'), 'nothing-matches');
  await screen.findByText('No places match. Clear the search or change a category.');
});

it('derives category chips from the catalog and combines category, text, and saved filters', async () => {
  await api.callApi('savePlace', { placeId: 'p-sam' });
  await render(
    <MapScreen onSignOut={jest.fn<() => Promise<void>>().mockResolvedValue(undefined)} />,
  );
  await screen.findByLabelText('Filter category: Museum');
  expect(screen.queryByLabelText('Filter category: Shopping')).toBeNull();
  await fireEvent.press(screen.getByLabelText('Filter category: Museum'));
  expect(screen.getByLabelText('Map pin for Seattle Art Museum')).toBeTruthy();
  expect(screen.queryByLabelText('Map pin for Jazz Alley')).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Saved · 1' }));
  await screen.findByLabelText('Open Seattle Art Museum');
  expect(screen.queryByLabelText('Map pin for Chihuly Garden and Glass')).toBeNull();
  await fireEvent.changeText(screen.getByLabelText('Search places'), 'Seattle');
  expect(screen.getByLabelText('Map pin for Seattle Art Museum')).toBeTruthy();
});

it('queries the requested city and clears places from the previous city', async () => {
  const calls = jest.spyOn(api, 'callApi');
  await render(
    <MapScreen onSignOut={jest.fn<() => Promise<void>>().mockResolvedValue(undefined)} />,
  );
  await screen.findByLabelText('Open Pike Place Market');
  await fireEvent.press(screen.getByLabelText('Change city: Seattle'));
  await fireEvent.changeText(screen.getByLabelText('City name'), '  Portland  ');
  await fireEvent.press(screen.getByRole('button', { name: 'Apply city' }));
  await screen.findByText('No places in the catalog for Portland. Change city or refresh.');
  expect(calls).toHaveBeenCalledWith('listPlaces', { city: 'Portland' });
  expect(screen.queryByLabelText('Map pin for Pike Place Market')).toBeNull();
});

it('finds a place through recommendation text even when its name and category do not match', async () => {
  await render(
    <MapScreen onSignOut={jest.fn<() => Promise<void>>().mockResolvedValue(undefined)} />,
  );
  await screen.findByLabelText('Open Kerry Park');
  await fireEvent.changeText(screen.getByLabelText('Search places'), 'sunset');
  await waitFor(() => expect(screen.getByLabelText('Open Kerry Park')).toBeTruthy());
});

it('labels failed recommendation search honestly and recovers through retry', async () => {
  const original = api.callApi;
  let fail = true;
  jest.spyOn(api, 'callApi').mockImplementation((name, request) => {
    if (name === 'searchRecommendations' && fail) return Promise.reject(new Error('offline'));
    return original(name, request);
  });
  await render(
    <MapScreen onSignOut={jest.fn<() => Promise<void>>().mockResolvedValue(undefined)} />,
  );
  await screen.findByLabelText('Open Kerry Park');
  await fireEvent.changeText(screen.getByLabelText('Search places'), 'sunset');
  await screen.findByText(
    'Recommendation search is unavailable. Showing name/category matches only.',
  );
  expect(screen.queryByLabelText('Map pin for Kerry Park')).toBeNull();
  fail = false;
  await fireEvent.press(screen.getByRole('button', { name: 'Retry search' }));
  await screen.findByLabelText('Open Kerry Park');
});

it('ignores an old search response after the query changes', async () => {
  const original = api.callApi;
  const lemonResult = await original('searchRecommendations', {
    text: 'jazz',
    interests: [],
    city: 'Seattle',
  });
  let finish!: (value: typeof lemonResult) => void;
  jest.spyOn(api, 'callApi').mockImplementation((name, request) => {
    if (name === 'searchRecommendations' && 'text' in request && request.text === 'jazz') {
      return new Promise((resolve) => {
        finish = resolve as typeof finish;
      });
    }
    return original(name, request);
  });
  await render(
    <MapScreen onSignOut={jest.fn<() => Promise<void>>().mockResolvedValue(undefined)} />,
  );
  await screen.findByLabelText('Open Jazz Alley');
  await fireEvent.changeText(screen.getByLabelText('Search places'), 'jazz');
  await waitFor(() => expect(finish).toBeDefined());
  await fireEvent.changeText(screen.getByLabelText('Search places'), 'museum');
  await screen.findByLabelText('Open Seattle Art Museum');
  await act(async () => finish(lemonResult));
  expect(screen.queryByLabelText('Map pin for Jazz Alley')).toBeNull();
});

it('fits catalog coordinates and sends zoom and selected-place updates to the native map', async () => {
  const { mapCalls } = jest.requireMock('react-native-maps') as {
    mapCalls: { animate: ReturnType<typeof jest.fn>; fit: ReturnType<typeof jest.fn> };
  };
  await render(
    <MapScreen onSignOut={jest.fn<() => Promise<void>>().mockResolvedValue(undefined)} />,
  );
  await screen.findByLabelText('Open Jazz Alley');
  expect(mapCalls.fit).toHaveBeenCalled();
  await fireEvent.press(screen.getByRole('button', { name: 'Zoom in' }));
  expect(mapCalls.animate).toHaveBeenLastCalledWith(
    expect.objectContaining({ latitudeDelta: 0.03 }),
    200,
  );
  await fireEvent.press(screen.getByRole('button', { name: 'Zoom out' }));
  expect(mapCalls.animate).toHaveBeenLastCalledWith(
    expect.objectContaining({ latitudeDelta: 0.06 }),
    200,
  );
  await fireEvent.press(screen.getByLabelText('Map pin for Jazz Alley'));
  expect(mapCalls.animate).toHaveBeenLastCalledWith(
    expect.objectContaining({ latitude: 47.6139, longitude: -122.3417 }),
    250,
  );
});

it('treats unknown hours as unknown', async () => {
  jest.spyOn(api, 'getApiMode').mockReturnValue('live');
  await render(
    <MapScreen onSignOut={jest.fn<() => Promise<void>>().mockResolvedValue(undefined)} />,
  );
  await screen.findByLabelText('Open Kerry Park');
  await fireEvent.press(screen.getByLabelText('Open Kerry Park'));
  expect(screen.getByText('Hours not provided')).toBeTruthy();
});

it('recovers from a failed place load through Retry', async () => {
  jest.spyOn(api, 'callApi').mockRejectedValueOnce(new Error('offline'));
  await render(
    <MapScreen onSignOut={jest.fn<() => Promise<void>>().mockResolvedValue(undefined)} />,
  );
  await screen.findByRole('button', { name: 'Retry places' });
  await fireEvent.press(screen.getByRole('button', { name: 'Retry places' }));
  await screen.findByLabelText('Open Pike Place Market');
});

it('does not claim a failed save succeeded and allows retry', async () => {
  await render(
    <MapScreen onSignOut={jest.fn<() => Promise<void>>().mockResolvedValue(undefined)} />,
  );
  await screen.findByLabelText('Open Pike Place Market');
  await fireEvent.press(screen.getByLabelText('Open Pike Place Market'));
  await screen.findByRole('button', { name: 'Save recommendation by Maya' });
  jest.spyOn(api, 'callApi').mockRejectedValueOnce(new Error('offline'));
  await fireEvent.press(screen.getByRole('button', { name: 'Save place' }));
  await screen.findByText('Could not save. Please try again.');
  expect(screen.queryByText('Saved ✓ · Unsave')).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Save place' }));
  await screen.findByText('Saved ✓ · Unsave');
});

it('opens the exact supplied source URL and reports a failed handoff', async () => {
  await api.callApi('createRecommendation', {
    placeId: 'p-jazz',
    description: 'Test source',
    tags: ['jazz'],
    sourceLinks: ['https://www.jazzalley.com/'],
  });
  const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
  await render(
    <MapScreen onSignOut={jest.fn<() => Promise<void>>().mockResolvedValue(undefined)} />,
  );
  await screen.findByLabelText('Open Jazz Alley');
  await fireEvent.press(screen.getByLabelText('Open Jazz Alley'));
  const link = await screen.findByRole('link', { name: 'Open source: jazzalley.com' });
  await fireEvent.press(link);
  expect(open).toHaveBeenCalledWith('https://www.jazzalley.com/');
  open.mockRejectedValueOnce(new Error('Cannot open'));
  await fireEvent.press(link);
  await screen.findByText('Could not open the link. Try again.');
});

it('does not invent a venue link when the catalog supplies none', async () => {
  await render(
    <MapScreen onSignOut={jest.fn<() => Promise<void>>().mockResolvedValue(undefined)} />,
  );
  await screen.findByLabelText('Open Jazz Alley');
  await fireEvent.press(screen.getByLabelText('Open Jazz Alley'));
  await screen.findByText('No source link provided.');
  expect(screen.queryAllByRole('link')).toHaveLength(0);
});

it('omits malformed and non-web source URLs', async () => {
  await api.callApi('createRecommendation', {
    placeId: 'p-jazz',
    description: 'Test source',
    tags: [],
    sourceLinks: ['https://', 'javascript:alert(1)', 'https://user:password@example.test/'],
  });
  await render(
    <MapScreen onSignOut={jest.fn<() => Promise<void>>().mockResolvedValue(undefined)} />,
  );
  await screen.findByLabelText('Open Jazz Alley');
  await fireEvent.press(screen.getByLabelText('Open Jazz Alley'));
  await screen.findByText('No source link provided.');
  expect(screen.queryAllByRole('link')).toHaveLength(0);
});

it('does not present emulator sample hours or authors as verified venue details', async () => {
  const previous = process.env.EXPO_PUBLIC_EMULATOR_HOST;
  process.env.EXPO_PUBLIC_EMULATOR_HOST = '127.0.0.1';
  jest.spyOn(api, 'getApiMode').mockReturnValue('live');
  try {
    await render(
      <MapScreen onSignOut={jest.fn<() => Promise<void>>().mockResolvedValue(undefined)} />,
    );
    await screen.findByLabelText('Open Jazz Alley');
    expect(screen.getByText('Demo data · places and details unverified')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Open Jazz Alley'));
    await screen.findByText('Demo recommendation by Maya');
    expect(screen.getByText('Demo hours · not verified')).toBeTruthy();
    expect(screen.queryByText(/18:00-23:00/)).toBeNull();
  } finally {
    if (previous === undefined) delete process.env.EXPO_PUBLIC_EMULATOR_HOST;
    else process.env.EXPO_PUBLIC_EMULATOR_HOST = previous;
  }
});

it('expands and collapses the places panel without losing the selected place or filters', async () => {
  await render(
    <MapScreen onSignOut={jest.fn<() => Promise<void>>().mockResolvedValue(undefined)} />,
  );
  await screen.findByLabelText('Map pin for Jazz Alley');
  await fireEvent.press(screen.getByRole('button', { name: 'Expand places panel' }));
  expect(screen.getByRole('button', { name: 'Collapse places panel' })).toBeTruthy();
  await fireEvent.changeText(screen.getByLabelText('Search places'), 'jazz');
  await fireEvent.press(screen.getByLabelText('Map pin for Jazz Alley'));
  await screen.findByRole('button', { name: 'Save recommendation by Maya' });
  await fireEvent.press(screen.getByRole('button', { name: 'Collapse places panel' }));
  expect(screen.getByRole('button', { name: 'Expand places panel' })).toBeTruthy();
  expect(screen.getByText('Jazz Alley')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Expand places panel' }));
  await fireEvent.press(screen.getByLabelText('Close place details'));
  expect(screen.getByLabelText('Search places')).toHaveDisplayValue('jazz');
});

it('unsaves through the service, updates Saved, and allows saving the place again', async () => {
  await api.callApi('savePlace', { placeId: 'p-jazz', recommendationId: 'r1' });
  await render(
    <MapScreen onSignOut={jest.fn<() => Promise<void>>().mockResolvedValue(undefined)} />,
  );
  await screen.findByRole('button', { name: 'Saved · 1' });
  await fireEvent.press(screen.getByRole('button', { name: 'Saved · 1' }));
  await screen.findByLabelText('Open Jazz Alley');
  await fireEvent.press(screen.getByLabelText('Open Jazz Alley'));
  await screen.findByText('Recommendation saved ✓');
  expect(screen.getByRole('button', { name: 'Save recommendation by Maya' })).toBeDisabled();
  await fireEvent.press(screen.getByRole('button', { name: 'Unsave place' }));
  await screen.findByText('Removed from Saved. You can save this place again.');
  expect((await api.callApi('listSavedPlaces', {})).saved).toHaveLength(0);
  expect(screen.getByRole('button', { name: 'Save recommendation by Maya' })).toBeEnabled();
  await fireEvent.press(screen.getByLabelText('Close place details'));
  await screen.findByRole('button', { name: 'Saved · 0' });
  expect(screen.queryByLabelText('Open Jazz Alley')).toBeNull();
  await screen.findByText('No saved places match these filters.');
  await fireEvent.press(screen.getByRole('button', { name: 'Saved · 0' }));
  await screen.findByLabelText('Open Jazz Alley');
  await fireEvent.press(screen.getByLabelText('Open Jazz Alley'));
  await fireEvent.press(screen.getByRole('button', { name: 'Save place' }));
  await screen.findByText('Saved ✓ · Unsave');
  expect((await api.callApi('listSavedPlaces', {})).saved).toHaveLength(1);
});

it('keeps a failed unsave visibly saved and lets the user retry', async () => {
  await api.callApi('savePlace', { placeId: 'p-jazz' });
  const original = api.callApi;
  let fail = true;
  jest.spyOn(api, 'callApi').mockImplementation((name, request) => {
    if (name === 'removeSavedPlace' && fail) return Promise.reject(new Error('offline'));
    return original(name, request);
  });
  await render(
    <MapScreen onSignOut={jest.fn<() => Promise<void>>().mockResolvedValue(undefined)} />,
  );
  await screen.findByLabelText('Open Jazz Alley');
  await fireEvent.press(screen.getByLabelText('Open Jazz Alley'));
  await fireEvent.press(screen.getByRole('button', { name: 'Unsave place' }));
  await screen.findByText('Could not unsave. Please try again.');
  expect(screen.getByText('Saved ✓ · Unsave')).toBeTruthy();
  expect((await original('listSavedPlaces', {})).saved).toHaveLength(1);
  fail = false;
  await fireEvent.press(screen.getByRole('button', { name: 'Unsave place' }));
  await screen.findByText('Removed from Saved. You can save this place again.');
  expect((await original('listSavedPlaces', {})).saved).toHaveLength(0);
});

it('blocks repeated unsave taps even after the detail card is closed and reopened', async () => {
  await api.callApi('savePlace', { placeId: 'p-jazz' });
  const original = api.callApi;
  let complete!: () => void;
  const calls = jest.spyOn(api, 'callApi').mockImplementation((name, request) => {
    if (name === 'removeSavedPlace')
      return new Promise((resolve) => {
        complete = () => {
          void original('removeSavedPlace', { placeId: 'p-jazz' }).then(resolve);
        };
      });
    return original(name, request);
  });
  await render(
    <MapScreen onSignOut={jest.fn<() => Promise<void>>().mockResolvedValue(undefined)} />,
  );
  await screen.findByLabelText('Open Jazz Alley');
  await fireEvent.press(screen.getByLabelText('Open Jazz Alley'));
  await fireEvent.press(screen.getByRole('button', { name: 'Unsave place' }));
  expect(screen.getByText('Removing…')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Unsave place' })).toBeDisabled();
  await fireEvent.press(screen.getByLabelText('Close place details'));
  await fireEvent.press(screen.getByLabelText('Open Jazz Alley'));
  await fireEvent.press(screen.getByRole('button', { name: 'Unsave place' }));
  expect(calls.mock.calls.filter(([name]) => name === 'removeSavedPlace')).toHaveLength(1);
  await act(async () => complete());
  await screen.findByText('Removed from Saved. You can save this place again.');
});

it('keeps the selected map view steady when saving and unsaving', async () => {
  const { mapCalls } = jest.requireMock('react-native-maps') as {
    mapCalls: { animate: ReturnType<typeof jest.fn>; fit: ReturnType<typeof jest.fn> };
  };
  await render(
    <MapScreen onSignOut={jest.fn<() => Promise<void>>().mockResolvedValue(undefined)} />,
  );
  await screen.findByLabelText('Open Jazz Alley');
  await fireEvent.press(screen.getByLabelText('Open Jazz Alley'));
  mapCalls.animate.mockClear();
  mapCalls.fit.mockClear();
  await fireEvent.press(screen.getByRole('button', { name: 'Save place' }));
  await screen.findByText('Saved ✓ · Unsave');
  await fireEvent.press(screen.getByRole('button', { name: 'Unsave place' }));
  await screen.findByText('Removed from Saved. You can save this place again.');
  expect(mapCalls.animate).not.toHaveBeenCalled();
  expect(mapCalls.fit).not.toHaveBeenCalled();
});
