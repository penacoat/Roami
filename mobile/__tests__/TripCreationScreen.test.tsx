import React from 'react';
import { afterEach, beforeEach, expect, it, jest } from '@jest/globals';
import * as api from '../src/api/ApiClient';
import { resetFixtures } from '../src/api';
import { cleanup, fireEvent, render, screen } from '@testing-library/react-native';

import { pickTime } from '../test-utils/timePicker';
import { TripCreationScreen } from '../src/screens/TripCreationScreen';

jest.mock(
  'react-native-safe-area-context',
  () => require('react-native-safe-area-context/jest/mock').default,
);

jest.mock('@react-native-community/datetimepicker', () =>
  require('../test-utils/timePicker').timePickerModule(),
);

beforeEach(() => {
  cleanup();
  jest.restoreAllMocks();
  jest.clearAllMocks();
  resetFixtures();
});

afterEach(() => {
  cleanup();
});

async function chooseSeattle() {
  await fireEvent.press(screen.getByRole('button', { name: 'Choose city' }));
  await fireEvent.press(screen.getByRole('button', { name: /^Select city: Seattle/ }));
}

async function chooseDayTrip() {
  await chooseSeattle();
  const today = new Date().toLocaleDateString('en-US', { dateStyle: 'full' });
  await fireEvent.press(screen.getByRole('button', { name: today }));
  await fireEvent.press(screen.getByRole('button', { name: today }));
}

it('requires destination and dates before saving', async () => {
  await render(<TripCreationScreen />);
  await fireEvent.press(screen.getByRole('button', { name: 'Create trip' }));
  expect(screen.getByRole('alert')).toHaveTextContent(/Add a destination/);
  await chooseSeattle();
  await fireEvent.press(screen.getByRole('button', { name: 'Create trip' }));
  expect(screen.getByRole('alert')).toHaveTextContent(/Choose your departure and return dates/);
});

it('saves a day trip for the signed-in user and resets for another trip', async () => {
  await render(<TripCreationScreen />);
  await chooseDayTrip();
  await fireEvent.press(screen.getByRole('button', { name: 'Create trip' }));
  expect(await screen.findByText('1 day to explore')).toBeOnTheScreen();
  const { trips } = await api.callApi('listTrips', {});
  const trip = trips.find((item) => item.city === 'Seattle' && item.startDate === item.endDate);
  expect(trip).toBeDefined();
  const result = await api.callApi('getTrip', { tripId: trip!.id });
  expect(result.trip.trip.dailyWindow).toEqual({ start: '09:00', end: '21:00' });
  await fireEvent.press(screen.getByRole('button', { name: 'Create another trip' }));
  expect(screen.getByRole('button', { name: 'Choose city' })).toBeTruthy();
});

it('saves starting-location and walking preferences and displays them in the itinerary', async () => {
  const { unmount } = await render(<TripCreationScreen />);
  await chooseDayTrip();
  await fireEvent.changeText(screen.getByLabelText('Trip starting location'), 'My hotel');
  await fireEvent.press(screen.getByRole('button', { name: 'Distance' }));
  await fireEvent.changeText(
    screen.getByLabelText('Maximum walking distance in kilometers'),
    '3.5',
  );
  await fireEvent.press(screen.getByRole('button', { name: 'Create trip' }));
  expect(await screen.findByText('Starting location · My hotel')).toBeOnTheScreen();
  expect(screen.getByText('Max walking distance · 3.5 km')).toBeOnTheScreen();
  const { trips } = await api.callApi('listTrips', {});
  const tripId = trips[0].id;
  expect((await api.callApi('getTrip', { tripId })).trip.trip).toMatchObject({
    startingPoints: [{ label: 'My hotel' }],
    walkingLimit: { type: 'distance', value: 3_500 },
  });
  unmount();
});

it('keeps the form and allows retry when the trip service fails', async () => {
  jest.spyOn(api, 'callApi').mockRejectedValueOnce(new Error('Service unavailable'));
  await render(<TripCreationScreen />);
  await chooseDayTrip();
  await fireEvent.press(screen.getByRole('button', { name: 'Create trip' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(/couldn’t save your trip/);
  expect(screen.getByRole('button', { name: 'Change city: Seattle' })).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Create trip' }));
  expect(await screen.findByText('1 day to explore')).toBeOnTheScreen();
});

it('rejects reversed daily hours', async () => {
  await render(<TripCreationScreen />);
  await chooseDayTrip();
  await pickTime('End time', 8);
  await fireEvent.press(screen.getByRole('button', { name: 'Create trip' }));
  expect(screen.getByRole('alert')).toHaveTextContent(/Daily end time must be after/);
});

it('uses a planning-hours preset for a newly created trip', async () => {
  await render(<TripCreationScreen />);
  await chooseDayTrip();
  await fireEvent.press(screen.getByRole('button', { name: /Daytime/ }));
  await fireEvent.press(screen.getByRole('button', { name: 'Create trip' }));
  await screen.findByText('Daily hours · 9:00am – 5:00pm');
});
