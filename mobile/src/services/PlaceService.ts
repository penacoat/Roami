import type {
  GetPlaceRequest,
  GetPlaceResponse,
  ListPlacesRequest,
  ListPlacesResponse,
} from '@roami/shared';

import { ApiError } from '../api';
import { getPlacesByIds, listPlacesInCity } from '../repositories/PlaceRepository';
import { listActiveForPlace } from '../repositories/RecommendationRepository';
import { toRecommendationViews } from './recommendationViews';

export async function listPlaces(request: ListPlacesRequest): Promise<ListPlacesResponse> {
  const city = request.city.trim();
  if (city.length === 0) {
    throw new ApiError('invalid-argument', 'Choose a city.');
  }
  const places = await listPlacesInCity(city);
  places.sort((a, b) => a.name.localeCompare(b.name));
  return { places };
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
