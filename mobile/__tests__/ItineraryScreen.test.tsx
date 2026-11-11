import React from 'react';
import { beforeEach, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { callApi, resetFixtures } from '../src/api';
import * as api from '../src/api/ApiClient';
import { ItineraryScreen } from '../src/screens/ItineraryScreen';
import { pickTime } from '../test-utils/timePicker';

jest.mock('@react-native-community/datetimepicker', () =>
  require('../test-utils/timePicker').timePickerModule(),
);
jest.mock(
  'react-native-safe-area-context',
  () => require('react-native-safe-area-context/jest/mock').default,
);

beforeEach(() => {
  jest.restoreAllMocks();
  resetFixtures();
});

/** A Seattle trip with Pike Place first and Jazz Alley second, both on Day 1. */
async function tripWithTwoStops(endDate = '2026-11-10') {
  const { trip } = await callApi('createTrip', {
    city: 'Seattle',
    startDate: '2026-11-10',
    endDate,
    dailyWindow: { start: '09:00', end: '21:00' },
  });
  let revision = trip.trip.revision;
  for (const placeId of ['p-pike', 'p-jazz']) {
    const result = await callApi('addStop', {
      tripId: trip.trip.id,
      expectedRevision: revision,
      placeId,
      day: 1,
      visitMinutes: 60,
    });
    revision = result.trip.trip.revision;
  }
  return trip.trip.id;
}

async function show(tripId: string) {
  await render(
    <ItineraryScreen
      tripId={tripId}
      onBack={jest.fn()}
      onExplore={jest.fn()}
      onOpenPlace={jest.fn()}
    />,
  );
  await screen.findAllByRole('button', { name: 'Remove Jazz Alley' });
}

async function placeIds(tripId: string) {
  const { trip } = await callApi('getTrip', { tripId });
  return trip.stops.map((stop) => stop.placeId);
}

async function placesByDay(tripId: string) {
  const { trip } = await callApi('getTrip', { tripId });
  return trip.stops.map((stop) => `${stop.day}:${stop.placeId}`);
}

it('removes a stop only after the user confirms', async () => {
  const tripId = await tripWithTwoStops();
  await show(tripId);

  await fireEvent.press(screen.getByRole('button', { name: 'Remove Jazz Alley' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Keep Jazz Alley' }));
  expect(await placeIds(tripId)).toEqual(['p-pike', 'p-jazz']);

  await fireEvent.press(screen.getByRole('button', { name: 'Remove Jazz Alley' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Confirm removing Jazz Alley' }));
  await screen.findByText('Removed Jazz Alley.');
  expect(screen.queryByRole('button', { name: 'Open Jazz Alley' })).toBeNull();
  expect(await placeIds(tripId)).toEqual(['p-pike']);
});

it('rearranges stops within a day', async () => {
  const tripId = await tripWithTwoStops();
  await show(tripId);

  expect(screen.getByRole('button', { name: 'Move Jazz Alley later' })).toBeDisabled();
  await fireEvent.press(screen.getByRole('button', { name: 'Move Jazz Alley earlier' }));
  await screen.findByText('Moved Jazz Alley.');
  expect(await placeIds(tripId)).toEqual(['p-jazz', 'p-pike']);
  expect(screen.getByRole('button', { name: 'Move Jazz Alley earlier' })).toBeDisabled();
});

it('reloads a changed itinerary instead of overwriting it', async () => {
  const tripId = await tripWithTwoStops();
  await show(tripId);
  const { trip } = await callApi('getTrip', { tripId });
  await callApi('moveStop', {
    tripId,
    expectedRevision: trip.trip.revision,
    stopId: trip.stops[1].id,
    day: 1,
    order: 1,
  });

  await fireEvent.press(screen.getByRole('button', { name: 'Remove Jazz Alley' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Confirm removing Jazz Alley' }));
  await screen.findByText('This itinerary changed. Review it and try again.');
  expect(await placeIds(tripId)).toEqual(['p-jazz', 'p-pike']);
});

it('keeps the stop and explains when removal fails', async () => {
  const tripId = await tripWithTwoStops();
  await show(tripId);
  jest.spyOn(api, 'callApi').mockRejectedValueOnce(new Error('offline'));

  await fireEvent.press(screen.getByRole('button', { name: 'Remove Jazz Alley' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Confirm removing Jazz Alley' }));
  await screen.findByText('Could not remove Jazz Alley. Try again.');
  expect(await placeIds(tripId)).toEqual(['p-pike', 'p-jazz']);
});

it('moves a stop to another day', async () => {
  const tripId = await tripWithTwoStops('2026-11-12');
  await show(tripId);

  await fireEvent.press(screen.getByRole('button', { name: 'Change day for Jazz Alley' }));
  expect(screen.getByRole('button', { name: 'Day 1, current day' })).toBeDisabled();
  await fireEvent.press(screen.getByRole('button', { name: 'Move Jazz Alley to Day 3' }));
  await screen.findByText('Moved Jazz Alley to Day 3.');
  expect(await placesByDay(tripId)).toEqual(['1:p-pike', '3:p-jazz']);
});

it('does not offer a day that already has the same place', async () => {
  const tripId = await tripWithTwoStops('2026-11-11');
  const { trip } = await callApi('getTrip', { tripId });
  await callApi('addStop', {
    tripId,
    expectedRevision: trip.trip.revision,
    placeId: 'p-jazz',
    day: 2,
    visitMinutes: 60,
  });
  await show(tripId);

  await fireEvent.press(screen.getAllByRole('button', { name: 'Change day for Jazz Alley' })[0]);
  expect(screen.getByRole('button', { name: 'Day 2, already there' })).toBeDisabled();
  await fireEvent.press(screen.getByRole('button', { name: 'Cancel moving Jazz Alley' }));
  expect(screen.queryByText('Move Jazz Alley to which day?')).toBeNull();
});

it('hides Change day on a one-day trip', async () => {
  const tripId = await tripWithTwoStops();
  await show(tripId);
  expect(screen.queryByRole('button', { name: 'Change day for Jazz Alley' })).toBeNull();
});

it('sets a time from a start and end, then shows it as a range', async () => {
  const tripId = await tripWithTwoStops();
  await show(tripId);

  await fireEvent.press(screen.getByRole('button', { name: 'Set time for Jazz Alley' }));
  await pickTime('Start time for Jazz Alley', 13);
  // Moving the start keeps the default one-hour length.
  expect(screen.getByRole('button', { name: 'End time for Jazz Alley, 2:00pm' })).toBeTruthy();
  await pickTime('End time for Jazz Alley', 14, 30);
  await fireEvent.press(screen.getByRole('button', { name: 'Save time for Jazz Alley' }));
  await screen.findByText('Set time for Jazz Alley.');
  expect(screen.getByText('1:00pm – 2:30pm')).toBeTruthy();
  const { trip } = await callApi('getTrip', { tripId });
  expect(trip.stops[1]).toMatchObject({ startTime: '13:00', visitMinutes: 90 });
});

it('opens the editor with the current time and can clear it', async () => {
  const tripId = await tripWithTwoStops();
  const { trip } = await callApi('getTrip', { tripId });
  await callApi('updateStopTime', {
    tripId,
    expectedRevision: trip.trip.revision,
    stopId: trip.stops[1].id,
    startTime: '13:00',
    visitMinutes: 60,
  });
  await show(tripId);

  await fireEvent.press(
    screen.getByRole('button', { name: 'Change time for Jazz Alley, 1:00pm – 2:00pm' }),
  );
  expect(screen.getByRole('button', { name: 'Start time for Jazz Alley, 1:00pm' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'End time for Jazz Alley, 2:00pm' })).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Clear time for Jazz Alley' }));
  await screen.findByText('Cleared the time for Jazz Alley.');
  expect(screen.getByRole('button', { name: 'Set time for Jazz Alley' })).toBeTruthy();
});

it('explains a bad time without saving', async () => {
  const tripId = await tripWithTwoStops();
  await show(tripId);

  await fireEvent.press(screen.getByRole('button', { name: 'Set time for Jazz Alley' }));
  await pickTime('End time for Jazz Alley', 11);
  await fireEvent.press(screen.getByRole('button', { name: 'Save time for Jazz Alley' }));
  expect(screen.getByText('The end time must be after the start time.')).toBeTruthy();
  const { trip } = await callApi('getTrip', { tripId });
  expect(trip.stops[1].startTime).toBeNull();
});
