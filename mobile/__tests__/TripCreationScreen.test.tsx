import React from 'react';
import { beforeEach, expect, it, jest } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { TripCreationScreen } from '../src/screens/TripCreationScreen';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('react-native-safe-area-context', () =>
  require('react-native-safe-area-context/jest/mock').default,
);

const setItem = jest.mocked(AsyncStorage.setItem);
const onSignOut = jest.fn<() => Promise<void>>();

beforeEach(() => {
  jest.clearAllMocks();
  setItem.mockResolvedValue(undefined);
});

async function chooseDayTrip() {
  await fireEvent.press(screen.getByRole('button', { name: 'Seattle' }));
  const today = new Date().toLocaleDateString('en-US', { dateStyle: 'full' });
  await fireEvent.press(screen.getByRole('button', { name: today }));
  await fireEvent.press(screen.getByRole('button', { name: today }));
}

it('requires destination and dates before saving', async () => {
  await render(<TripCreationScreen ownerId="user-1" onSignOut={onSignOut} />);
  await fireEvent.press(screen.getByRole('button', { name: 'Create my trip →' }));
  expect(screen.getByRole('alert')).toHaveTextContent(/Add a destination/);
  await fireEvent.press(screen.getByRole('button', { name: 'Seattle' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Create my trip →' }));
  expect(screen.getByRole('alert')).toHaveTextContent(/Choose your departure and return dates/);
  expect(setItem).not.toHaveBeenCalled();
});

it('saves a day trip for the signed-in user and resets for another trip', async () => {
  await render(<TripCreationScreen ownerId="user-1" onSignOut={onSignOut} />);
  await chooseDayTrip();
  await fireEvent.press(screen.getByRole('button', { name: 'Create my trip →' }));
  expect(await screen.findByText('1 day to explore')).toBeOnTheScreen();
  expect(setItem).toHaveBeenCalledTimes(1);
  const [key, json] = setItem.mock.calls[0];
  const trip = JSON.parse(json);
  expect(key).toBe(`roami:trip:user-1:${trip.id}`);
  expect(trip).toMatchObject({ ownerId: 'user-1', city: 'Seattle', dailyWindow: { start: '09:00', end: '21:00' } });
  expect(trip.startDate).toBe(trip.endDate);
  await fireEvent.press(screen.getByRole('button', { name: 'Plan another trip' }));
  expect(screen.getByLabelText('City or destination')).toHaveDisplayValue('');
});

it('keeps the form and allows retry when device storage fails', async () => {
  setItem.mockRejectedValueOnce(new Error('Storage unavailable'));
  await render(<TripCreationScreen ownerId="user-1" onSignOut={onSignOut} />);
  await chooseDayTrip();
  await fireEvent.press(screen.getByRole('button', { name: 'Create my trip →' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(/couldn’t save your trip/);
  expect(screen.getByLabelText('City or destination')).toHaveDisplayValue('Seattle');
  await fireEvent.press(screen.getByRole('button', { name: 'Create my trip →' }));
  expect(await screen.findByText('1 day to explore')).toBeOnTheScreen();
});

it('rejects reversed daily hours', async () => {
  await render(<TripCreationScreen ownerId="user-1" onSignOut={onSignOut} />);
  await chooseDayTrip();
  await fireEvent.changeText(screen.getByLabelText('Start of day, 24-hour time'), '22:00');
  await fireEvent.press(screen.getByRole('button', { name: 'Create my trip →' }));
  expect(screen.getByRole('alert')).toHaveTextContent(/Daily end time must be after/);
  expect(setItem).not.toHaveBeenCalled();
});
