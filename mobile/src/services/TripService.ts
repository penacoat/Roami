import type {
  AddCandidateRequest,
  AddCandidateResponse,
  CreateTripRequest,
  CreateTripResponse,
  DeleteTripRequest,
  GetTripRequest,
  GetTripResponse,
  ListTripsRequest,
  ListTripsResponse,
  RemoveCandidateRequest,
  RemoveCandidateResponse,
  SetTripArchivedRequest,
  SetTripArchivedResponse,
  Trip,
  TripStop,
  TripStopView,
  TripSummary,
  TripView,
} from '@roami/shared';

import { ApiError } from '../api';
import { getCurrentUserId } from '../auth/AuthService';
import { MAX_CANDIDATES, validateNewTrip, validateStopDetails } from '../logic/trips';
import { getPlacesByIds } from '../repositories/PlaceRepository';
import {
  createTrip as saveNewTrip,
  getTrip as readTrip,
  listStops,
  listTripsOwnedBy,
  newTripId,
  saveTripChange,
  type TripChange,
} from '../repositories/TripRepository';

const NOT_FOUND = 'That trip does not exist, or you do not have access to it.';

/** The signed-in user's ID. Throws 'unauthenticated' when nobody is signed in. */
export function requireUserId(): string {
  const userId = getCurrentUserId();
  if (!userId) throw new ApiError('unauthenticated', 'Sign in to continue.');
  return userId;
}

export function requireTripId(tripId: unknown): string {
  if (typeof tripId !== 'string' || tripId.trim().length === 0) {
    throw new ApiError('invalid-argument', 'Choose a trip.');
  }
  return tripId;
}

export function requirePlaceId(placeId: unknown): string {
  if (typeof placeId !== 'string' || placeId.trim().length === 0) {
    throw new ApiError('invalid-argument', 'Choose a place.');
  }
  return placeId;
}

/** Throws unless the trip exists, the user can see it, and the user owns it. */
export function requireOwnedTrip(trip: Trip | null, userId: string): Trip {
  if (!trip) throw new ApiError('not-found', NOT_FOUND);
  if (trip.ownerId !== userId) {
    throw new ApiError('permission-denied', 'Only the owner can change this trip.');
  }
  return trip;
}

/** The trip with its revision raised by one, as every saved change requires. */
export function nextRevision(trip: Trip, patch: Partial<Trip> = {}): Trip {
  return { ...trip, ...patch, revision: trip.revision + 1, updatedAt: new Date().toISOString() };
}

export function checkTripRevision(trip: Trip, expectedRevision: number): void {
  if (!Number.isInteger(expectedRevision) || expectedRevision < 1) {
    throw new ApiError('invalid-argument', 'Reload the trip and try again.');
  }
  if (trip.revision !== expectedRevision) {
    throw new ApiError(
      'aborted',
      'This trip changed since you loaded it. Reload it and try again.',
    );
  }
}

/**
 * Builds the view the screens use. Candidates are the trip's saved places that
 * are not scheduled as stops yet, so scheduling a candidate moves it out of the
 * candidate list and removing that stop brings it back.
 */
export async function buildTripView(trip: Trip, stops: TripStop[]): Promise<TripView> {
  const scheduled = new Set(stops.map((s) => s.placeId).filter((id): id is string => !!id));
  const candidateIds = trip.candidatePlaceIds.filter((id) => !scheduled.has(id));
  const places = await getPlacesByIds([...candidateIds, ...scheduled]);

  const sorted: TripStopView[] = [...stops]
    .sort((a, b) => a.day - b.day || a.order - b.order)
    .map((s) => ({ ...s, place: s.placeId ? (places.get(s.placeId) ?? null) : null }));

  return {
    trip,
    canEdit: trip.ownerId === getCurrentUserId(),
    // A candidate whose place left the catalog is skipped rather than shown blank.
    candidates: candidateIds.flatMap((id) => {
      const place = places.get(id);
      return place ? [place] : [];
    }),
    stops: sorted,
  };
}

/** Reads a trip and its stops, or throws 'not-found'. */
export async function loadTripView(tripId: string): Promise<TripView> {
  const [trip, stops] = await Promise.all([readTrip(tripId), listStops(tripId)]);
  if (!trip || !stops) throw new ApiError('not-found', NOT_FOUND);
  return buildTripView(trip, stops);
}

export async function createTrip(request: CreateTripRequest): Promise<CreateTripResponse> {
  const userId = requireUserId();
  const checked = validateNewTrip(request);
  if (!checked.ok) throw new ApiError('invalid-argument', checked.error);

  const now = new Date().toISOString();
  const trip: Trip = {
    id: newTripId(),
    ownerId: userId,
    city: checked.value.city,
    startDate: checked.value.startDate,
    endDate: checked.value.endDate,
    dailyWindow: checked.value.dailyWindow,
    startingPoints: checked.value.startingPoints ?? [],
    candidatePlaceIds: [],
    revision: 1,
    createdAt: now,
    updatedAt: now,
  };
  await saveNewTrip(trip);
  return { trip: { trip, candidates: [], stops: [] } };
}

/** The user's own trips, soonest first. Trips shared with the user are not listed. */
export async function listTrips(request: ListTripsRequest): Promise<ListTripsResponse> {
  const userId = requireUserId();
  const trips = await listTripsOwnedBy(userId);
  const stopLists = await Promise.all(trips.map((t) => listStops(t.id)));

  const summaries: TripSummary[] = trips.map((trip, i) => {
    const stops = stopLists[i] ?? [];
    const scheduled = new Set(stops.map((s) => s.placeId));
    return {
      id: trip.id,
      city: trip.city,
      startDate: trip.startDate,
      endDate: trip.endDate,
      candidateCount: trip.candidatePlaceIds.filter((id) => !scheduled.has(id)).length,
      stopCount: stops.length,
      ...(trip.archivedAt && { archivedAt: trip.archivedAt }),
      ...(request.includeScheduledPlaces && {
        scheduledPlaces: stops.flatMap(({ placeId, day }) => (placeId ? [{ placeId, day }] : [])),
      }),
    };
  });
  summaries.sort((a, b) => a.startDate.localeCompare(b.startDate) || a.id.localeCompare(b.id));
  return { trips: summaries };
}

/**
 * Archives a trip, or brings an archived one back. Only the owner can. Nothing
 * about the trip's plan changes; it just leaves or rejoins the main list.
 */
export async function setTripArchived(
  request: SetTripArchivedRequest,
): Promise<SetTripArchivedResponse> {
  const userId = requireUserId();
  const tripId = requireTripId(request.tripId);
  if (typeof request.archived !== 'boolean') {
    throw new ApiError('invalid-argument', 'Choose whether to archive or restore the trip.');
  }
  await saveTripChange(tripId, async (current): Promise<TripChange | null> => {
    const trip = requireOwnedTrip(current, userId);
    if (Boolean(trip.archivedAt) === request.archived) return null; // already so; save nothing
    return {
      trip: nextRevision(trip, {
        archivedAt: request.archived ? new Date().toISOString() : null,
      }),
    };
  });
  return { trip: await loadTripView(tripId) };
}

/** A trip the user owns or that was shared with them (view-only). */
export async function getTrip(request: GetTripRequest): Promise<GetTripResponse> {
  requireUserId();
  return { trip: await loadTripView(requireTripId(request.tripId)) };
}

export async function deleteTrip(request: DeleteTripRequest): Promise<{ deleted: true }> {
  const userId = requireUserId();
  const tripId = requireTripId(request.tripId);
  await saveTripChange(tripId, async (current) => {
    if (!current) return null;
    const trip = requireOwnedTrip(current, userId);
    checkTripRevision(trip, request.expectedRevision);
    return { deleteTrip: true };
  });
  return { deleted: true };
}

/** Saves a candidate change, then returns the trip as it is now. */
async function changeCandidates(
  tripId: string,
  decide: (trip: Trip, placeExists: (id: string) => Promise<boolean>) => Promise<Trip | null>,
): Promise<TripView> {
  const userId = requireUserId();
  await saveTripChange(tripId, async (current, _stops, reader): Promise<TripChange | null> => {
    const trip = requireOwnedTrip(current, userId);
    const updated = await decide(trip, (id) => reader.placeExists(id));
    return updated ? { trip: updated } : null;
  });
  return loadTripView(tripId);
}

/** Adds a place the user might visit. It isn't scheduled until it becomes a stop. */
export async function addCandidate(request: AddCandidateRequest): Promise<AddCandidateResponse> {
  const tripId = requireTripId(request.tripId);
  const placeId = requirePlaceId(request.placeId);
  const trip = await changeCandidates(tripId, async (current, placeExists) => {
    const previous = current.candidateRecommendationIds?.[placeId] ?? [];
    const recommendationIds = [...new Set([...previous, ...(request.recommendationIds ?? [])])];
    const details = validateStopDetails({ visitMinutes: 60, recommendationIds });
    if (!details.ok) throw new ApiError('invalid-argument', details.error);
    const exists = current.candidatePlaceIds.includes(placeId);
    if (exists && recommendationIds.length === previous.length) return null;
    if (!exists && current.candidatePlaceIds.length >= MAX_CANDIDATES) {
      throw new ApiError('invalid-argument', `A trip can have at most ${MAX_CANDIDATES} places.`);
    }
    if (!(await placeExists(placeId))) {
      throw new ApiError('not-found', 'That place is not in the catalog.');
    }
    return nextRevision(current, {
      candidatePlaceIds: exists
        ? current.candidatePlaceIds
        : [...current.candidatePlaceIds, placeId],
      ...(recommendationIds.length > 0 && {
        candidateRecommendationIds: {
          ...current.candidateRecommendationIds,
          [placeId]: recommendationIds,
        },
      }),
    });
  });
  return { trip };
}

export async function removeCandidate(
  request: RemoveCandidateRequest,
): Promise<RemoveCandidateResponse> {
  const tripId = requireTripId(request.tripId);
  const placeId = requirePlaceId(request.placeId);
  const trip = await changeCandidates(tripId, async (current) => {
    if (!current.candidatePlaceIds.includes(placeId)) return null; // not there; save nothing
    return nextRevision(current, {
      candidatePlaceIds: current.candidatePlaceIds.filter((id) => id !== placeId),
      ...(current.candidateRecommendationIds && {
        candidateRecommendationIds: Object.fromEntries(
          Object.entries(current.candidateRecommendationIds).filter(([id]) => id !== placeId),
        ),
      }),
    });
  });
  return { trip };
}
