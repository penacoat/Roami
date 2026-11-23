// listPlaces and resolveCity with OpenStreetMap and Firestore mocked out.
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import type { PlaceSummary } from '@roami/shared';

import { ApiError } from '../src/api';
import { REFRESH_MS } from '../src/logic/osmPlaces';
import * as cityImports from '../src/repositories/CityImportRepository';
import * as osm from '../src/repositories/OsmRepository';
import * as placesRepo from '../src/repositories/PlaceRepository';
import { listPlaces, resetPlaceImports, resolveCity } from '../src/services/PlaceService';

jest.mock('../src/repositories/firestore', () => ({ db: {} }));
jest.mock('../src/repositories/CityImportRepository');
jest.mock('../src/repositories/OsmRepository');
jest.mock('../src/repositories/PlaceRepository');
jest.mock('../src/repositories/RecommendationRepository');

const mocked = {
  getCityImport: jest.mocked(cityImports.getCityImport),
  saveCityImport: jest.mocked(cityImports.saveCityImport),
  searchCities: jest.mocked(osm.searchCities),
  fetchOverpass: jest.mocked(osm.fetchOverpass),
  listImportedPlaces: jest.mocked(placesRepo.listImportedPlaces),
  listManualPlaces: jest.mocked(placesRepo.listManualPlaces),
  listPlacesInCity: jest.mocked(placesRepo.listPlacesInCity),
  writeImportedPlaces: jest.mocked(placesRepo.writeImportedPlaces),
};

const PORTLAND = 'osm-relation-186579';
const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.parse('2026-11-22T12:00:00Z');

const summary = (
  id: string,
  name: string,
  latitude = 45.52,
  longitude = -122.67,
): PlaceSummary => ({
  id,
  name,
  latitude,
  longitude,
  category: 'museum',
  openingHours: null,
  missingFields: ['openingHours'],
});

const overpass = (...names: string[]) => ({
  elements: names.map((name, i) => ({
    type: 'node',
    id: i + 1,
    lat: 45.52,
    lon: -122.67,
    tags: { name, tourism: 'museum' },
  })),
});

async function rejectsWith(promise: Promise<unknown>, code: string) {
  await expect(promise).rejects.toBeInstanceOf(ApiError);
  await expect(promise).rejects.toMatchObject({ code });
}

beforeEach(() => {
  jest.resetAllMocks();
  jest.spyOn(Date, 'now').mockReturnValue(NOW);
  resetPlaceImports();
  mocked.listManualPlaces.mockResolvedValue([]);
  mocked.listImportedPlaces.mockResolvedValue([]);
  mocked.getCityImport.mockResolvedValue(null);
  mocked.saveCityImport.mockResolvedValue();
  mocked.writeImportedPlaces.mockImplementation(async (places) => new Set(places.map((p) => p.id)));
});

describe('resolveCity', () => {
  it('returns the cities OpenStreetMap knows by that name', async () => {
    mocked.searchCities.mockResolvedValue([
      {
        osm_type: 'relation',
        osm_id: 186579,
        lat: '45.5',
        lon: '-122.6',
        name: 'Portland',
        address: { state: 'Oregon', country: 'United States' },
      },
    ]);
    const { matches } = await resolveCity({ query: '  portland  ' });
    expect(mocked.searchCities).toHaveBeenCalledWith('portland');
    expect(matches).toEqual([
      expect.objectContaining({ cityId: PORTLAND, label: 'Portland, Oregon, United States' }),
    ]);
  });
  it('checks the request', async () => {
    await rejectsWith(resolveCity({ query: ' ' }), 'invalid-argument');
    await rejectsWith(resolveCity({ query: 'x'.repeat(101) }), 'invalid-argument');
    expect(mocked.searchCities).not.toHaveBeenCalled();
  });
  it('says the lookup is unavailable when OpenStreetMap is unreachable', async () => {
    mocked.searchCities.mockRejectedValue(new Error('offline'));
    await rejectsWith(resolveCity({ query: 'Portland' }), 'unavailable');
  });
});

describe('listPlaces', () => {
  it('works as before without a cityId (no OpenStreetMap)', async () => {
    mocked.listPlacesInCity.mockResolvedValue([summary('p-b', 'B'), summary('p-a', 'A')]);
    const { places } = await listPlaces({ city: 'Seattle' });
    expect(places.map((p) => p.id)).toEqual(['p-a', 'p-b']);
    expect(mocked.fetchOverpass).not.toHaveBeenCalled();
  });

  it('refuses a cityId that is not an OpenStreetMap city', async () => {
    await rejectsWith(listPlaces({ city: 'Portland', cityId: 'Portland' }), 'invalid-argument');
    await rejectsWith(listPlaces({ city: ' ', cityId: PORTLAND }), 'invalid-argument');
  });

  it('imports a city opened for the first time, then records the import', async () => {
    mocked.fetchOverpass.mockResolvedValue(overpass('Art Museum', 'History Museum'));
    const { places } = await listPlaces({ city: 'Portland', cityId: PORTLAND });

    expect(mocked.fetchOverpass.mock.calls[0][0]).toContain('area(id:3600186579)');
    const written = mocked.writeImportedPlaces.mock.calls[0][0];
    expect(written.map((p) => p.id)).toEqual(['osm-node-1', 'osm-node-2']);
    expect(written[0]).toMatchObject({
      city: 'Portland',
      cityId: PORTLAND,
      source: { provider: 'osm' },
    });
    expect(mocked.saveCityImport).toHaveBeenCalledWith({
      cityId: PORTLAND,
      name: 'Portland',
      placeCount: 2,
    });
    expect(places.map((p) => p.name)).toEqual(['Art Museum', 'History Museum']);
  });

  it('records the import only after the places are written', async () => {
    mocked.fetchOverpass.mockResolvedValue(overpass('Art Museum'));
    mocked.writeImportedPlaces.mockRejectedValue(new Error('offline'));
    await expect(listPlaces({ city: 'Portland', cityId: PORTLAND })).rejects.toThrow();
    expect(mocked.saveCityImport).not.toHaveBeenCalled();
  });

  it('says places are unavailable when OpenStreetMap is unreachable, and saves nothing', async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    mocked.fetchOverpass.mockRejectedValue(new Error('busy'));
    await rejectsWith(listPlaces({ city: 'Portland', cityId: PORTLAND }), 'unavailable');
    expect(mocked.writeImportedPlaces).not.toHaveBeenCalled();
    expect(mocked.saveCityImport).not.toHaveBeenCalled();
  });

  it('finishes a half-done import without rewriting the places it already stored', async () => {
    mocked.listImportedPlaces.mockResolvedValue([
      { place: summary('osm-node-1', 'Art Museum'), importedAtMs: NOW - DAY },
    ]);
    mocked.fetchOverpass.mockResolvedValue(overpass('Art Museum', 'History Museum'));
    const { places } = await listPlaces({ city: 'Portland', cityId: PORTLAND });
    expect(mocked.writeImportedPlaces.mock.calls[0][0].map((p) => p.id)).toEqual(['osm-node-2']);
    expect(places).toHaveLength(2);
  });

  it('leaves out a place another user would not let this import write', async () => {
    mocked.fetchOverpass.mockResolvedValue(overpass('Art Museum', 'History Museum'));
    mocked.writeImportedPlaces.mockResolvedValue(new Set(['osm-node-2']));
    const { places } = await listPlaces({ city: 'Portland', cityId: PORTLAND });
    expect(places.map((p) => p.id)).toEqual(['osm-node-2']);
  });

  it('imports a city once even when asked twice at the same time', async () => {
    mocked.fetchOverpass.mockResolvedValue(overpass('Art Museum'));
    await Promise.all([
      listPlaces({ city: 'Portland', cityId: PORTLAND }),
      listPlaces({ city: 'Portland', cityId: PORTLAND }),
    ]);
    expect(mocked.fetchOverpass).toHaveBeenCalledTimes(2); // sights, then food
  });

  it('downloads sights and food separately and saves both', async () => {
    mocked.fetchOverpass.mockImplementation(async (query) =>
      query.includes('restaurant')
        ? {
            elements: [
              {
                type: 'node',
                id: 2,
                lat: 45.5,
                lon: -122.6,
                tags: { name: 'Diner', amenity: 'restaurant' },
              },
            ],
          }
        : overpass('Art Museum'),
    );
    const { places } = await listPlaces({ city: 'Portland', cityId: PORTLAND });
    expect(places.map((p) => p.name)).toEqual(['Art Museum', 'Diner']);
    expect(mocked.saveCityImport).toHaveBeenCalledWith({
      cityId: PORTLAND,
      name: 'Portland',
      placeCount: 2,
    });
  });

  it('keeps the sights of a huge city when its food download times out, and retries later', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    mocked.fetchOverpass.mockImplementation(async (query) => {
      if (query.includes('restaurant')) throw new Error('timed out');
      return overpass('Art Museum');
    });
    const { places } = await listPlaces({ city: 'New York', cityId: 'osm-relation-175905' });
    expect(places.map((p) => p.name)).toEqual(['Art Museum']);
    expect(mocked.writeImportedPlaces).toHaveBeenCalled();
    expect(mocked.saveCityImport).not.toHaveBeenCalled(); // not marked done, so it's retried
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('logs why a download failed', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    mocked.fetchOverpass.mockRejectedValue(new Error('HTTP 504'));
    await rejectsWith(listPlaces({ city: 'Portland', cityId: PORTLAND }), 'unavailable');
    expect(warn.mock.calls[0].join(' ')).toContain('HTTP 504');
    warn.mockRestore();
  });

  it('reads a recently imported city from Firestore only', async () => {
    mocked.getCityImport.mockResolvedValue({
      importedAtMs: NOW - 10 * DAY,
      cityImport: { cityId: PORTLAND, name: 'Portland', placeCount: 1, importedAt: '' },
    });
    mocked.listImportedPlaces.mockResolvedValue([
      { place: summary('osm-node-1', 'Art Museum'), importedAtMs: NOW - 10 * DAY },
    ]);
    const { places } = await listPlaces({ city: 'Portland', cityId: PORTLAND });
    expect(places.map((p) => p.id)).toEqual(['osm-node-1']);
    expect(mocked.fetchOverpass).not.toHaveBeenCalled();
  });

  it('returns stored places right away and refreshes a stale city in the background', async () => {
    const cityImportedAt = NOW - REFRESH_MS - DAY;
    mocked.getCityImport.mockResolvedValue({
      importedAtMs: cityImportedAt,
      cityImport: { cityId: PORTLAND, name: 'Portland', placeCount: 2, importedAt: '' },
    });
    mocked.listImportedPlaces.mockResolvedValue([
      { place: summary('osm-node-1', 'Art Museum'), importedAtMs: cityImportedAt },
      { place: summary('osm-node-9', 'Closed Gallery'), importedAtMs: cityImportedAt },
    ]);
    let finishRefresh: (value: unknown) => void = () => undefined;
    mocked.fetchOverpass.mockReturnValue(new Promise((resolve) => (finishRefresh = resolve)));

    const { places } = await listPlaces({ city: 'Portland', cityId: PORTLAND });
    expect(places.map((p) => p.id)).toEqual(['osm-node-1', 'osm-node-9']);
    expect(mocked.saveCityImport).not.toHaveBeenCalled();

    // The refresh finds the museum again and a new one; the gallery is gone.
    finishRefresh(overpass('Art Museum', 'New Museum'));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(mocked.writeImportedPlaces.mock.calls[0][0].map((p) => p.id).sort()).toEqual([
      'osm-node-1',
      'osm-node-2',
    ]);
    expect(mocked.saveCityImport).toHaveBeenCalledWith({
      cityId: PORTLAND,
      name: 'Portland',
      placeCount: 2,
    });
  });

  it('keeps showing stored places when a background refresh fails', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    mocked.getCityImport.mockResolvedValue({
      importedAtMs: NOW - REFRESH_MS - DAY,
      cityImport: { cityId: PORTLAND, name: 'Portland', placeCount: 1, importedAt: '' },
    });
    mocked.listImportedPlaces.mockResolvedValue([
      { place: summary('osm-node-1', 'Art Museum'), importedAtMs: NOW - REFRESH_MS - DAY },
    ]);
    mocked.fetchOverpass.mockRejectedValue(new Error('busy'));
    const { places } = await listPlaces({ city: 'Portland', cityId: PORTLAND });
    expect(places).toHaveLength(1);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('hides places the latest refresh no longer found', async () => {
    mocked.getCityImport.mockResolvedValue({
      importedAtMs: NOW - DAY,
      cityImport: { cityId: PORTLAND, name: 'Portland', placeCount: 1, importedAt: '' },
    });
    mocked.listImportedPlaces.mockResolvedValue([
      { place: summary('osm-node-1', 'Art Museum'), importedAtMs: NOW - DAY },
      { place: summary('osm-node-9', 'Closed Gallery'), importedAtMs: NOW - REFRESH_MS - 3 * DAY },
    ]);
    const { places } = await listPlaces({ city: 'Portland', cityId: PORTLAND });
    expect(places.map((p) => p.id)).toEqual(['osm-node-1']);
  });

  it('shows hand-made places and drops imported copies of them', async () => {
    mocked.getCityImport.mockResolvedValue({
      importedAtMs: NOW - DAY,
      cityImport: { cityId: 'osm-relation-237385', name: 'Seattle', placeCount: 2, importedAt: '' },
    });
    mocked.listManualPlaces.mockResolvedValue([
      summary('p-pike', 'Pike Place Market', 47.6097, -122.3425),
    ]);
    mocked.listImportedPlaces.mockResolvedValue([
      {
        place: summary('osm-way-1', 'Pike Place Market', 47.6094, -122.3422),
        importedAtMs: NOW - DAY,
      },
      {
        place: summary('osm-node-2', 'Seattle Aquarium', 47.6076, -122.343),
        importedAtMs: NOW - DAY,
      },
    ]);
    const { places } = await listPlaces({ city: 'Seattle', cityId: 'osm-relation-237385' });
    expect(places.map((p) => p.id)).toEqual(['p-pike', 'osm-node-2']);
  });
});
