// Changes to scheduled stops. Each change sends the trip revision the user loaded
// (expectedRevision). If the trip changed since then, the change is refused with
// 'aborted' and nothing is saved; on success the trip's revision rises by one.
import type {
  AddStopRequest,
  AddStopResponse,
  MoveStopRequest,
  MoveStopResponse,
  RemoveStopRequest,
  RemoveStopResponse,
  Trip,
  TripStop,
} from '@roami/shared';

import { ApiError } from '../api';
import {
  planAddStop,
  planMoveStop,
  planRemoveStop,
  tripDayCount,
  validateStopDetails,
  type Result,
  type StopPosition,
} from '../logic/trips';
import {
  newStopId,
  saveTripChange,
  type TripChange,
  type TripChangeReader,
} from '../repositories/TripRepository';
import {
  loadTripView,
  nextRevision,
  requireOwnedTrip,
  requirePlaceId,
  requireTripId,
  requireUserId,
} from './TripService';

function requireRevision(expectedRevision: unknown): number {
  if (!Number.isInteger(expectedRevision) || (expectedRevision as number) < 1) {
    throw new ApiError('invalid-argument', 'Reload the trip and try again.');
  }
  return expectedRevision as number;
}

function unwrap<T>(result: Result<T>): T {
  if (!result.ok) throw new ApiError('invalid-argument', result.error);
  return result.value;
}

function requireStop(stops: TripStop[], stopId: unknown): TripStop {
  const stop = stops.find((s) => s.id === stopId);
  if (!stop) throw new ApiError('not-found', 'That stop is not in this trip. Reload the trip.');
  return stop;
}

function applyPositions(stops: TripStop[], positions: StopPosition[]): TripStop[] {
  return positions.flatMap((p) => {
    const stop = stops.find((s) => s.id === p.id);
    return stop ? [{ ...stop, day: p.day, order: p.order }] : [];
  });
}

/**
 * Runs one stop change: checks ownership and the revision inside the
 * transaction, then saves the stops the change returns along with the trip at
 * revision + 1. Returns the trip as it is afterward.
 */
async function reviseStops(
  tripIdInput: unknown,
  expectedRevisionInput: unknown,
  change: (
    trip: Trip,
    stops: TripStop[],
    reader: TripChangeReader,
  ) => Promise<Omit<TripChange, 'trip'> | null>,
) {
  const userId = requireUserId();
  const tripId = requireTripId(tripIdInput);
  const expectedRevision = requireRevision(expectedRevisionInput);

  await saveTripChange(tripId, async (current, stops, reader) => {
    const trip = requireOwnedTrip(current, userId);
    if (trip.revision !== expectedRevision) {
      throw new ApiError(
        'aborted',
        'This trip changed since you loaded it. Reload it and try again. Nothing was saved.',
      );
    }
    const stopChanges = await change(trip, stops, reader);
    return stopChanges ? { trip: nextRevision(trip), ...stopChanges } : null;
  });
  return loadTripView(tripId);
}

export async function addStop(request: AddStopRequest): Promise<AddStopResponse> {
  const placeId = requirePlaceId(request.placeId);
  const recommendationIds = request.recommendationIds ?? [];
  unwrap(validateStopDetails({ visitMinutes: request.visitMinutes, recommendationIds }));

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
        recommendationIds: [...new Set(recommendationIds)],
        day: plan.position.day,
        order: plan.position.order,
        startTime: null,
        visitMinutes: request.visitMinutes,
        walkingMinutesFromPrevious: null, // unknown until routing exists, never zero
        isFixed: false,
        isRequired: false,
        warnings: [],
      };
      return { stopsToSave: [newStop, ...applyPositions(stops, plan.moved)] };
    },
  );
  return { trip };
}

export async function moveStop(request: MoveStopRequest): Promise<MoveStopResponse> {
  const trip = await reviseStops(
    request.tripId,
    request.expectedRevision,
    async (current, stops) => {
      requireStop(stops, request.stopId);
      const positions = unwrap(
        planMoveStop(stops, tripDayCount(current.startDate, current.endDate), {
          stopId: request.stopId,
          day: request.day,
          order: request.order,
        }),
      );
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
