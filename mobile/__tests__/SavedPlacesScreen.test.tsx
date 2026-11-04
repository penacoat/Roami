import React from 'react';
import { beforeEach, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import * as api from '../src/api/ApiClient';
import { resetFixtures } from '../src/api';
import { SavedPlacesScreen } from '../src/screens/SavedPlacesScreen';
import { notifySavedPlacesChanged } from '../src/hooks/useSavedPlacesChanges';

jest.mock(
  'react-native-safe-area-context',
  () => require('react-native-safe-area-context/jest/mock').default,
);

beforeEach(() => {
  jest.restoreAllMocks();
  resetFixtures();
});

it('loads saved places through the API, opens details, and removes the save', async () => {
  await api.callApi('savePlace', { placeId: 'p-jazz', recommendationId: 'r1' });
  const open = jest.fn();
  await render(<SavedPlacesScreen refreshKey={1} onExplore={jest.fn()} onOpenPlace={open} />);
  await fireEvent.press(
    await screen.findByRole('button', { name: 'Open saved place: Jazz Alley' }),
  );
  expect(open).toHaveBeenCalledWith('p-jazz');
  await fireEvent.press(screen.getByRole('button', { name: 'Unsave Jazz Alley' }));
  await screen.findByText('Save a place in Explore to find it here.');
  expect((await api.callApi('listSavedPlaces', {})).saved).toHaveLength(0);
});

it('refreshes when returning after a save on another screen', async () => {
  const props = { onExplore: jest.fn(), onOpenPlace: jest.fn() };
  const view = await render(<SavedPlacesScreen {...props} refreshKey={1} />);
  await screen.findByText('Save a place in Explore to find it here.');
  await api.callApi('savePlace', { placeId: 'p-pike' });
  await view.rerender(<SavedPlacesScreen {...props} refreshKey={2} />);
  await screen.findByRole('button', { name: 'Open saved place: Pike Place Market' });
});

it('keeps a place when unsave fails, then lets the user retry', async () => {
  await api.callApi('savePlace', { placeId: 'p-jazz' });
  await render(<SavedPlacesScreen refreshKey={1} onExplore={jest.fn()} onOpenPlace={jest.fn()} />);
  await screen.findByRole('button', { name: 'Unsave Jazz Alley' });
  jest.spyOn(api, 'callApi').mockRejectedValueOnce(new Error('offline'));
  await fireEvent.press(screen.getByRole('button', { name: 'Unsave Jazz Alley' }));
  await screen.findByText('Could not unsave this place. Please try again.');
  expect(screen.getByRole('button', { name: 'Open saved place: Jazz Alley' })).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Unsave Jazz Alley' }));
  await screen.findByText('Save a place in Explore to find it here.');
});

it('refreshes when a save finishes after the user has already opened Saved', async () => {
  await render(<SavedPlacesScreen refreshKey={1} onExplore={jest.fn()} onOpenPlace={jest.fn()} />);
  await screen.findByText('Save a place in Explore to find it here.');
  await act(async () => {
    await api.callApi('savePlace', { placeId: 'p-jazz' });
    notifySavedPlacesChanged('explore');
  });
  await screen.findByRole('button', { name: 'Open saved place: Jazz Alley' });
});

it('blocks repeated unsave taps while the write is pending', async () => {
  await api.callApi('savePlace', { placeId: 'p-jazz' });
  await render(<SavedPlacesScreen refreshKey={1} onExplore={jest.fn()} onOpenPlace={jest.fn()} />);
  await screen.findByRole('button', { name: 'Unsave Jazz Alley' });
  let finish: (value: { removed: true }) => void = () => {};
  const response = new Promise<{ removed: true }>((resolve) => {
    finish = resolve;
  });
  const request = jest.spyOn(api, 'callApi').mockReturnValueOnce(response);
  await fireEvent.press(screen.getByRole('button', { name: 'Unsave Jazz Alley' }));
  expect(screen.getByRole('button', { name: 'Unsave Jazz Alley' })).toBeDisabled();
  await fireEvent.press(screen.getByRole('button', { name: 'Unsave Jazz Alley' }));
  expect(request).toHaveBeenCalledTimes(1);
  await act(async () => {
    finish({ removed: true });
  });
  await screen.findByText('Save a place in Explore to find it here.');
});

it('distinguishes failed loading from an empty list and recovers', async () => {
  jest.spyOn(api, 'callApi').mockRejectedValueOnce(new Error('offline'));
  const explore = jest.fn();
  await render(<SavedPlacesScreen refreshKey={1} onExplore={explore} onOpenPlace={jest.fn()} />);
  await screen.findByText('Could not load saved places. Please try again.');
  expect(screen.queryByText('Save a place in Explore to find it here.')).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Retry saved places' }));
  await fireEvent.press(await screen.findByRole('button', { name: 'Explore places' }));
  expect(explore).toHaveBeenCalledTimes(1);
});
