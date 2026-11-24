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

async function makeTrip(city: string, startDate: string) {
  const { trip } = await api.callApi('createTrip', {
    city,
    startDate,
    endDate: startDate,
    dailyWindow: { start: '09:00', end: '21:00' },
  });
  return trip.trip.id;
}

const props = { refreshKey: 1, onOpen: jest.fn(), onCreate: jest.fn() };

it('archives a trip out of the main list and shows it under archived itineraries', async () => {
  await makeTrip('Seattle', '2026-10-01');
  await makeTrip('Portland', '2026-11-01');
  await render(<ItinerariesScreen {...props} />);
  await fireEvent.press(await screen.findByRole('button', { name: 'Archive Seattle itinerary' }));
  await screen.findByText('Seattle archived. Find it under Archived itineraries.');
  expect(screen.queryByRole('button', { name: /^Open itinerary: Seattle/ })).toBeNull();
  expect(screen.getByRole('button', { name: /^Open itinerary: Portland/ })).toBeTruthy();

  await fireEvent.press(screen.getByRole('button', { name: 'Show archived itineraries (1)' }));
  expect(screen.getByRole('button', { name: /^Open itinerary: Seattle/ })).toBeTruthy();
  expect((await api.callApi('listTrips', {})).trips.map((t) => !!t.archivedAt)).toEqual([
    true,
    false,
  ]);
});

it('unarchives a trip back into the main list', async () => {
  const id = await makeTrip('Seattle', '2026-10-01');
  await api.callApi('setTripArchived', { tripId: id, archived: true });
  await render(<ItinerariesScreen {...props} />);
  await screen.findByText('No active itineraries.');
  await fireEvent.press(screen.getByRole('button', { name: 'Show archived itineraries (1)' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Unarchive Seattle itinerary' }));
  await screen.findByText('Seattle is back in your list.');
  expect(screen.getByRole('button', { name: /^Open itinerary: Seattle/ })).toBeTruthy();
  expect(screen.queryByRole('button', { name: /archived itineraries/ })).toBeNull();
});

it('keeps the trip where it is and shows an error when archiving fails', async () => {
  await makeTrip('Seattle', '2026-10-01');
  await render(<ItinerariesScreen {...props} />);
  await screen.findByRole('button', { name: 'Archive Seattle itinerary' });
  jest.spyOn(api, 'callApi').mockRejectedValueOnce(new Error('offline'));
  await fireEvent.press(screen.getByRole('button', { name: 'Archive Seattle itinerary' }));
  await screen.findByText('Could not archive Seattle. Try again.');
  expect(screen.getByRole('button', { name: /^Open itinerary: Seattle/ })).toBeTruthy();
});

it('hides the archived section when nothing is archived and keeps the empty message', async () => {
  await render(<ItinerariesScreen {...props} />);
  await screen.findByText('No itineraries yet.');
  expect(screen.queryByRole('button', { name: /archived itineraries/ })).toBeNull();
});
