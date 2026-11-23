import React from 'react';
import { beforeEach, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import * as api from '../src/api/ApiClient';
import { resetFixtures } from '../src/api';
import { ItinerariesScreen } from '../src/screens/ItinerariesScreen';

jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return { SafeAreaView: View };
});

beforeEach(() => {
  jest.restoreAllMocks();
  resetFixtures();
});

it('pulls new itineraries from an empty list and can retry a failed pull', async () => {
  const open = jest.fn();
  await render(<ItinerariesScreen refreshKey={1} onOpen={open} onCreate={jest.fn()} />);
  await screen.findByText('No itineraries yet.');
  const { trip } = await api.callApi('createTrip', {
    city: 'Seattle',
    startDate: '2026-11-23',
    endDate: '2026-11-24',
    dailyWindow: { start: '09:00', end: '21:00' },
  });
  await act(async () =>
    screen.getByTestId('itineraries-list').props.refreshControl.props.onRefresh(),
  );
  await fireEvent.press(await screen.findByLabelText('Open itinerary: Seattle, Nov 23, 2026'));
  expect(open).toHaveBeenCalledWith(trip.trip.id);
  expect(screen.getByTestId('itineraries-list').props.refreshControl.props.refreshing).toBe(false);

  jest.spyOn(api, 'callApi').mockRejectedValueOnce(new Error('offline'));
  await act(async () =>
    screen.getByTestId('itineraries-list').props.refreshControl.props.onRefresh(),
  );
  await screen.findByText('Could not load itineraries. Try again.');
  expect(screen.getByLabelText('Open itinerary: Seattle, Nov 23, 2026')).toBeTruthy();
  expect(screen.getByTestId('itineraries-list').props.refreshControl.props.refreshing).toBe(false);
  await act(async () =>
    screen.getByTestId('itineraries-list').props.refreshControl.props.onRefresh(),
  );
  await screen.findByLabelText('Open itinerary: Seattle, Nov 23, 2026');
});
