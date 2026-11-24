import type { ApplyItineraryRequest, Trip, TripStop } from '@roami/shared';
import { timeFromMinutes } from '../trips/stopTime';
import {
  DEFAULT_VISIT_MINUTES,
  MAX_STOPS_PER_DAY,
  minutesOfDay,
  tripDayCount,
  type Result,
} from './trips';

type Strategy = ApplyItineraryRequest['strategy'];
type PlannedStop = Omit<TripStop, 'id'> & { id: string | null };

export interface ItineraryPlan {
  strategy: Strategy;
  stops: PlannedStop[];
  unscheduledPlaceIds: string[];
}

function findSlot(
  stops: PlannedStop[],
  duration: number,
  start: number,
  end: number,
  strategy: Strategy,
) {
  const busy = stops
    .flatMap((stop) => {
      if (!stop.startTime) return [];
      const from = minutesOfDay(stop.startTime);
      return [{ from, to: from + stop.visitMinutes }];
    })
    .sort((a, b) => a.from - b.from);

  const gaps: { from: number; to: number }[] = [];
  let cursor = start;
  for (const slot of busy) {
    const gapEnd = Math.min(slot.from, end);
    if (gapEnd - cursor >= duration) gaps.push({ from: cursor, to: gapEnd });
    cursor = Math.max(cursor, slot.to);
  }
  if (end - cursor >= duration) gaps.push({ from: cursor, to: end });
  if (strategy === 'earlier') return gaps[0]?.from ?? null;
  const last = gaps.at(-1);
  return last ? last.to - duration : null;
}

export function planItinerary(
  trip: Trip,
  stops: TripStop[],
  placeIds: string[],
  strategy: Strategy,
): Result<ItineraryPlan> {
  if (strategy !== 'earlier' && strategy !== 'later') {
    return { ok: false, error: 'Choose an itinerary option.' };
  }
  if (
    !Array.isArray(placeIds) ||
    placeIds.length > trip.candidatePlaceIds.length ||
    placeIds.some((id) => !trip.candidatePlaceIds.includes(id))
  ) {
    return { ok: false, error: 'Choose places from this trip’s suggestions.' };
  }

  const start = minutesOfDay(trip.dailyWindow.start);
  const end = minutesOfDay(trip.dailyWindow.end);
  const days: PlannedStop[][] = Array.from(
    { length: tripDayCount(trip.startDate, trip.endDate) },
    (_, index) => stops.filter((stop) => stop.day === index + 1).sort((a, b) => a.order - b.order),
  );
  for (const day of days) {
    const untimed = day
      .map((stop, index) => ({ stop, index }))
      .filter(({ stop }) => !stop.isFixed && stop.startTime === null)
      .sort((a, b) => Number(b.stop.isRequired) - Number(a.stop.isRequired));
    for (const { stop, index } of untimed) {
      const slot = findSlot(day, stop.visitMinutes, start, end, strategy);
      if (slot !== null) day[index] = { ...stop, startTime: timeFromMinutes(slot) };
    }
  }

  const scheduled = new Set(stops.map((stop) => stop.placeId));
  const unscheduledPlaceIds: string[] = [];
  for (const placeId of new Set(placeIds)) {
    if (scheduled.has(placeId)) continue;
    for (const [index, day] of days.entries()) {
      if (day.length >= MAX_STOPS_PER_DAY) continue;
      const slot = findSlot(day, DEFAULT_VISIT_MINUTES, start, end, strategy);
      if (slot === null) continue;
      day.push({
        id: null,
        tripId: trip.id,
        placeId,
        title: null,
        recommendationIds: [...(trip.candidateRecommendationIds?.[placeId] ?? [])],
        day: index + 1,
        order: day.length + 1,
        startTime: timeFromMinutes(slot),
        visitMinutes: DEFAULT_VISIT_MINUTES,
        walkingMinutesFromPrevious: null,
        isFixed: false,
        isRequired: false,
        warnings: [],
      });
      scheduled.add(placeId);
      break;
    }
    if (!scheduled.has(placeId)) unscheduledPlaceIds.push(placeId);
  }

  const original = new Map(stops.map((stop) => [stop.id, stop.startTime]));
  const planned = days.flatMap((day) => {
    if (!day.some((stop) => stop.id === null || stop.startTime !== original.get(stop.id))) {
      return day;
    }
    return day
      .sort((a, b) => (a.startTime ?? '24:00').localeCompare(b.startTime ?? '24:00'))
      .map((stop, index) => ({ ...stop, order: index + 1 }));
  });
  return { ok: true, value: { strategy, stops: planned, unscheduledPlaceIds } };
}

export function itineraryChanges(stops: TripStop[], plan: ItineraryPlan): PlannedStop[] {
  const existing = new Map(stops.map((stop) => [stop.id, stop]));
  return plan.stops.filter((stop) => {
    const previous = stop.id ? existing.get(stop.id) : undefined;
    return !previous || stop.order !== previous.order || stop.startTime !== previous.startTime;
  });
}
