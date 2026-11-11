import React from 'react';
import { beforeEach, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { callApi, resetFixtures } from '../src/api';
import * as api from '../src/api/ApiClient';
import { AddToItinerary } from '../src/components/AddToItinerary';
import { pickTime } from '../test-utils/timePicker';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
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

async function choose(city: string) {
  const { places } = await callApi('listPlaces', { city: 'Seattle' });
  await render(<AddToItinerary place={places.find((place) => place.id === 'p-jazz')!} />);
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

it('blocks duplicate places on the same day but permits a different day', async () => {
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
  expect(screen.getByText('Already on this day.')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: /Day 2/ }));
  expect(screen.getByRole('button', { name: 'Add place' })).not.toBeDisabled();
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
