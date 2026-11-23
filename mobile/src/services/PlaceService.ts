import type {
  GetPlaceRequest,
  GetPlaceResponse,
  ListPlacesRequest,
  ListPlacesResponse,
  PlaceSummary,
  ResolveCityRequest,
  ResolveCityResponse,
} from '@roami/shared';

import { ApiError } from '../api';
import {
  buildOverpassQuery,
  isCurrent,
  isStale,
  parseNominatim,
  parseOverpass,
  planImport,
  relationIdOf,
  withoutDuplicatesOf,
} from '../logic/osmPlaces';
import { getCityImport, saveCityImport } from '../repositories/CityImportRepository';
import { fetchOverpass, searchCities } from '../repositories/OsmRepository';
import {
  getPlacesByIds,
  listImportedPlaces,
  listManualPlaces,
  listPlacesInCity,
  writeImportedPlaces,
  type StoredImportedPlace,
} from '../repositories/PlaceRepository';
import { listActiveForPlace } from '../repositories/RecommendationRepository';
import { toRecommendationViews } from './recommendationViews';

const MAX_QUERY_LENGTH = 100;
const MAX_CITY_MATCHES = 5;

export async function resolveCity(request: ResolveCityRequest): Promise<ResolveCityResponse> {
  const text = typeof request.query === 'string' ? request.query.trim().replace(/\s+/g, ' ') : '';
  if (text.length === 0) throw new ApiError('invalid-argument', 'Enter a city name.');
  if (text.length > MAX_QUERY_LENGTH) {
    throw new ApiError('invalid-argument', 'That city name is too long.');
  }
  try {
    return { matches: parseNominatim(await searchCities(text)).slice(0, MAX_CITY_MATCHES) };
  } catch {
    throw new ApiError(
      'unavailable',
      'Could not look up cities right now. Check your connection and try again.',
    );
  }
}

function checkCity(request: { city?: unknown; cityId?: unknown }): {
  city: string;
  cityId: string | null;
} {
  const city = typeof request.city === 'string' ? request.city.trim() : '';
  if (city.length === 0) throw new ApiError('invalid-argument', 'Choose a city.');
  if (request.cityId === undefined) return { city, cityId: null };
  const cityId = typeof request.cityId === 'string' ? request.cityId : '';
  if (relationIdOf(cityId) === null) throw new ApiError('invalid-argument', 'Choose a city.');
  return { city, cityId };
}

const byName = (a: PlaceSummary, b: PlaceSummary) => a.name.localeCompare(b.name);

/** Hand-made places plus imported places still in OSM, without duplicates. */
function visiblePlaces(
  manual: PlaceSummary[],
  imported: StoredImportedPlace[],
  cityImportedAtMs: number | null,
): PlaceSummary[] {
  const current = imported
    .filter(
      ({ importedAtMs }) =>
        importedAtMs !== null &&
        (cityImportedAtMs === null || isCurrent(importedAtMs, cityImportedAtMs)),
    )
    .map(({ place }) => place);
  return [...manual, ...withoutDuplicatesOf(current, manual)].sort(byName);
}

// One import per city at a time from this phone, even if the screen asks twice.
const importsInFlight = new Map<string, Promise<PlaceSummary[]>>();

/** Forgets imports in progress (used by tests). */
export function resetPlaceImports(): void {
  importsInFlight.clear();
}

/**
 * Downloads a city's places from OpenStreetMap and stores them: new places are
 * created and stale ones rewritten (planImport). The cityImports record is
 * written last, so if anything fails the next visit tries again. Returns the
 * places now stored for the city.
 */
async function importCity(
  city: string,
  cityId: string,
  imported: StoredImportedPlace[],
): Promise<PlaceSummary[]> {
  const relationId = relationIdOf(cityId) as number;
  const now = Date.now();
  let json: unknown;
  try {
    json = await fetchOverpass(buildOverpassQuery(relationId));
  } catch {
    throw new ApiError(
      'unavailable',
      `Could not load places in ${city} from OpenStreetMap. Check your connection and try again.`,
    );
  }
  const fetched = parseOverpass(json, { cityId, name: city }, new Date(now).toISOString());
  const existing = new Map(
    imported
      .filter((entry) => entry.importedAtMs !== null)
      .map((entry) => [entry.place.id, entry.importedAtMs as number]),
  );
  const plan = planImport(fetched, existing, now);
  const written = await writeImportedPlaces([...plan.create, ...plan.update]);
  await saveCityImport({ cityId, name: city, placeCount: fetched.length });

  // Everything fetched is stored now: written just now, or left alone because
  // it was already fresh. A place someone else refused to let us write is left out.
  const stored = fetched.filter((place) => written.has(place.id) || existing.has(place.id));
  return stored.map(({ id, name, latitude, longitude, category, openingHours, missingFields }) => ({
    id,
    name,
    latitude,
    longitude,
    category,
    openingHours,
    missingFields,
  }));
}

function importOnce(
  city: string,
  cityId: string,
  imported: StoredImportedPlace[],
): Promise<PlaceSummary[]> {
  const running = importsInFlight.get(cityId);
  if (running) return running;
  const started = importCity(city, cityId, imported).finally(() => importsInFlight.delete(cityId));
  importsInFlight.set(cityId, started);
  return started;
}

/**
 * The places shown for a city, without importing anything. With a cityId this
 * is the hand-made places for the name plus the city's current imported places.
 * Without one, it is every place stored under the city name (as before imports).
 */
export async function listCityPlaces(city: string, cityId: string | null): Promise<PlaceSummary[]> {
  if (cityId === null) return listPlacesInCity(city);
  const [manual, imported, cityImport] = await Promise.all([
    listManualPlaces(city),
    listImportedPlaces(cityId),
    getCityImport(cityId),
  ]);
  return visiblePlaces(manual, imported, cityImport?.importedAtMs ?? null);
}

/**
 * A city's places for the map. A city opened for the first time is imported
 * from OpenStreetMap first. A city imported more than REFRESH_DAYS ago returns
 * its stored places right away and is refreshed in the background.
 */
export async function listPlaces(request: ListPlacesRequest): Promise<ListPlacesResponse> {
  const { city, cityId } = checkCity(request);
  if (cityId === null) {
    const places = await listPlacesInCity(city);
    return { places: places.sort(byName) };
  }

  const [manual, imported, cityImport] = await Promise.all([
    listManualPlaces(city),
    listImportedPlaces(cityId),
    getCityImport(cityId),
  ]);

  if (!cityImport) {
    const fresh = await importOnce(city, cityId, imported);
    return { places: [...manual, ...withoutDuplicatesOf(fresh, manual)].sort(byName) };
  }

  if (isStale(cityImport.importedAtMs, Date.now())) {
    importOnce(city, cityId, imported).catch((error: unknown) => {
      // The stored places are still shown; the next visit tries again.
      // eslint-disable-next-line no-console
      console.warn(`[places] Background refresh of ${city} failed`, error);
    });
  }
  return { places: visiblePlaces(manual, imported, cityImport.importedAtMs) };
}

/** A place and its active recommendations, newest first (what a map marker opens). */
export async function getPlace(request: GetPlaceRequest): Promise<GetPlaceResponse> {
  const placeId = typeof request.placeId === 'string' ? request.placeId.trim() : '';
  if (placeId.length === 0) throw new ApiError('invalid-argument', 'Choose a place.');

  const [places, recommendations] = await Promise.all([
    getPlacesByIds([placeId]),
    listActiveForPlace(placeId),
  ]);
  const place = places.get(placeId);
  if (!place) throw new ApiError('not-found', 'That place is not in the catalog.');

  return { place, recommendations: await toRecommendationViews(recommendations, places) };
}
