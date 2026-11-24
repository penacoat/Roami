import type { GetFeedRequest, GetFeedResponse, PlaceSummary } from '@roami/shared';

import { ApiError } from '../api';
import { decodeCursor, pageAfter } from '../logic/feedPaging';
import { relationIdOf } from '../logic/osmPlaces';
import { getCurrentUserId } from '../auth/AuthService';
import { listFolloweeIds } from '../repositories/FollowRepository';
import {
  listActiveForAuthors,
  listActiveForPlaces,
} from '../repositories/RecommendationRepository';
import { listCityPlaces } from './PlaceService';
import { toRecommendationViews } from './recommendationViews';

const DEFAULT_FEED_LIMIT = 20;
const MAX_FEED_LIMIT = 50;

/**
 * The newest active recommendations for places in a city, a page at a time.
 * Pass the `nextCursor` of one page as the `cursor` of the next.
 *
 * Recommendations don't store a city, so this reads the city's places, then the
 * active recommendations for those places, and sorts them in the app. That needs
 * no composite index, and at pilot size (about 50 places and 75 recommendations)
 * it reads about 125 documents per call. Add caching before the catalog grows.
 *
 * The following feed is limited to contributors followed by the signed-in user.
 */
export async function getFeed(request: GetFeedRequest): Promise<GetFeedResponse> {
  const city = typeof request.city === 'string' ? request.city.trim() : '';
  if (city.length === 0) throw new ApiError('invalid-argument', 'Choose a city.');
  const cityId = request.cityId ?? null;
  if (cityId !== null && (typeof cityId !== 'string' || relationIdOf(cityId) === null)) {
    throw new ApiError('invalid-argument', 'Choose a city.');
  }

  const requested = request.limit ?? DEFAULT_FEED_LIMIT;
  if (!Number.isInteger(requested) || requested < 1) {
    throw new ApiError('invalid-argument', 'The limit must be a whole number of 1 or more.');
  }
  const limit = Math.min(requested, MAX_FEED_LIMIT);
  const followingUserId = request.followingOnly ? getCurrentUserId() : null;
  if (request.followingOnly && !followingUserId) {
    throw new ApiError('unauthenticated', 'Sign in to view your following feed.');
  }
  const cursor = request.cursor ?? null;
  if (cursor !== null && (typeof cursor !== 'string' || !isValidCursor(cursor))) {
    throw new ApiError('invalid-argument', 'That page of postcards is no longer valid. Refresh.');
  }

  const cityPlaces = await listCityPlaces(city, cityId);
  if (cityPlaces.length === 0) return { items: [] };

  const places = new Map<string, PlaceSummary>(cityPlaces.map((p) => [p.id, p]));
  let recommendations;
  if (followingUserId !== null) {
    const followeeIds = await listFolloweeIds(followingUserId);
    recommendations = followeeIds.length ? await listActiveForAuthors(followeeIds) : [];
  } else {
    recommendations = await listActiveForPlaces([...places.keys()]);
  }
  const inCity = recommendations.filter((recommendation) => places.has(recommendation.placeId));
  const { page, nextCursor } = pageAfter(inCity, cursor, limit);
  if (page.length === 0) return { items: [] };
  return { items: await toRecommendationViews(page, places), nextCursor };
}

function isValidCursor(cursor: string): boolean {
  return decodeCursor(cursor) !== null;
}
