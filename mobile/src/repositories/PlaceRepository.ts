import type { PlaceSummary } from '@roami/shared';
import { collection, getDocs, query, where, type DocumentData } from 'firebase/firestore';

import { db } from './firestore';

// Matches COLLECTIONS.places in shared/src/models.ts. It is written out here
// because the app can only import types from shared, not values.
const PLACES = 'places';

function toPlaceSummary(id: string, data: DocumentData): PlaceSummary {
  return {
    id,
    name: String(data.name ?? ''),
    latitude: Number(data.latitude),
    longitude: Number(data.longitude),
    category: String(data.category ?? ''),
    // null means unknown, not closed. Never turn a missing value into a default.
    openingHours: typeof data.openingHours === 'string' ? data.openingHours : null,
    missingFields: Array.isArray(data.missingFields) ? data.missingFields.map(String) : [],
  };
}

export async function listPlacesInCity(city: string): Promise<PlaceSummary[]> {
  const snapshot = await getDocs(query(collection(db, PLACES), where('city', '==', city)));
  return snapshot.docs.map((d) => toPlaceSummary(d.id, d.data()));
}
