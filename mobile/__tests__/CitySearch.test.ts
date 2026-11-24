import { afterEach, expect, it, jest } from '@jest/globals';
import { searchCities } from '../src/cities/citySearch';
import { nearCity } from '../src/cities/CityProvider';
import { testCities } from '../test-utils/cities';

afterEach(() => {
  jest.restoreAllMocks();
});

it('returns populated places with region labels and API coordinates, excluding landmarks and malformed results', async () => {
  const fetcher = jest.spyOn(globalThis, 'fetch').mockResolvedValue({
    ok: true,
    json: async () => ({
      results: [
        {
          id: 1,
          name: 'Portland',
          admin1: 'Oregon',
          country: 'United States',
          latitude: 45.5,
          longitude: -122.6,
          feature_code: 'PPLA2',
        },
        {
          id: 2,
          name: 'Portland',
          admin1: 'Maine',
          country: 'United States',
          latitude: 43.6,
          longitude: -70.2,
          feature_code: 'PPL',
        },
        { id: 3, name: 'Landmark', latitude: 45, longitude: -122, feature_code: 'MT' },
        { id: 4, name: 'Invalid', latitude: 190, longitude: -122, feature_code: 'PPL' },
      ],
    }),
  } as Response);
  const { cities } = await searchCities({ query: '  Portl  ' });
  expect(cities).toHaveLength(2);
  expect(cities[0]).toMatchObject({
    id: 'geonames:1',
    name: 'Portland',
    region: 'Oregon',
    latitude: 45.5,
    longitude: -122.6,
  });
  expect(cities[1].region).toBe('Maine');
  expect(fetcher).toHaveBeenCalledWith(expect.stringContaining('name=Portl&'), expect.anything());
});

it('distinguishes no matching city from an unavailable provider', async () => {
  const fetcher = jest
    .spyOn(globalThis, 'fetch')
    .mockResolvedValueOnce({ ok: true, json: async () => ({}) } as Response);
  expect(await searchCities({ query: 'zzzzzz' })).toEqual({ cities: [] });
  fetcher.mockRejectedValueOnce(new Error('offline'));
  await expect(searchCities({ query: 'Paris' })).rejects.toMatchObject({ code: 'unavailable' });
});

it('does not send empty or one-letter searches', async () => {
  const fetcher = jest.spyOn(globalThis, 'fetch');
  expect(await searchCities({ query: 'p' })).toEqual({ cities: [] });
  expect(fetcher).not.toHaveBeenCalled();
});

it('keeps distant namesakes out of the selected city catalog', () => {
  expect(nearCity({ latitude: 45.52, longitude: -122.67 }, testCities[1])).toBe(true);
  expect(nearCity({ latitude: 43.66, longitude: -70.25 }, testCities[1])).toBe(false);
});
