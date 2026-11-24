import type { CityLocation } from '@roami/shared';
import * as location from 'expo-location';

/** Runs only after the user chooses the location action; never watches GPS. */
export async function currentCity(): Promise<CityLocation> {
  const permission = await location.requestForegroundPermissionsAsync();
  if (!permission.granted) {
    throw new Error('Location access is off. Allow it in Settings, or search for a city.');
  }
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      (async () => {
        const position =
          (await location.getLastKnownPositionAsync({ maxAge: 60000, requiredAccuracy: 1000 })) ??
          (await location.getCurrentPositionAsync({ accuracy: location.Accuracy.Balanced }));
        const { latitude, longitude } = position.coords;
        const addresses = await location.reverseGeocodeAsync({ latitude, longitude });
        const address = addresses.find((item) => item.city?.trim());
        if (!address?.city) throw new Error('No city found here. Search for a nearby city.');
        return {
          id: `local:${[address.city, address.region, address.country].join(':')}`,
          name: address.city.trim(),
          region: address.region ?? '',
          country: address.country ?? '',
          latitude,
          longitude,
        };
      })(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error('Location took too long. Try again, or search for a city.')),
          12000,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
