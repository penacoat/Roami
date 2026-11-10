import React from 'react';
import { beforeEach, expect, it } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { callApi, resetFixtures } from '../src/api';
import { AddToItinerary } from '../src/screens/map/AddToItinerary';

const place = { id: 'p-pike', name: 'Pike Place Market' } as never;

beforeEach(() => resetFixtures());

it('tells the user to create a trip first when there are none', async () => {
  await render(<AddToItinerary place={place} />);
  await fireEvent.press(screen.getByRole('button', { name: 'Add to itinerary' }));
  expect(await screen.findByText(/no trips yet/i)).toBeTruthy();
});

it('adds the place to the chosen day of a trip', async () => {
  const { trip } = await callApi('createTrip', {
    city: 'Seattle',
    startDate: '2026-11-01',
    endDate: '2026-11-02',
    dailyWindow: { start: '09:00', end: '21:00' },
  });
  await render(<AddToItinerary place={place} />);
  await fireEvent.press(screen.getByRole('button', { name: 'Add to itinerary' }));
  await fireEvent.press(await screen.findByRole('button', { name: 'Day 2' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Add to Day 2' }));
  expect(await screen.findByText(/Added Pike Place Market to Day 2/)).toBeTruthy();
  const after = await callApi('getTrip', { tripId: trip.trip.id });
  expect(after.trip.stops).toHaveLength(1);
  expect(after.trip.stops[0]).toMatchObject({ placeId: 'p-pike', day: 2 });
});

it('shows a clear message when the day is full', async () => {
  const { trip } = await callApi('createTrip', {
    city: 'Seattle',
    startDate: '2026-11-01',
    endDate: '2026-11-01',
    dailyWindow: { start: '09:00', end: '21:00' },
  });
  const { places } = await callApi('listPlaces', { city: 'Seattle' });
  let revision = trip.trip.revision;
  for (const p of places.slice(0, 5)) {
    const r = await callApi('addStop', {
      tripId: trip.trip.id,
      expectedRevision: revision,
      placeId: p.id,
      day: 1,
      visitMinutes: 60,
    });
    revision = r.trip.trip.revision;
  }
  await render(<AddToItinerary place={place} />);
  await fireEvent.press(screen.getByRole('button', { name: 'Add to itinerary' }));
  await fireEvent.press(await screen.findByRole('button', { name: 'Add to Day 1' }));
  expect(await screen.findByRole('alert')).toBeTruthy();
});
