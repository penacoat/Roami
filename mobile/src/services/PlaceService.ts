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
  MAX_PLACES_PER_CITY,
  buildOverpassQuery,
  isCurrent,
  isStale,
  mergeOverpass,
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

// After the food download fails for a city, wait this long before asking
// OpenStreetMap for it again, so reopening the city doesn't hammer a busy server.
const FOOD_RETRY_MS = 10 * 60 * 1000;
const foodRetryAfter = new Map<string, number>();

/** Forgets imports in progress and retry timers (used by tests). */
export function resetPlaceImports(): void {
  importsInFlight.clear();
  foodRetryAfter.clear();
}

const toSummary = ({
  id,
  name,
  latitude,
  longitude,
  category,
  openingHours,
  missingFields,
}: PlaceSummary): PlaceSummary => ({
  id,
  name,
  latitude,
  longitude,
  category,
  openingHours,
  missingFields,
});

/**
 * Downloads a city's places from OpenStreetMap and stores them: new places are
 * created and stale ones rewritten (planImport). Returns the places now stored.
 *
 * Sights come first. Food and shops are a second download that is skipped when
 * the sights already fill the city's place limit. If it fails (it can time out
 * in a huge city), the sights are still saved and shown, but the city is not
 * marked imported, so a later visit tries again. `resume` means an earlier
 * attempt already saved the sights, so only food and shops are downloaded.
 * The cityImports record is written last.
 */
async function importCity(
  city: string,
  cityId: string,
  imported: StoredImportedPlace[],
  resume: boolean,
): Promise<PlaceSummary[]> {
  const relationId = relationIdOf(cityId) as number;
  const now = Date.now();
  const retrievedAt = new Date(now).toISOString();
  const cityRef = { cityId, name: city };

  let sights: unknown = null;
  if (!resume) {
    try {
      sights = await fetchOverpass(buildOverpassQuery(relationId, 'sights'));
    } catch (error) {
      // eslint-disable-next-line no-console
      console.warn(`[places] Could not download sights in ${city} from OpenStreetMap`, error);
      throw new ApiError(
        'unavailable',
        `Could not load places in ${city} from OpenStreetMap. Check your connection and try again.`,
      );
    }
  }
  const sightCount = resume ? imported.length : parseOverpass(sights, cityRef, retrievedAt).length;

  let food: unknown = null;
  let complete = true;
  if (sightCount < MAX_PLACES_PER_CITY) {
    try {
      food = await fetchOverpass(buildOverpassQuery(relationId, 'food'));
      foodRetryAfter.delete(cityId);
    } catch (error) {
      complete = false;
      foodRetryAfter.set(cityId, now + FOOD_RETRY_MS);
      // eslint-disable-next-line no-console
      console.warn(`[places] Could not download food and shops in ${city}; will retry`, error);
    }
  }

  const fetched = parseOverpass(
    mergeOverpass(sights, food),
    cityRef,
    retrievedAt,
    MAX_PLACES_PER_CITY - (resume ? imported.length : 0),
  );
  const existing = new Map(
    imported
      .filter((entry) => entry.importedAtMs !== null)
      .map((entry) => [entry.place.id, entry.importedAtMs as number]),
  );
  const plan = planImport(fetched, existing, now);
  const written = await writeImportedPlaces([...plan.create, ...plan.update]);
  if (complete) {
    const placeCount = fetched.length + (resume ? imported.length : 0);
    await saveCityImport({ cityId, name: city, placeCount });
  }

  // Everything fetched is stored now: written just now, or left alone because
  // it was already fresh. A place someone else refused to let us write is left out.
  const stored = fetched
    .filter((place) => written.has(place.id) || existing.has(place.id))
    .map(toSummary);
  if (!resume) return stored;
  const ids = new Set(stored.map((place) => place.id));
  return [...imported.map((entry) => entry.place).filter((place) => !ids.has(place.id)), ...stored];
}

function importOnce(
  city: string,
  cityId: string,
  imported: StoredImportedPlace[],
  resume: boolean,
): Promise<PlaceSummary[]> {
  const running = importsInFlight.get(cityId);
  if (running) return running;
  const started = importCity(city, cityId, imported, resume).finally(() =>
    importsInFlight.delete(cityId),
  );
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
    // Places already stored but no import record: an earlier attempt saved the
    // sights and only the food download is missing. Don't ask again right after
    // it failed, so a busy OpenStreetMap server isn't hit on every visit.
    const resume = imported.length > 0;
    if (resume && Date.now() < (foodRetryAfter.get(cityId) ?? 0)) {
      return { places: visiblePlaces(manual, imported, null) };
    }
    const fresh = await importOnce(city, cityId, imported, resume).catch((error: unknown) => {
      if (!resume) throw error;
      // The retry failed; keep showing what is stored, and try again later.
      // eslint-disable-next-line no-console
      console.warn(`[places] Could not finish importing ${city}`, error);
      return imported.map((entry) => entry.place);
    });
    return { places: [...manual, ...withoutDuplicatesOf(fresh, manual)].sort(byName) };
  }

  if (isStale(cityImport.importedAtMs, Date.now())) {
    importOnce(city, cityId, imported, false).catch((error: unknown) => {
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
