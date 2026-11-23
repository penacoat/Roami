import type { PlaceSummary } from '@roami/shared';

export const categoryName = (category: string) => category.trim() || 'Uncategorized';
export const label = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);
export const hasCoordinates = (place: PlaceSummary) =>
  Number.isFinite(place.latitude) &&
  Number.isFinite(place.longitude) &&
  Math.abs(place.latitude) <= 90 &&
  Math.abs(place.longitude) <= 180;
