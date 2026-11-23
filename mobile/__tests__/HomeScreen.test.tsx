import React from 'react';
import { beforeEach, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import type { TripSummary, TripView } from '@roami/shared';
import { callApi } from '../src/api';
import { HomeScreen } from '../src/screens/HomeScreen';

jest.mock('../src/api', () => ({ callApi: jest.fn() }));
const mockCallApi = jest.mocked(callApi);

const today = new Date();
const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
const tripSummary: TripSummary = {
  id: 'trip-1',
  city: 'Seattle',
  startDate: todayKey,
  endDate: todayKey,
  stopCount: 1,
  candidateCount: 0,
};
const tripView: TripView = {
  trip: {
    id: 'trip-1',
    ownerId: 'user-1',
    city: 'Seattle',
    startDate: todayKey,
    endDate: todayKey,
    dailyWindow: { start: '09:00', end: '21:00' },
    startingPoints: [],
    walkingLimit: null,
    candidatePlaceIds: [],
    revision: 1,
    createdAt: todayKey,
    updatedAt: todayKey,
  },
  candidates: [],
  stops: [
    {
      id: 'stop-1',
      tripId: 'trip-1',
      placeId: 'place-1',
      title: null,
      recommendationIds: [],
      day: 1,
      order: 1,
      startTime: '10:00',
      visitMinutes: 60,
      walkingMinutesFromPrevious: null,
      isFixed: false,
      isRequired: false,
      warnings: [],
      place: {
        id: 'place-1',
        name: 'Pike Place Market',
        latitude: 47.6,
        longitude: -122.3,
        category: 'market',
        openingHours: null,
        missingFields: [],
      },
    },
  ],
};

beforeEach(() => {
  jest.resetAllMocks();
});

it('shows the current trip and today’s scheduled activities and opens its itinerary', async () => {
  mockCallApi.mockImplementation(async (name) => {
    if (name === 'listTrips') return { trips: [tripSummary] };
    if (name === 'getTrip') return { trip: tripView };
    throw new Error(`Unexpected API ${name}`);
  });
  const onOpenTrip = jest.fn();
  await render(<HomeScreen onOpenTrip={onOpenTrip} onCreateTrip={jest.fn()} />);
  expect(await screen.findByText(/Pike Place Market/)).toBeTruthy();
  expect(screen.getByText('YOUR TRIP TODAY')).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Open itinerary' }));
  expect(onOpenTrip).toHaveBeenCalledWith('trip-1');
});

it('shows an empty state and allows starting trip creation', async () => {
  mockCallApi.mockResolvedValue({ trips: [] });
  const onCreateTrip = jest.fn();
  await render(<HomeScreen onOpenTrip={jest.fn()} onCreateTrip={onCreateTrip} />);
  expect(await screen.findByText('No upcoming trips')).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Plan a trip' }));
  expect(onCreateTrip).toHaveBeenCalled();
});

it('shows a retry action when trip loading fails', async () => {
  mockCallApi.mockRejectedValue(new Error('network'));
  await render(<HomeScreen onOpenTrip={jest.fn()} onCreateTrip={jest.fn()} />);
  expect(await screen.findByRole('alert')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy();
});
