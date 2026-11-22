import React from 'react';
import { beforeEach, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { callApi, resetFixtures } from '../src/api';
import * as api from '../src/api/ApiClient';
import { ItineraryScreen } from '../src/screens/ItineraryScreen';
import { pickTime } from '../test-utils/timePicker';

jest.mock('react-native-maps', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return { __esModule: true, default: View, Marker: View, Polyline: View };
});
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
  await fireEvent.press(screen.getByRole('button', { name: 'Apply change' }));
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
  await fireEvent.press(screen.getByRole('button', { name: 'Apply change' }));
  await screen.findByText('Moved Jazz Alley to Day 3.');
  expect(await placesByDay(tripId)).toEqual(['1:p-pike', '3:p-jazz']);
});

it('can cancel the day picker without changing the itinerary', async () => {
  const tripId = await tripWithTwoStops('2026-11-11');
  await show(tripId);
  await fireEvent.press(screen.getByRole('button', { name: 'Change day for Jazz Alley' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Cancel moving Jazz Alley' }));
  expect(screen.queryByText('Move Jazz Alley to which day?')).toBeNull();
  expect(await placesByDay(tripId)).toEqual(['1:p-pike', '1:p-jazz']);
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
  expect(await screen.findByRole('header', { name: 'Preview change' })).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Apply change' }));
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
  await fireEvent.press(screen.getByRole('button', { name: 'Apply change' }));
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

it('compares two options using day selections and keeps a fixed reservation in place', async () => {
  const tripId = await tripWithTwoStops('2026-11-11');
  await callApi('savePlace', { placeId: 'p-kerry' });
  await show(tripId);

  await fireEvent.press(screen.getByRole('button', { name: 'Add fixed activity to Day 1' }));
  await fireEvent.changeText(
    screen.getByLabelText('Activity or reservation name'),
    'Lunch booking',
  );
  await fireEvent.press(screen.getByRole('button', { name: '90 min' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Save fixed activity' }));
  await screen.findByText('Added Lunch booking to Day 1.');
  expect(screen.queryByRole('button', { name: 'Change day for Lunch booking' })).toBeNull();
  const before = (await callApi('getTrip', { tripId })).trip;
  const fixed = before.stops.find((stop) => stop.isFixed)!;
  expect(fixed).toMatchObject({ day: 1, startTime: '12:00', visitMinutes: 90 });

  await fireEvent.press(screen.getByRole('button', { name: /^Day 2 ·/ }));
  await fireEvent.press(screen.getByRole('button', { name: 'Add place to Day 2' }));
  await fireEvent.press(await screen.findByRole('button', { name: 'Plan Kerry Park for Day 2' }));
  await fireEvent.press(await screen.findByRole('button', { name: 'Save as a trip suggestion' }));
  await screen.findByText('Saved as a suggestion for Seattle.');
  await fireEvent.press(screen.getByRole('button', { name: 'Done' }));

  await fireEvent.press(screen.getByRole('button', { name: 'Generate itinerary' }));
  expect(screen.getByRole('checkbox', { name: 'Kerry Park' })).toBeChecked();
  await fireEvent.press(screen.getByRole('button', { name: 'Generate options' }));
  expect(screen.getByText('9:00am – 10:00am · Pike Place Market')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Later times' }));
  expect(screen.getByText('8:00pm – 9:00pm · Pike Place Market')).toBeTruthy();
  expect(screen.getByText('12:00pm – 1:30pm · Lunch booking · Fixed')).toBeTruthy();
  expect((await callApi('getTrip', { tripId })).trip.trip.revision).toBe(before.trip.revision + 1);

  await fireEvent.press(screen.getByRole('button', { name: 'Use this itinerary' }));
  await screen.findByText('Itinerary updated.');
  const { trip } = await callApi('getTrip', { tripId });
  expect(trip.stops.find((stop) => stop.id === fixed.id)).toMatchObject({
    day: fixed.day,
    startTime: fixed.startTime,
    visitMinutes: fixed.visitMinutes,
  });
  expect(trip.stops.find((stop) => stop.placeId === 'p-pike')?.startTime).toBe('20:00');
  expect(trip.stops.find((stop) => stop.placeId === 'p-kerry')?.startTime).toBe('18:00');
});

it('shows only the selected day and calculates time between its timed activities', async () => {
  const tripId = await tripWithTwoStops('2026-11-11');
  let { trip } = await callApi('getTrip', { tripId });
  const [pike, jazz] = trip.stops;
  ({ trip } = await callApi('updateStopTime', {
    tripId,
    expectedRevision: trip.trip.revision,
    stopId: pike.id,
    startTime: '09:00',
    visitMinutes: 60,
  }));
  ({ trip } = await callApi('updateStopTime', {
    tripId,
    expectedRevision: trip.trip.revision,
    stopId: jazz.id,
    startTime: '11:30',
    visitMinutes: 60,
  }));
  await callApi('addStop', {
    tripId,
    expectedRevision: trip.trip.revision,
    placeId: 'p-kerry',
    day: 2,
    visitMinutes: 60,
  });
  await show(tripId);
  expect(screen.getByText('10:00am – 11:30am · 1 hr 30 min free')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Open Kerry Park' })).toBeNull();

  await fireEvent.press(screen.getByRole('button', { name: /^Day 2 ·/ }));
  expect(screen.getByRole('button', { name: 'Open Kerry Park' })).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Open Jazz Alley' })).toBeNull();
  expect(screen.queryByText('10:00am – 11:30am · 1 hr 30 min free')).toBeNull();
});

it('offers time slots in the calendar and refuses scheduling over a fixed activity', async () => {
  const tripId = await tripWithTwoStops();
  const { trip } = await callApi('getTrip', { tripId });
  const fixed = await callApi('addFixedActivity', {
    tripId,
    expectedRevision: trip.trip.revision,
    title: 'Reservation',
    day: 1,
    startTime: '10:00',
    visitMinutes: 60,
  });
  await show(tripId);
  await fireEvent.press(screen.getByRole('button', { name: 'Calendar' }));
  expect(
    screen.queryByTestId(`drag-${fixed.trip.stops.find((stop) => stop.isFixed)?.id}`),
  ).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: /^Jazz Alley, Unscheduled/ }));
  await fireEvent.press(screen.getByRole('button', { name: 'Time slot 10:00am' }));
  expect(screen.getByText('This time overlaps “Reservation”.')).toBeTruthy();

  await fireEvent.press(screen.getByRole('button', { name: 'Time slot 11:00am' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Apply change' }));
  await screen.findByText('Scheduled Jazz Alley at 11:00am – 12:00pm.');
  expect(screen.getByRole('button', { name: /^Jazz Alley, 11:00am/ })).toBeTruthy();
});

it('drags an untimed activity into the calendar and snaps to a quarter hour', async () => {
  const tripId = await tripWithTwoStops();
  const { trip } = await callApi('getTrip', { tripId });
  const first = trip.stops[0];
  await show(tripId);
  await fireEvent.press(screen.getByRole('button', { name: 'Calendar' }));
  const grip = screen.getByTestId(`drag-${first.id}`);
  const touch = (pageY: number) => ({ nativeEvent: { locationY: 10, pageY } });
  await fireEvent(grip, 'responderGrant', touch(50));
  await fireEvent(grip, 'responderMove', touch(204));
  await fireEvent(grip, 'responderRelease', touch(204));
  await fireEvent.press(screen.getByRole('button', { name: 'Apply change' }));
  await screen.findByText('Scheduled Pike Place Market at 9:30am – 10:30am.');
});

it('deletes only after explicit confirmation and returns to the itinerary list', async () => {
  const tripId = await tripWithTwoStops();
  const onBack = jest.fn();
  await render(
    <ItineraryScreen
      tripId={tripId}
      onBack={onBack}
      onExplore={jest.fn()}
      onOpenPlace={jest.fn()}
    />,
  );
  await fireEvent.press(await screen.findByRole('button', { name: 'Delete itinerary' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Keep itinerary' }));
  expect(screen.queryByRole('button', { name: 'Confirm delete itinerary' })).toBeNull();
  expect(await placeIds(tripId)).toHaveLength(2);
  await fireEvent.press(screen.getByRole('button', { name: 'Delete itinerary' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Confirm delete itinerary' }));
  await waitFor(() => expect(onBack).toHaveBeenCalledTimes(1));
  expect((await callApi('listTrips', {})).trips).toHaveLength(0);
});

it('warns about hours in a pending change and keeps the same time in the map and list', async () => {
  const tripId = await tripWithTwoStops();
  await show(tripId);
  await fireEvent.press(screen.getByRole('button', { name: 'Set time for Jazz Alley' }));
  await pickTime('Start time for Jazz Alley', 8);
  await fireEvent.press(screen.getByRole('button', { name: 'Save time for Jazz Alley' }));
  expect(screen.getByText(/Outside daily planning hours/)).toBeTruthy();
  expect((await callApi('getTrip', { tripId })).trip.stops[1].startTime).toBeNull();

  await fireEvent.press(screen.getByRole('button', { name: 'Apply change' }));
  await screen.findByText('Set time for Jazz Alley.');
  await fireEvent.press(screen.getByRole('button', { name: 'Map' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Show Jazz Alley on map' }));
  expect(screen.getByText('8:00am – 9:00am')).toBeTruthy();
  expect(screen.getByText(/Outside daily planning hours/)).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Show in day list' }));
  expect(
    screen.getByRole('button', { name: 'Change time for Jazz Alley, 8:00am – 9:00am' }),
  ).toBeTruthy();
});

it('prioritizes a marked must-do stop and keeps every existing stop in the plan', async () => {
  let { trip } = await callApi('createTrip', {
    city: 'Seattle',
    startDate: '2026-11-10',
    endDate: '2026-11-10',
    dailyWindow: { start: '09:00', end: '10:00' },
  });
  const tripId = trip.trip.id;
  for (const placeId of ['p-pike', 'p-jazz']) {
    ({ trip } = await callApi('addStop', {
      tripId,
      expectedRevision: trip.trip.revision,
      placeId,
      day: 1,
      visitMinutes: 60,
    }));
  }
  await show(tripId);
  await fireEvent.press(screen.getByRole('checkbox', { name: 'Must-do Jazz Alley' }));
  await screen.findByText('Marked Jazz Alley as must-do.');
  await fireEvent.press(screen.getByRole('button', { name: 'Generate itinerary' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Generate options' }));
  expect(screen.getByText('9:00am – 10:00am · Jazz Alley · Must-do')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Use this itinerary' }));
  await screen.findByText('Itinerary updated.');
  const { trip: saved } = await callApi('getTrip', { tripId });
  expect(saved.stops.map((stop) => [stop.placeId, stop.startTime, stop.isRequired])).toEqual([
    ['p-jazz', '09:00', true],
    ['p-pike', null, false],
  ]);
});

it('records a known cost and a dated booking checklist item', async () => {
  const tripId = await tripWithTwoStops();
  await show(tripId);
  await fireEvent.press(screen.getByRole('button', { name: 'Preparation for Jazz Alley' }));
  await fireEvent.changeText(screen.getByLabelText('Cost amount'), '24.50');
  await fireEvent.changeText(screen.getByLabelText('Cost currency'), 'usd');
  await fireEvent.press(screen.getByRole('button', { name: 'Save cost' }));
  await screen.findByText('Cost · 24.5 USD');

  await fireEvent.changeText(await screen.findByLabelText('Checklist item name'), 'Buy tickets');
  await fireEvent.changeText(
    screen.getByLabelText('Booking link'),
    'https://example.org/reservations',
  );
  await fireEvent.changeText(screen.getByLabelText('Due date'), '2026-11-09');
  await fireEvent.press(screen.getByRole('button', { name: 'Add checklist item' }));
  expect(await screen.findByRole('link', { name: 'Open booking' })).toBeTruthy();
  expect(screen.getByText(/Due Nov 9, 2026/)).toBeTruthy();
  await fireEvent.press(screen.getByRole('checkbox', { name: 'Buy tickets' }));
  expect(await screen.findByRole('checkbox', { name: 'Buy tickets', checked: true })).toBeChecked();
});
