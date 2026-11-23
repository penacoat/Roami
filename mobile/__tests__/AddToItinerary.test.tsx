import React from 'react';
import { beforeEach, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { callApi, resetFixtures } from '../src/api';
import * as api from '../src/api/ApiClient';
import { AddToItinerary } from '../src/components/AddToItinerary';
import { pickTime } from '../test-utils/timePicker';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('@react-native-community/datetimepicker', () =>
  jest
    .requireActual<typeof import('../test-utils/timePicker')>('../test-utils/timePicker')
    .timePickerModule(),
);
jest.mock(
  'react-native-safe-area-context',
  () =>
    jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

beforeEach(() => {
  jest.restoreAllMocks();
  resetFixtures();
});

async function create(city = 'Seattle') {
  return (
    await callApi('createTrip', {
      city,
      startDate: '2026-11-10',
      endDate: '2026-11-11',
      dailyWindow: { start: '09:00', end: '21:00' },
    })
  ).trip;
}

async function choose(city: string, recommendationIds: string[] = []) {
  const { places } = await callApi('listPlaces', { city: 'Seattle' });
  await render(
    <AddToItinerary
      place={places.find((place) => place.id === 'p-jazz')!}
      recommendationIds={recommendationIds}
    />,
  );
  await fireEvent.press(screen.getByRole('button', { name: 'Add Jazz Alley to an itinerary' }));
  await fireEvent.press(await screen.findByRole('button', { name: new RegExp(city) }));
  await screen.findByText('Choose a day');
}

it('adds only to the selected itinerary and day, at the chosen times', async () => {
  const first = await create();
  const second = await create('Portland');
  await choose('Portland');
  await fireEvent.press(screen.getByRole('button', { name: /Day 2/ }));
  await fireEvent.press(screen.getByRole('button', { name: 'Add a time' }));
  await pickTime('Start time', 13);
  await pickTime('End time', 14, 30);
  await fireEvent.press(screen.getByRole('button', { name: 'Add place' }));
  await screen.findByText('Added to Portland · Day 2 · 1:00pm – 2:30pm');
  expect((await callApi('getTrip', { tripId: first.trip.id })).trip.stops).toHaveLength(0);
  const { trip } = await callApi('getTrip', { tripId: second.trip.id });
  expect(trip.stops).toHaveLength(1);
  expect(trip.stops[0]).toMatchObject({
    placeId: 'p-jazz',
    day: 2,
    startTime: '13:00',
    visitMinutes: 90,
  });
});

it('adds without a time unless one is chosen', async () => {
  const trip = await create();
  await choose('Seattle');
  await fireEvent.press(screen.getByRole('button', { name: 'Add place' }));
  await screen.findByText('Added to Seattle · Day 1');
  const saved = (await callApi('getTrip', { tripId: trip.trip.id })).trip;
  expect(saved.stops[0]).toMatchObject({ startTime: null, visitMinutes: 60 });
});

it('explains an impossible time without adding, and can drop the time', async () => {
  const trip = await create();
  await choose('Seattle');
  await fireEvent.press(screen.getByRole('button', { name: 'Add a time' }));
  await pickTime('End time', 11);
  await fireEvent.press(screen.getByRole('button', { name: 'Add place' }));
  expect(screen.getByText('The end time must be after the start time.')).toBeTruthy();
  expect((await callApi('getTrip', { tripId: trip.trip.id })).trip.stops).toHaveLength(0);

  await fireEvent.press(screen.getByRole('button', { name: 'Remove time' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Add place' }));
  await screen.findByText('Added to Seattle · Day 1');
  const saved = (await callApi('getTrip', { tripId: trip.trip.id })).trip;
  expect(saved.stops[0]).toMatchObject({ startTime: null, visitMinutes: 60 });
});

it('shows the scheduled day and blocks a duplicate anywhere in that trip', async () => {
  const trip = await create();
  await callApi('addStop', {
    tripId: trip.trip.id,
    expectedRevision: 1,
    placeId: 'p-jazz',
    day: 1,
    visitMinutes: 60,
  });
  await choose('Seattle');
  expect(screen.getByRole('button', { name: 'Add place' })).toBeDisabled();
  expect(screen.getByText(/Already scheduled · Day 1/)).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: /Day 2/ }));
  expect(screen.getByRole('button', { name: 'Add place' })).toBeDisabled();
});

it('reloads a stale itinerary and waits for an explicit retry before saving', async () => {
  const trip = await create();
  await choose('Seattle');
  await callApi('addStop', {
    tripId: trip.trip.id,
    expectedRevision: 1,
    placeId: 'p-pike',
    day: 1,
    visitMinutes: 30,
  });
  await fireEvent.press(screen.getByRole('button', { name: 'Add place' }));
  await screen.findByText('This itinerary changed. Review the day and try again.');
  await screen.findByText('Choose a day');
  expect((await callApi('getTrip', { tripId: trip.trip.id })).trip.stops).toHaveLength(1);
  await fireEvent.press(screen.getByRole('button', { name: 'Add place' }));
  await screen.findByText('Added to Seattle · Day 1');
  const saved = (await callApi('getTrip', { tripId: trip.trip.id })).trip;
  expect(saved.stops.map((stop) => stop.placeId)).toEqual(['p-pike', 'p-jazz']);
});

it('keeps the selection when a write fails and lets the user retry', async () => {
  const trip = await create();
  await choose('Seattle');
  jest.spyOn(api, 'callApi').mockRejectedValueOnce(new Error('offline'));
  await fireEvent.press(screen.getByRole('button', { name: 'Add place' }));
  await screen.findByText('Could not add this place. Try again.');
  expect((await callApi('getTrip', { tripId: trip.trip.id })).trip.stops).toHaveLength(0);
  await fireEvent.press(screen.getByRole('button', { name: 'Add place' }));
  await screen.findByText('Added to Seattle · Day 1');
});

it('explains how to create an itinerary when none exist', async () => {
  const { places } = await callApi('listPlaces', { city: 'Seattle' });
  await render(<AddToItinerary place={places[0]} />);
  await fireEvent.press(screen.getByRole('button', { name: /Add .* to an itinerary/ }));
  await screen.findByText('Create an itinerary in the Itineraries tab first.');
  expect(screen.queryByRole('button', { name: 'Add place' })).toBeNull();
});

it('saves a selected place as a suggestion for generation', async () => {
  const trip = await create();
  await choose('Seattle', ['r1']);
  await fireEvent.press(screen.getByRole('button', { name: 'Save as a trip suggestion' }));
  await screen.findByText('Saved as a suggestion for Seattle.');
  const { trip: saved } = await callApi('getTrip', { tripId: trip.trip.id });
  expect(saved.candidates.map((place) => place.id)).toEqual(['p-jazz']);
  expect(saved.stops).toHaveLength(0);
  expect(saved.trip.candidateRecommendationIds).toEqual({ 'p-jazz': ['r1'] });
  const { trip: generated } = await callApi('applyItinerary', {
    tripId: saved.trip.id,
    expectedRevision: saved.trip.revision,
    placeIds: ['p-jazz'],
    strategy: 'earlier',
  });
  expect(generated.stops[0].recommendationIds).toEqual(['r1']);
});

it('preserves and deduplicates recommendation sources when adding a scheduled stop', async () => {
  const trip = await create();
  const { places } = await callApi('listPlaces', { city: 'Seattle' });
  await render(
    <AddToItinerary
      place={places.find((place) => place.id === 'p-jazz')!}
      recommendationIds={['r1', 'r2', 'r1']}
    />,
  );
  await fireEvent.press(screen.getByRole('button', { name: 'Add Jazz Alley to an itinerary' }));
  await fireEvent.press(await screen.findByRole('button', { name: /Seattle/ }));
  await screen.findByText('Choose a day');
  jest.spyOn(api, 'callApi').mockRejectedValueOnce(new Error('offline'));
  await fireEvent.press(screen.getByRole('button', { name: 'Add place' }));
  await screen.findByText('Could not add this place. Try again.');
  await fireEvent.press(screen.getByRole('button', { name: 'Add place' }));
  await screen.findByText('Added to Seattle · Day 1');
  const saved = (await callApi('getTrip', { tripId: trip.trip.id })).trip;
  expect(saved.stops[0].recommendationIds).toEqual(['r1', 'r2']);
});

it('does not offer an archived itinerary', async () => {
  const archived = await create('Portland');
  await create('Denver');
  await callApi('setTripArchived', { tripId: archived.trip.id, archived: true });
  const { places } = await callApi('listPlaces', { city: 'Seattle' });
  await render(<AddToItinerary place={places.find((place) => place.id === 'p-jazz')!} />);
  await fireEvent.press(screen.getByRole('button', { name: 'Add Jazz Alley to an itinerary' }));
  await screen.findByRole('button', { name: /Denver/ });
  expect(screen.queryByRole('button', { name: /Portland/ })).toBeNull();
});
