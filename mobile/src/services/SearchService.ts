import type {
  PlaceSummary,
  Recommendation,
  SearchRecommendationsRequest,
  SearchRecommendationsResponse,
  SearchResult,
} from '@roami/shared';

import { ApiError } from '../api';
import { parseQuery, rankMatches } from '../logic/searchMatcher';
import { listPlacesInCity } from '../repositories/PlaceRepository';
import { listActiveForPlaces } from '../repositories/RecommendationRepository';
import { toRecommendationViews } from './recommendationViews';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;
const MAX_TEXT_LENGTH = 200;
const MAX_INTERESTS = 20;

/**
 * How long a city's places and recommendations are reused between searches.
 * Searching reads the whole city (about 125 documents at pilot size), so
 * without this, typing a few searches would use up the free daily read quota
 * quickly. A recommendation published in the meantime appears after this.
 */
export const SEARCH_CACHE_MS = 60_000;

interface CityData {
  loadedAt: number;
  places: Map<string, PlaceSummary>;
  recommendations: Recommendation[];
}

const cache = new Map<string, CityData>();

/** Forgets cached search data (used by tests, and when fresh results matter). */
export function clearSearchCache(): void {
  cache.clear();
}

async function loadCity(city: string): Promise<CityData> {
  const cached = cache.get(city);
  if (cached && Date.now() - cached.loadedAt < SEARCH_CACHE_MS) return cached;

  const cityPlaces = await listPlacesInCity(city);
  const places = new Map<string, PlaceSummary>(cityPlaces.map((p) => [p.id, p]));
  const recommendations = places.size > 0 ? await listActiveForPlaces([...places.keys()]) : [];
  const data = { loadedAt: Date.now(), places, recommendations };
  cache.set(city, data);
  return data;
}

function checkRequest(request: SearchRecommendationsRequest) {
  const city = typeof request.city === 'string' ? request.city.trim() : '';
  if (city.length === 0) throw new ApiError('invalid-argument', 'Choose a city.');

  const text = typeof request.text === 'string' ? request.text : '';
  if (text.length > MAX_TEXT_LENGTH) {
    throw new ApiError(
      'invalid-argument',
      `Searches can be at most ${MAX_TEXT_LENGTH} characters.`,
    );
  }

  const interests = request.interests ?? [];
  if (!Array.isArray(interests) || interests.some((i) => typeof i !== 'string')) {
    throw new ApiError('invalid-argument', 'Interests must be a list of words.');
  }
  if (interests.length > MAX_INTERESTS) {
    throw new ApiError('invalid-argument', `Choose at most ${MAX_INTERESTS} interests.`);
  }

  const requested = request.limit ?? DEFAULT_LIMIT;
  if (!Number.isInteger(requested) || requested < 1) {
    throw new ApiError('invalid-argument', 'The limit must be a whole number of 1 or more.');
  }
  return { city, text, interests, limit: Math.min(requested, MAX_LIMIT) };
}

/**
 * Searches a city's active recommendations by their tags and written text.
 * Exact matches (including synonyms and prefixes) come first, then broader
 * matches, and each result says why it matched. An empty search returns no
 * results. Matching rules are in src/logic/searchMatcher.ts.
 *
 * Not yet: follows as a tiebreaker, and hiding blocked contributors.
 */
export async function searchRecommendations(
  request: SearchRecommendationsRequest,
): Promise<SearchRecommendationsResponse> {
  const { city, text, interests, limit } = checkRequest(request);
  const { places, recommendations } = await loadCity(city);

  const multiWordTags = recommendations.flatMap((r) => r.tags).filter((t) => t.includes(' '));
  const terms = parseQuery(text, interests, multiWordTags);
  const matches = rankMatches(recommendations, terms).slice(0, limit);
  if (matches.length === 0) return { results: [] };

  const byId = new Map(recommendations.map((r) => [r.id, r]));
  const views = await toRecommendationViews(
    matches.flatMap((m) => byId.get(m.id) ?? []),
    places,
  );
  const viewById = new Map(views.map((v) => [v.id, v]));

  const results: SearchResult[] = matches.flatMap((m) => {
    const recommendation = viewById.get(m.id);
    return recommendation ? [{ recommendation, matchLevel: m.matchLevel, reasons: m.reasons }] : [];
  });
  return { results };
}
