import type { GetFeedRequest, GetFeedResponse, PlaceSummary } from '@roami/shared';

import { ApiError } from '../api';
import { listPlacesInCity } from '../repositories/PlaceRepository';
import { listActiveForPlaces } from '../repositories/RecommendationRepository';
import { toRecommendationViews } from './recommendationViews';

const DEFAULT_FEED_LIMIT = 20;
const MAX_FEED_LIMIT = 50;

/**
 * The newest active recommendations for places in a city.
 *
 * Recommendations don't store a city, so this reads the city's places, then the
 * active recommendations for those places, and sorts them in the app. That needs
 * no composite index, and at pilot size (about 50 places and 75 recommendations)
 * it reads about 125 documents per call. Add caching before the catalog grows.
 *
 * Not yet: personalization by interests, follows, or blocked contributors.
 */
export async function getFeed(request: GetFeedRequest): Promise<GetFeedResponse> {
  const city = typeof request.city === 'string' ? request.city.trim() : '';
  if (city.length === 0) throw new ApiError('invalid-argument', 'Choose a city.');

  const requested = request.limit ?? DEFAULT_FEED_LIMIT;
  if (!Number.isInteger(requested) || requested < 1) {
    throw new ApiError('invalid-argument', 'The limit must be a whole number of 1 or more.');
  }
  const limit = Math.min(requested, MAX_FEED_LIMIT);

  const cityPlaces = await listPlacesInCity(city);
  if (cityPlaces.length === 0) return { items: [] };

  const places = new Map<string, PlaceSummary>(cityPlaces.map((p) => [p.id, p]));
  const recommendations = await listActiveForPlaces([...places.keys()]);
  // Pick the newest first, so author names are read only for what's shown.
  const newest = recommendations
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id))
    .slice(0, limit);
  return { items: await toRecommendationViews(newest, places) };
}
