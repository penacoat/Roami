import type { StartingPoint, Trip, TripStop } from '@roami/shared';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  setDoc,
  where,
  type DocumentData,
} from 'firebase/firestore';

import { db } from './firestore';

// Match COLLECTIONS in shared/src/models.ts (the app can import only types from shared).
const TRIPS = 'trips';
const TRIP_STOPS = 'tripStops';
const PLACES = 'places';

/**
 * The rules deny reading a trip that doesn't exist and a trip the user may not see
 * with the same error, so both count as "not found". That also avoids revealing
 * whether someone else's trip exists.
 */
function isPermissionDenied(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: unknown }).code === 'permission-denied'
  );
}

function toStartingPoint(data: DocumentData): StartingPoint {
  return {
    label: String(data.label ?? ''),
    latitude: Number(data.latitude),
    longitude: Number(data.longitude),
  };
}

function toTrip(id: string, data: DocumentData): Trip {
  return {
    id,
    ownerId: String(data.ownerId),
    city: String(data.city ?? ''),
    startDate: String(data.startDate),
    endDate: String(data.endDate),
    dailyWindow: { start: String(data.dailyWindow?.start), end: String(data.dailyWindow?.end) },
    startingPoints: Array.isArray(data.startingPoints)
      ? data.startingPoints.map(toStartingPoint)
      : [],
    candidatePlaceIds: Array.isArray(data.candidatePlaceIds)
      ? data.candidatePlaceIds.map(String)
      : [],
    revision: Number(data.revision),
    createdAt: String(data.createdAt),
    updatedAt: String(data.updatedAt),
  };
}

function toStop(id: string, data: DocumentData): TripStop {
  return {
    id,
    tripId: String(data.tripId),
    placeId: typeof data.placeId === 'string' ? data.placeId : null,
    title: typeof data.title === 'string' ? data.title : null,
    recommendationIds: Array.isArray(data.recommendationIds)
      ? data.recommendationIds.map(String)
      : [],
    day: Number(data.day),
    order: Number(data.order),
    startTime: typeof data.startTime === 'string' ? data.startTime : null,
    visitMinutes: Number(data.visitMinutes),
    // null means unknown, never zero.
    walkingMinutesFromPrevious:
      typeof data.walkingMinutesFromPrevious === 'number' ? data.walkingMinutesFromPrevious : null,
    isFixed: data.isFixed === true,
    isRequired: data.isRequired === true,
    warnings: Array.isArray(data.warnings) ? data.warnings.map(String) : [],
  };
}

/** Exactly the fields the security rules allow on a trip document. */
function tripDocument(trip: Trip): DocumentData {
  return {
    id: trip.id,
    ownerId: trip.ownerId,
    city: trip.city,
    startDate: trip.startDate,
    endDate: trip.endDate,
    dailyWindow: { start: trip.dailyWindow.start, end: trip.dailyWindow.end },
    startingPoints: trip.startingPoints.map((p) => ({
      label: p.label,
      latitude: p.latitude,
      longitude: p.longitude,
    })),
    candidatePlaceIds: trip.candidatePlaceIds,
    revision: trip.revision,
    createdAt: trip.createdAt,
    updatedAt: trip.updatedAt,
  };
}

/** Exactly the fields the security rules allow on a stop document. */
function stopDocument(stop: TripStop): DocumentData {
  return {
    id: stop.id,
    tripId: stop.tripId,
    placeId: stop.placeId,
    title: stop.title,
    recommendationIds: stop.recommendationIds,
    day: stop.day,
    order: stop.order,
    startTime: stop.startTime,
    visitMinutes: stop.visitMinutes,
    walkingMinutesFromPrevious: stop.walkingMinutesFromPrevious,
    isFixed: stop.isFixed,
    isRequired: stop.isRequired,
    warnings: stop.warnings,
  };
}

export function newTripId(): string {
  return doc(collection(db, TRIPS)).id;
}

export function newStopId(): string {
  return doc(collection(db, TRIP_STOPS)).id;
}

/** Creates a trip. The rules require revision 1 and the signed-in user as owner. */
export async function createTrip(trip: Trip): Promise<void> {
  await setDoc(doc(db, TRIPS, trip.id), tripDocument(trip));
}

/** The trip, or null if it doesn't exist or the user can't view it. */
export async function getTrip(tripId: string): Promise<Trip | null> {
  try {
    const snapshot = await getDoc(doc(db, TRIPS, tripId));
    return snapshot.exists() ? toTrip(snapshot.id, snapshot.data()) : null;
  } catch (error) {
    if (isPermissionDenied(error)) return null;
    throw error;
  }
}

/** Trips the user owns. The rules require the ownerId filter. */
export async function listTripsOwnedBy(userId: string): Promise<Trip[]> {
  const snapshot = await getDocs(query(collection(db, TRIPS), where('ownerId', '==', userId)));
  return snapshot.docs.map((d) => toTrip(d.id, d.data()));
}

/** The trip's stops, or null if the user can't view the trip. The rules require the tripId filter. */
export async function listStops(tripId: string): Promise<TripStop[] | null> {
  try {
    const snapshot = await getDocs(
      query(collection(db, TRIP_STOPS), where('tripId', '==', tripId)),
    );
    return snapshot.docs.map((d) => toStop(d.id, d.data()));
  } catch (error) {
    if (isPermissionDenied(error)) return null;
    throw error;
  }
}

/** What a trip change writes. The trip's revision must already be raised by one. */
export interface TripChange {
  trip: Trip;
  stopsToSave?: TripStop[];
  stopIdsToDelete?: string[];
}

/** Reads available to a change while its transaction runs. */
export interface TripChangeReader {
  placeExists(placeId: string): Promise<boolean>;
}

/**
 * Saves a trip change in one transaction, so it applies fully or not at all.
 *
 * The stops are read first, then the trip is read inside the transaction and
 * handed to `decide` with those stops. Every stop change must raise the trip's
 * revision (the security rules enforce this), so if the trip's revision is the
 * one the caller expected, the stops read beforehand are still current.
 *
 * `decide` returns the change to save, or null to save nothing. It gets null for
 * the trip and stops when the trip doesn't exist or the user can't view it.
 * Anything it throws cancels the transaction and is rethrown.
 */
export async function saveTripChange(
  tripId: string,
  decide: (
    trip: Trip | null,
    stops: TripStop[],
    reader: TripChangeReader,
  ) => Promise<TripChange | null>,
): Promise<void> {
  const stops = await listStops(tripId);
  const tripRef = doc(db, TRIPS, tripId);

  await runTransaction(db, async (transaction) => {
    let trip: Trip | null = null;
    if (stops !== null) {
      try {
        const snapshot = await transaction.get(tripRef);
        trip = snapshot.exists() ? toTrip(snapshot.id, snapshot.data()) : null;
      } catch (error) {
        if (!isPermissionDenied(error)) throw error;
      }
    }

    const reader: TripChangeReader = {
      async placeExists(placeId) {
        const snapshot = await transaction.get(doc(db, PLACES, placeId));
        return snapshot.exists();
      },
    };
    const change = await decide(trip, trip ? (stops ?? []) : [], reader);
    if (!change) return;

    transaction.set(tripRef, tripDocument(change.trip));
    for (const stop of change.stopsToSave ?? []) {
      transaction.set(doc(db, TRIP_STOPS, stop.id), stopDocument(stop));
    }
    for (const stopId of change.stopIdsToDelete ?? []) {
      transaction.delete(doc(db, TRIP_STOPS, stopId));
    }
  });
}
