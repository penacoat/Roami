import { afterEach, expect, it, jest } from '@jest/globals';
import * as api from '../src/api/ApiClient';
import { resolvePlaceCity } from '../src/cities/resolvePlaceCity';
import { testCities } from '../test-utils/cities';

afterEach(() => {
  jest.restoreAllMocks();
});

it('resolves the selected city to the nearby OSM boundary, not its distant namesake', async () => {
  jest.spyOn(api, 'getApiMode').mockReturnValue('live');
  const lookup = jest.spyOn(api, 'callApi').mockResolvedValue({
    matches: [
      {
        cityId: 'osm-relation-132501',
        name: 'Portland',
        label: 'Portland, Maine',
        latitude: 43.66,
        longitude: -70.26,
      },
      {
        cityId: 'osm-relation-186579',
        name: 'Portland',
        label: 'Portland, Oregon',
        latitude: 45.52,
        longitude: -122.67,
      },
    ],
  });
  await expect(resolvePlaceCity(testCities[1])).resolves.toEqual({
    ...testCities[1],
    cityId: 'osm-relation-186579',
  });
  expect(lookup).toHaveBeenCalledTimes(1);
  expect(lookup).toHaveBeenCalledWith('resolveCity', { query: 'Portland, Oregon, United States' });
});

it('does not silently select an unrelated city or hide lookup failures', async () => {
  jest.spyOn(api, 'getApiMode').mockReturnValue('live');
  const lookup = jest.spyOn(api, 'callApi').mockResolvedValue({
    matches: [
      {
        cityId: 'osm-relation-132501',
        name: 'Portland',
        label: 'Portland, Maine',
        latitude: 43.66,
        longitude: -70.26,
      },
    ],
  });
  await expect(resolvePlaceCity(testCities[1])).rejects.toThrow('Places are not available');
  lookup.mockRejectedValue(new Error('offline'));
  await expect(resolvePlaceCity(testCities[1])).rejects.toThrow('offline');
});

it('reuses an existing provider ID and keeps fixture selections offline', async () => {
  jest.spyOn(api, 'getApiMode').mockReturnValue('fixtures');
  const lookup = jest.spyOn(api, 'callApi');
  await expect(resolvePlaceCity(testCities[0])).resolves.toEqual(testCities[0]);
  jest.spyOn(api, 'getApiMode').mockReturnValue('live');
  const city = { ...testCities[0], cityId: 'osm-relation-237385' };
  await expect(resolvePlaceCity(city)).resolves.toEqual(city);
  expect(lookup).not.toHaveBeenCalled();
});
