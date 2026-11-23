import type { CityImport } from '@roami/shared';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';

import { db } from './firestore';
import { readTimestampMs } from './PlaceRepository';

// Matches COLLECTIONS.cityImports in shared/src/models.ts.
const CITY_IMPORTS = 'cityImports';

export interface StoredCityImport {
  cityImport: CityImport;
  importedAtMs: number;
}

/** The record of a city's last OpenStreetMap import, or null if it was never imported. */
export async function getCityImport(cityId: string): Promise<StoredCityImport | null> {
  const snapshot = await getDoc(doc(db, CITY_IMPORTS, cityId));
  if (!snapshot.exists()) return null;
  const data = snapshot.data();
  const importedAtMs = readTimestampMs(data.importedAt);
  if (importedAtMs === null) return null;
  return {
    importedAtMs,
    cityImport: {
      cityId: snapshot.id,
      name: String(data.name ?? ''),
      placeCount: Number(data.placeCount) || 0,
      importedAt: new Date(importedAtMs).toISOString(),
    },
  };
}

/** Records a finished import. Written after the places, so a failed import is retried. */
export async function saveCityImport(entry: Omit<CityImport, 'importedAt'>): Promise<void> {
  await setDoc(doc(db, CITY_IMPORTS, entry.cityId), {
    cityId: entry.cityId,
    name: entry.name,
    placeCount: entry.placeCount,
    importedAt: serverTimestamp(),
  });
}
