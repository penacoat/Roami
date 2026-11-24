import type { Place, PlaceSummary } from '@roami/shared';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
  type DocumentData,
} from 'firebase/firestore';

import { readCost } from '../logic/stopDetails';
import { db } from './firestore';

// Matches COLLECTIONS.places in shared/src/models.ts. It is written out here
// because the app can only import types from shared, not values.
const PLACES = 'places';

function toPlaceSummary(id: string, data: DocumentData): PlaceSummary {
  const cost = readCost(data.cost);
  return {
    id,
    name: String(data.name ?? ''),
    ...(typeof data.city === 'string' && data.city.trim() && { city: data.city.trim() }),
    ...(typeof data.cityId === 'string' && { cityId: data.cityId }),
    latitude: Number(data.latitude),
    longitude: Number(data.longitude),
    category: String(data.category ?? ''),
    ...(cost && { cost }),
    // null means unknown, not closed. Never turn a missing value into a default.
    openingHours: typeof data.openingHours === 'string' ? data.openingHours : null,
    ...(typeof data.openingHoursSource?.url === 'string' &&
      typeof data.openingHoursSource?.checkedAt === 'string' && {
        openingHoursSource: {
          url: data.openingHoursSource.url,
          checkedAt: data.openingHoursSource.checkedAt,
        },
      }),
    photos: Array.isArray(data.photos)
      ? data.photos
          .filter(
            (photo: unknown) =>
              photo && typeof photo === 'object' && 'url' in photo && typeof photo.url === 'string',
          )
          .map((photo: { url: string; attribution?: string; illustrative?: boolean }) => ({
            url: photo.url,
            ...(typeof photo.attribution === 'string' && { attribution: photo.attribution }),
            ...(photo.illustrative === true && { illustrative: true }),
          }))
      : [],
    address: typeof data.address === 'string' ? data.address.trim() || null : null,
    website: typeof data.website === 'string' ? data.website.trim() || null : null,
    ticketUrl: typeof data.ticketUrl === 'string' ? data.ticketUrl.trim() || null : null,
    missingFields: Array.isArray(data.missingFields) ? data.missingFields.map(String) : [],
  };
}

export async function listPlacesInCity(city: string): Promise<PlaceSummary[]> {
  const snapshot = await getDocs(query(collection(db, PLACES), where('city', '==', city)));
  return snapshot.docs.map((d) => toPlaceSummary(d.id, d.data()));
}

/** The places that exist, keyed by ID. IDs with no catalog place are left out. */
export async function getPlacesByIds(placeIds: string[]): Promise<Map<string, PlaceSummary>> {
  const unique = [...new Set(placeIds)];
  const snapshots = await Promise.all(unique.map((id) => getDoc(doc(db, PLACES, id))));
  const places = new Map<string, PlaceSummary>();
  for (const snapshot of snapshots) {
    if (snapshot.exists()) places.set(snapshot.id, toPlaceSummary(snapshot.id, snapshot.data()));
  }
  return places;
}

/** A place imported from OpenStreetMap, with when it was last written. */
export interface StoredImportedPlace {
  place: PlaceSummary;
  importedAtMs: number | null;
}

export function readTimestampMs(value: unknown): number | null {
  const toMillis = (value as { toMillis?: unknown } | null)?.toMillis;
  return typeof toMillis === 'function' ? Number(toMillis.call(value)) : null;
}

/** Places imported for an OpenStreetMap city (cityId), current or not. */
export async function listImportedPlaces(cityId: string): Promise<StoredImportedPlace[]> {
  const snapshot = await getDocs(query(collection(db, PLACES), where('cityId', '==', cityId)));
  return snapshot.docs.map((d) => {
    const data = d.data();
    return { place: toPlaceSummary(d.id, data), importedAtMs: readTimestampMs(data.importedAt) };
  });
}

/** Hand-made places stored under a city name (they have no cityId). */
export async function listManualPlaces(city: string): Promise<PlaceSummary[]> {
  const snapshot = await getDocs(query(collection(db, PLACES), where('city', '==', city)));
  return snapshot.docs.filter((d) => !d.data().cityId).map((d) => toPlaceSummary(d.id, d.data()));
}

// Firestore allows 500 writes per batch; stay under it.
const BATCH_SIZE = 400;

function toDocument(place: Place) {
  const { cost, ...rest } = place;
  return { ...rest, ...(cost && { cost }), importedAt: serverTimestamp() };
}

/**
 * Creates or refreshes imported places. Returns the IDs that were written.
 * If a batch is refused (usually because another user just wrote one of the
 * same places), its places are retried one by one and the refused ones skipped.
 */
export async function writeImportedPlaces(places: Place[]): Promise<Set<string>> {
  const written = new Set<string>();
  for (let start = 0; start < places.length; start += BATCH_SIZE) {
    const chunk = places.slice(start, start + BATCH_SIZE);
    const batch = writeBatch(db);
    for (const place of chunk) batch.set(doc(db, PLACES, place.id), toDocument(place));
    try {
      await batch.commit();
      for (const place of chunk) written.add(place.id);
    } catch (error) {
      if (!isPermissionDenied(error)) throw error;
      for (const place of chunk) {
        try {
          await setDoc(doc(db, PLACES, place.id), toDocument(place));
          written.add(place.id);
        } catch (single) {
          if (!isPermissionDenied(single)) throw single;
        }
      }
    }
  }
  return written;
}

function isPermissionDenied(error: unknown): boolean {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === 'string' && code.includes('permission-denied');
}
