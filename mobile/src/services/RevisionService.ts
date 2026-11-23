// Changes to scheduled stops. Each change sends the trip revision the user loaded
// (expectedRevision). If the trip changed since then, the change is refused with
// 'aborted' and nothing is saved; on success the trip's revision rises by one.
import type {
  AddFixedActivityRequest,
  AddStopRequest,
  AddStopResponse,
  ApplyItineraryRequest,
  MoveStopRequest,
  MoveStopResponse,
  RemoveStopRequest,
  RemoveStopResponse,
  UpdateStopTimeRequest,
  UpdateStopDetailsRequest,
  UpdateStopTimeResponse,
  Trip,
  TripStop,
} from '@roami/shared';

import { ApiError } from '../api';
import { itineraryChanges, planItinerary } from '../logic/itineraryPlan';
import { planStopDetails } from '../logic/stopDetails';
import {
  applyPositions,
  planAddStop,
  planFixedActivity,
  planMoveStop,
  planRemoveStop,
  tripDayCount,
  validateActivityOverlap,
  validateStopDetails,
  validateStopTime,
  type Result,
} from '../logic/trips';
import {
  newStopId,
  saveTripChange,
  type TripChange,
  type TripChangeReader,
} from '../repositories/TripRepository';
import {
  checkTripRevision,
  loadTripView,
  nextRevision,
  requireOwnedTrip,
  requirePlaceId,
  requireTripId,
  requireUserId,
} from './TripService';

function unwrap<T>(result: Result<T>): T {
  if (!result.ok) throw new ApiError('invalid-argument', result.error);
  return result.value;
}

function requireStop(stops: TripStop[], stopId: unknown): TripStop {
  const stop = stops.find((s) => s.id === stopId);
  if (!stop) throw new ApiError('not-found', 'That stop is not in this trip. Reload the trip.');
  return stop;
}

/**
 * Runs one stop change: checks ownership and the revision inside the
 * transaction, then saves the stops the change returns along with the trip at
 * revision + 1. Returns the trip as it is afterward.
 */
async function reviseStops(
  tripIdInput: unknown,
  expectedRevision: number,
  change: (
    trip: Trip,
    stops: TripStop[],
    reader: TripChangeReader,
  ) => Promise<Omit<TripChange, 'trip'> | null>,
) {
  const userId = requireUserId();
  const tripId = requireTripId(tripIdInput);
  await saveTripChange(tripId, async (current, stops, reader) => {
    const trip = requireOwnedTrip(current, userId);
    checkTripRevision(trip, expectedRevision);
    const stopChanges = await change(trip, stops, reader);
    return stopChanges ? { trip: nextRevision(trip), ...stopChanges } : null;
  });
  return loadTripView(tripId);
}

export async function addStop(request: AddStopRequest): Promise<AddStopResponse> {
  const placeId = requirePlaceId(request.placeId);
  const recommendationIds = request.recommendationIds ?? [];
  unwrap(validateStopDetails({ visitMinutes: request.visitMinutes, recommendationIds }));
  const startTime = request.startTime ?? null;
  unwrap(validateStopTime({ startTime, visitMinutes: request.visitMinutes }));

  const trip = await reviseStops(
    request.tripId,
    request.expectedRevision,
    async (current, stops, reader) => {
      const id = newStopId();
      const plan = unwrap(
        planAddStop(stops, tripDayCount(current.startDate, current.endDate), {
          id,
          placeId,
          day: request.day,
          order: request.order,
        }),
      );
      // The rules don't check that a stop's place exists, so the app must.
      if (!(await reader.placeExists(placeId))) {
        throw new ApiError('not-found', 'That place is not in the catalog.');
      }
      const newStop: TripStop = {
        id,
        tripId: current.id,
        placeId,
        title: null,
        recommendationIds: [
          ...new Set([
            ...(current.candidateRecommendationIds?.[placeId] ?? []),
            ...recommendationIds,
          ]),
        ],
        day: plan.position.day,
        order: plan.position.order,
        startTime,
        visitMinutes: request.visitMinutes,
        walkingMinutesFromPrevious: null, // unknown until routing exists, never zero
        isFixed: false,
        isRequired: false,
        warnings: [],
      };
      unwrap(validateActivityOverlap(stops, newStop));
      unwrap(validateStopDetails(newStop));
      return { stopsToSave: [newStop, ...applyPositions(stops, plan.moved)] };
    },
  );
  return { trip };
}

export async function addFixedActivity(request: AddFixedActivityRequest): Promise<AddStopResponse> {
  const trip = await reviseStops(
    request.tripId,
    request.expectedRevision,
    async (current, stops) => {
      const { stop, moved } = unwrap(planFixedActivity(current, stops, newStopId(), request));
      return { stopsToSave: [stop, ...applyPositions(stops, moved)] };
    },
  );
  return { trip };
}

export async function applyItinerary(request: ApplyItineraryRequest): Promise<AddStopResponse> {
  const trip = await reviseStops(
    request.tripId,
    request.expectedRevision,
    async (current, stops, reader) => {
      const plan = unwrap(planItinerary(current, stops, request.placeIds, request.strategy));
      const changes = itineraryChanges(stops, plan);
      const newPlaces = changes.filter((stop) => stop.id === null);
      const exists = await Promise.all(newPlaces.map((stop) => reader.placeExists(stop.placeId!)));
      if (exists.includes(false))
        throw new ApiError('not-found', 'A suggested place is unavailable. Reload the trip.');
      return changes.length
        ? { stopsToSave: changes.map((stop) => ({ ...stop, id: stop.id ?? newStopId() })) }
        : null;
    },
  );
  return { trip };
}

export async function moveStop(request: MoveStopRequest): Promise<MoveStopResponse> {
  const trip = await reviseStops(
    request.tripId,
    request.expectedRevision,
    async (current, stops) => {
      const stop = requireStop(stops, request.stopId);
      const positions = unwrap(
        planMoveStop(stops, tripDayCount(current.startDate, current.endDate), {
          stopId: request.stopId,
          day: request.day,
          order: request.order,
        }),
      );
      if (stop.day !== request.day)
        unwrap(validateActivityOverlap(stops, { ...stop, day: request.day }));
      // Already in that spot: save nothing and keep the revision.
      if (positions.length === 0) return null;
      return { stopsToSave: applyPositions(stops, positions) };
    },
  );
  return { trip };
}

export async function removeStop(request: RemoveStopRequest): Promise<RemoveStopResponse> {
  const trip = await reviseStops(
    request.tripId,
    request.expectedRevision,
    async (_current, stops) => {
      requireStop(stops, request.stopId);
      const positions = unwrap(planRemoveStop(stops, request.stopId));
      return {
        stopIdsToDelete: [request.stopId],
        stopsToSave: applyPositions(stops, positions),
      };
    },
  );
  return { trip };
}

export async function updateStopTime(
  request: UpdateStopTimeRequest,
): Promise<UpdateStopTimeResponse> {
  const startTime = request.startTime ?? null;
  unwrap(validateStopTime({ startTime, visitMinutes: request.visitMinutes }));
  const trip = await reviseStops(
    request.tripId,
    request.expectedRevision,
    async (_current, stops) => {
      const stop = requireStop(stops, request.stopId);
      // Same time and length: save nothing and keep the revision.
      if (stop.startTime === startTime && stop.visitMinutes === request.visitMinutes) return null;
      if (request.requireOpenSlot && stop.isFixed) {
        throw new ApiError('invalid-argument', 'Fixed activities stay at their scheduled time.');
      }
      const updated = { ...stop, startTime, visitMinutes: request.visitMinutes };
      unwrap(validateActivityOverlap(stops, updated, request.requireOpenSlot));
      return { stopsToSave: [updated] };
    },
  );
  return { trip };
}

export async function updateStopDetails(
  request: UpdateStopDetailsRequest,
): Promise<AddStopResponse> {
  const trip = await reviseStops(
    request.tripId,
    request.expectedRevision,
    async (_current, stops) => ({
      stopsToSave: [unwrap(planStopDetails(requireStop(stops, request.stopId), request))],
    }),
  );
  return { trip };
}
