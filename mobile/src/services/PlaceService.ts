import type { ListPlacesRequest, ListPlacesResponse } from '@roami/shared';

import { ApiError } from '../api';
import { listPlacesInCity } from '../repositories/PlaceRepository';

export async function listPlaces(request: ListPlacesRequest): Promise<ListPlacesResponse> {
  const city = request.city.trim();
  if (city.length === 0) {
    throw new ApiError('invalid-argument', 'Choose a city.');
  }
  const places = await listPlacesInCity(city);
  places.sort((a, b) => a.name.localeCompare(b.name));
  return { places };
}
