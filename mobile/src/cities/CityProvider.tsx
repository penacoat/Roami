import type { CityLocation } from '@roami/shared';
import React, { createContext, useContext, useMemo, useState } from 'react';

const DEFAULT_CITY: CityLocation = {
  id: 'geonames:5809844',
  name: 'Seattle',
  region: 'Washington',
  country: 'United States',
  latitude: 47.6062,
  longitude: -122.3321,
};
type Selection = {
  city: CityLocation;
  setCity: React.Dispatch<React.SetStateAction<CityLocation>>;
};
const CityContext = createContext<Selection | null>(null);

export function CityProvider({ children }: React.PropsWithChildren) {
  const [city, setCity] = useState(DEFAULT_CITY);
  const value = useMemo(() => ({ city, setCity }), [city]);
  return <CityContext.Provider value={value}>{children}</CityContext.Provider>;
}

export function useCity() {
  const shared = useContext(CityContext);
  const [city, setCity] = useState(DEFAULT_CITY);
  return shared ?? { city, setCity };
}

export const cityLabel = (city: CityLocation) =>
  [...new Set([city.name, city.region, city.country].filter(Boolean))].join(', ');

// The existing catalog is keyed by city name. Avoid mixing distant namesakes
// until the team's place provider supports canonical city IDs.
export function nearCity(place: { latitude: number; longitude: number }, city: CityLocation) {
  const radians = Math.PI / 180;
  const dLat = (place.latitude - city.latitude) * radians;
  const dLon = (place.longitude - city.longitude) * radians;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(city.latitude * radians) *
      Math.cos(place.latitude * radians) *
      Math.sin(dLon / 2) ** 2;
  return Number.isFinite(a) && 12742 * Math.asin(Math.sqrt(Math.min(1, a))) <= 80;
}
