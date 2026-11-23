import type { CityLocation } from '@roami/shared';
import { callApi, getApiMode } from '../api';
import { cityLabel, nearCity } from './CityProvider';

/** Autocomplete uses GeoNames; Nominatim is called only for a confirmed selection. */
export async function resolvePlaceCity(city: CityLocation): Promise<CityLocation> {
  if (city.cityId || getApiMode() === 'fixtures') return city;
  const { matches } = await callApi('resolveCity', { query: cityLabel(city).slice(0, 100) });
  const nearby = matches.filter((match) => nearCity(match, city));
  nearby.sort(
    (a, b) =>
      Math.hypot(
        a.latitude - city.latitude,
        (a.longitude - city.longitude) * Math.cos((city.latitude * Math.PI) / 180),
      ) -
      Math.hypot(
        b.latitude - city.latitude,
        (b.longitude - city.longitude) * Math.cos((city.latitude * Math.PI) / 180),
      ),
  );
  const match = nearby[0];
  if (!match) throw new Error('Places are not available for this city yet. Choose another city.');
  return { ...city, cityId: match.cityId };
}
