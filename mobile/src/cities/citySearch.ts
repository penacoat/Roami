import type { CityLocation, SearchCitiesRequest, SearchCitiesResponse } from '@roami/shared';
import { ApiError } from '../api/types';

/** Replaceable city lookup; no place records or account data are sent to the provider. */
export async function searchCities({ query }: SearchCitiesRequest): Promise<SearchCitiesResponse> {
  const name = query.trim().slice(0, 100);
  if (name.length < 2) return { cities: [] };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=20&language=en&format=json`,
      { signal: controller.signal },
    );
    if (!response.ok) throw new Error('City lookup unavailable');
    const body: unknown = await response.json();
    if (!body || typeof body !== 'object' || ('error' in body && body.error)) {
      throw new Error('Invalid city response');
    }
    const results = 'results' in body ? body.results : [];
    if (!Array.isArray(results)) throw new Error('Invalid city response');
    const cities: CityLocation[] = results.flatMap((value: Record<string, unknown> | null) => {
      // Populated places only: exclude regions, postcodes, landmarks and neighborhoods.
      if (
        !value ||
        !/^PPL(?:A[2-5]?|C|G|L|R|S)?$/.test(String(value.feature_code)) ||
        typeof value.id !== 'number' ||
        typeof value.name !== 'string' ||
        typeof value.latitude !== 'number' ||
        !Number.isFinite(value.latitude) ||
        Math.abs(value.latitude) > 90 ||
        typeof value.longitude !== 'number' ||
        !Number.isFinite(value.longitude) ||
        Math.abs(value.longitude) > 180
      )
        return [];
      return [
        {
          id: `geonames:${value.id}`,
          name: value.name,
          region: typeof value.admin1 === 'string' ? value.admin1 : '',
          country: typeof value.country === 'string' ? value.country : '',
          latitude: value.latitude,
          longitude: value.longitude,
        },
      ];
    });
    return { cities: cities.slice(0, 8) };
  } catch {
    // A network failure is not evidence that the user's city doesn't exist.
    throw new ApiError(
      'unavailable',
      'City search is unavailable. Check your connection and retry.',
    );
  } finally {
    clearTimeout(timeout);
  }
}
