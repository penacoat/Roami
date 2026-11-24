import { afterEach, beforeEach, expect, it, jest } from '@jest/globals';
import * as location from 'expo-location';
import { currentCity } from '../src/cities/currentCity';

jest.mock('expo-location', () => ({
  Accuracy: { Balanced: 3 },
  requestForegroundPermissionsAsync: jest.fn(),
  getLastKnownPositionAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
  reverseGeocodeAsync: jest.fn(),
}));

beforeEach(() => {
  jest.resetAllMocks();
  jest
    .mocked(location.requestForegroundPermissionsAsync)
    .mockResolvedValue({ granted: true } as location.LocationPermissionResponse);
  jest.mocked(location.getLastKnownPositionAsync).mockResolvedValue({
    coords: { latitude: 47.61, longitude: -122.33 },
  } as location.LocationObject);
  jest.mocked(location.reverseGeocodeAsync).mockResolvedValue([
    {
      city: 'Seattle',
      region: 'Washington',
      country: 'United States',
    } as location.LocationGeocodedAddress,
  ]);
});
afterEach(() => {
  jest.useRealTimers();
});

it('uses a recent position to choose the actual city without starting another GPS fix', async () => {
  await expect(currentCity()).resolves.toMatchObject({
    name: 'Seattle',
    latitude: 47.61,
    longitude: -122.33,
  });
  expect(location.getCurrentPositionAsync).not.toHaveBeenCalled();
});

it('does not access position when permission is denied', async () => {
  jest
    .mocked(location.requestForegroundPermissionsAsync)
    .mockResolvedValue({ granted: false } as location.LocationPermissionResponse);
  await expect(currentCity()).rejects.toThrow('Location access is off');
  expect(location.getLastKnownPositionAsync).not.toHaveBeenCalled();
});

it('bounds a stalled location request so manual search stays available', async () => {
  jest.useFakeTimers();
  jest.mocked(location.getLastKnownPositionAsync).mockResolvedValue(null);
  jest.mocked(location.getCurrentPositionAsync).mockImplementation(() => new Promise(() => {}));
  const result = expect(currentCity()).rejects.toThrow('Location took too long');
  await jest.advanceTimersByTimeAsync(12000);
  await result;
});

it('does not invent a city from an address without one', async () => {
  jest
    .mocked(location.reverseGeocodeAsync)
    .mockResolvedValue([{ city: null, region: 'Washington' } as location.LocationGeocodedAddress]);
  await expect(currentCity()).rejects.toThrow('No city found here');
});
