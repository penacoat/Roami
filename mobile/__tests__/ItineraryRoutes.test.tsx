import React from 'react';
import { beforeEach, expect, it, jest } from '@jest/globals';
import { Stack, Tabs } from 'expo-router';
import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { resetFixtures } from '../src/api';
import ItinerariesRoute from '../src/app/(tabs)/trip';
import ItineraryRoute from '../src/app/itinerary/[tripId]';
import NewTripRoute from '../src/app/new-trip';

jest.mock('../src/cities/citySearch', () => ({
  searchCities: async ({ query }: { query: string }) => ({
    cities: (require('../test-utils/cities').testCities as { name: string }[]).filter(
      (city) => city.name.toLowerCase() === query.trim().toLowerCase(),
    ),
  }),
}));

jest.mock('../src/auth/AuthService', () => ({ signOut: jest.fn() }));
jest.mock('../src/trips/ItineraryMap', () => ({ ItineraryMap: () => null }));
jest.mock('@react-native-community/datetimepicker', () =>
  require('../test-utils/timePicker').timePickerModule(),
);
jest.mock(
  'react-native-safe-area-context',
  () => require('react-native-safe-area-context/jest/mock').default,
);

beforeEach(resetFixtures);

it('creates two trips in succession through the itinerary routes and can reopen both', async () => {
  const routes = await renderRouter(
    {
      _layout: () => <Stack screenOptions={{ headerShown: false, animation: 'none' }} />,
      '(tabs)/_layout': () => (
        <Tabs screenOptions={{ headerShown: false }}>
          <Tabs.Screen name="index" />
          <Tabs.Screen name="trip" />
        </Tabs>
      ),
      '(tabs)/index': () => null,
      '(tabs)/trip': ItinerariesRoute,
      'new-trip': NewTripRoute,
      'itinerary/[tripId]': ItineraryRoute,
    },
    { initialUrl: '/trip' },
  );

  const date = new Date().toLocaleDateString('en-US', { dateStyle: 'full' });
  const tripIds = new Set<unknown>();
  for (const city of ['Seattle', 'Portland']) {
    await fireEvent.press(await screen.findByRole('button', { name: 'New itinerary' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Choose city' }));
    await fireEvent.changeText(screen.getByLabelText('City name'), city);
    await fireEvent.press(
      await screen.findByRole('button', { name: new RegExp('^Select city: ' + city) }),
    );
    await fireEvent.press(screen.getByRole('button', { name: date }));
    await fireEvent.press(screen.getByRole('button', { name: date }));
    const creating = fireEvent.press(screen.getByRole('button', { name: 'Create trip' }));
    await jest.advanceTimersByTimeAsync(200);
    await creating;
    await screen.findByRole('button', { name: 'Generate itinerary' });
    await screen.findByRole('header', { name: city });
    const { tripId } = routes.getSearchParams();
    expect(tripId).toEqual(expect.any(String));
    tripIds.add(tripId);
    await fireEvent.press(screen.getByRole('button', { name: '← Itineraries' }));
    expect(routes.getPathname()).toBe('/trip');
  }

  expect(tripIds.size).toBe(2);
  await fireEvent.press(await screen.findByRole('button', { name: /Open itinerary: Seattle/ }));
  await screen.findByRole('header', { name: 'Seattle' });
  await fireEvent.press(screen.getByRole('button', { name: '← Itineraries' }));
  await fireEvent.press(await screen.findByRole('button', { name: /Open itinerary: Portland/ }));
  await screen.findByRole('header', { name: 'Portland' });
  await fireEvent.press(screen.getByRole('button', { name: 'Delete itinerary' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Confirm delete itinerary' }));
  await screen.findByRole('button', { name: /Open itinerary: Seattle/ });
  expect(routes.getPathname()).toBe('/trip');
  expect(screen.queryByRole('button', { name: /Open itinerary: Portland/ })).toBeNull();
});
