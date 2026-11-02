// Pure trip rules: validation and stop ordering. Plain data in, plain data out.
// The security rules cannot count or compare dates, so these checks are the only
// place the limits below are enforced.
import type { CreateTripRequest, StartingPoint, TripStop } from '@roami/shared';

export const MAX_TRIP_DAYS = 7;
export const MAX_STOPS_PER_DAY = 5;
export const MAX_CANDIDATES = 50;
export const MAX_STARTING_POINTS = 5;
export const MAX_VISIT_MINUTES = 720;
export const MAX_RECOMMENDATIONS_PER_STOP = 25;
const MAX_CITY_LENGTH = 100;
const MAX_LABEL_LENGTH = 100;

/** Either a value or a message explaining what is wrong. */
export type Result<T> = { ok: true; value: T } | { ok: false; error: string };

const ok = <T>(value: T): Result<T> => ({ ok: true, value });
const fail = <T>(error: string): Result<T> => ({ ok: false, error });

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** True for a real calendar date written as YYYY-MM-DD. */
export function isValidDate(value: string): boolean {
  const match = DATE_PATTERN.exec(value);
  if (!match) return false;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

/** True for a time of day written as HH:mm (24-hour). */
export function isValidTime(value: string): boolean {
  return TIME_PATTERN.test(value);
}

/** Number of days from startDate to endDate, counting both. Assumes valid dates. */
export function tripDayCount(startDate: string, endDate: string): number {
  return Math.round((Date.parse(endDate) - Date.parse(startDate)) / 86_400_000) + 1;
}

function checkStartingPoint(point: StartingPoint): string | null {
  if (typeof point.label !== 'string' || point.label.trim().length === 0) {
    return 'Each starting point needs a name.';
  }
  if (point.label.length > MAX_LABEL_LENGTH) return 'A starting point name is too long.';
  const { latitude, longitude } = point;
  if (typeof latitude !== 'number' || !Number.isFinite(latitude) || Math.abs(latitude) > 90) {
    return 'A starting point has an invalid location.';
  }
  if (typeof longitude !== 'number' || !Number.isFinite(longitude) || Math.abs(longitude) > 180) {
    return 'A starting point has an invalid location.';
  }
  return null;
}

/** Checks a new trip and returns it with the city trimmed. */
export function validateNewTrip(request: CreateTripRequest): Result<CreateTripRequest> {
  const city = typeof request.city === 'string' ? request.city.trim() : '';
  if (city.length === 0) return fail('Choose a city.');
  if (city.length > MAX_CITY_LENGTH) return fail('That city name is too long.');

  const { startDate, endDate, dailyWindow } = request;
  if (!isValidDate(startDate)) return fail('Enter a valid start date.');
  if (!isValidDate(endDate)) return fail('Enter a valid end date.');
  if (endDate < startDate) return fail('The end date is before the start date.');
  if (tripDayCount(startDate, endDate) > MAX_TRIP_DAYS) {
    return fail(`Trips can be at most ${MAX_TRIP_DAYS} days.`);
  }

  if (!dailyWindow || !isValidTime(dailyWindow.start) || !isValidTime(dailyWindow.end)) {
    return fail('Enter daily start and end times as HH:mm.');
  }
  if (dailyWindow.end <= dailyWindow.start) {
    return fail('The daily end time must be after the start time.');
  }

  const startingPoints = request.startingPoints ?? [];
  if (startingPoints.length > MAX_STARTING_POINTS) {
    return fail(`Add at most ${MAX_STARTING_POINTS} starting points.`);
  }
  for (const point of startingPoints) {
    const problem = checkStartingPoint(point);
    if (problem) return fail(problem);
  }

  return ok({
    city,
    startDate,
    endDate,
    dailyWindow: { start: dailyWindow.start, end: dailyWindow.end },
    startingPoints: startingPoints.map((p) => ({
      label: p.label.trim(),
      latitude: p.latitude,
      longitude: p.longitude,
    })),
  });
}

/** Checks the fields of a new stop that don't depend on other stops. */
export function validateStopDetails(details: {
  visitMinutes: number;
  recommendationIds?: string[];
}): Result<null> {
  const { visitMinutes, recommendationIds = [] } = details;
  if (!Number.isInteger(visitMinutes) || visitMinutes < 1 || visitMinutes > MAX_VISIT_MINUTES) {
    return fail(`Visit length must be a whole number of minutes from 1 to ${MAX_VISIT_MINUTES}.`);
  }
  if (recommendationIds.length > MAX_RECOMMENDATIONS_PER_STOP) {
    return fail(`A stop can have at most ${MAX_RECOMMENDATIONS_PER_STOP} recommendations.`);
  }
  if (recommendationIds.some((id) => typeof id !== 'string' || id.length === 0)) {
    return fail('A recommendation ID is invalid.');
  }
  return ok(null);
}

function checkDay(day: number, dayCount: number): string | null {
  if (!Number.isInteger(day) || day < 1 || day > dayCount) {
    return dayCount === 1 ? 'This trip has only day 1.' : `Choose a day from 1 to ${dayCount}.`;
  }
  return null;
}

/** A stop's new position. Only stops whose day or order changes are listed. */
export interface StopPosition {
  id: string;
  day: number;
  order: number;
}

function stopsOnDay(stops: TripStop[], day: number, exceptId?: string): TripStop[] {
  return stops.filter((s) => s.day === day && s.id !== exceptId).sort((a, b) => a.order - b.order);
}

/** Positions for a day's stops after inserting `insertId` at `order` (1-based, clamped). */
function placeInDay(dayStops: TripStop[], day: number, insertId: string | null, order: number) {
  const ids = dayStops.map((s) => s.id);
  const index = Math.max(0, Math.min(order - 1, ids.length));
  if (insertId !== null) ids.splice(index, 0, insertId);
  return ids.map((id, i) => ({ id, day, order: i + 1 }));
}

function changedOnly(stops: TripStop[], positions: StopPosition[], keepId?: string) {
  return positions.filter((p) => {
    if (p.id === keepId) return true;
    const current = stops.find((s) => s.id === p.id);
    return !current || current.day !== p.day || current.order !== p.order;
  });
}

/**
 * Where a new stop goes and which existing stops shift to make room.
 * `order` is 1 for first in the day; omit it to append.
 */
export function planAddStop(
  stops: TripStop[],
  dayCount: number,
  newStop: { id: string; placeId: string; day: number; order?: number },
): Result<{ position: StopPosition; moved: StopPosition[] }> {
  const dayProblem = checkDay(newStop.day, dayCount);
  if (dayProblem) return fail(dayProblem);
  if (newStop.order !== undefined && (!Number.isInteger(newStop.order) || newStop.order < 1)) {
    return fail('Order must be 1 or more.');
  }
  if (stops.some((s) => s.placeId === newStop.placeId)) {
    return fail('That place is already scheduled in this trip.');
  }
  const dayStops = stopsOnDay(stops, newStop.day);
  if (dayStops.length >= MAX_STOPS_PER_DAY) {
    return fail(`Day ${newStop.day} already has ${MAX_STOPS_PER_DAY} stops.`);
  }
  const positions = placeInDay(
    dayStops,
    newStop.day,
    newStop.id,
    newStop.order ?? dayStops.length + 1,
  );
  const position = positions.find((p) => p.id === newStop.id) as StopPosition;
  const moved = changedOnly(stops, positions).filter((p) => p.id !== newStop.id);
  return ok({ position, moved });
}

/** New positions after moving a stop to `day` at `order` (clamped to the end of that day). */
export function planMoveStop(
  stops: TripStop[],
  dayCount: number,
  move: { stopId: string; day: number; order: number },
): Result<StopPosition[]> {
  const stop = stops.find((s) => s.id === move.stopId);
  if (!stop) return fail('That stop is not in this trip.');
  const dayProblem = checkDay(move.day, dayCount);
  if (dayProblem) return fail(dayProblem);
  if (!Number.isInteger(move.order) || move.order < 1) return fail('Order must be 1 or more.');

  const target = stopsOnDay(stops, move.day, stop.id);
  if (move.day !== stop.day && target.length >= MAX_STOPS_PER_DAY) {
    return fail(`Day ${move.day} already has ${MAX_STOPS_PER_DAY} stops.`);
  }
  const positions = placeInDay(target, move.day, stop.id, move.order);
  if (move.day !== stop.day) {
    positions.push(...placeInDay(stopsOnDay(stops, stop.day, stop.id), stop.day, null, 1));
  }
  return ok(changedOnly(stops, positions));
}

/** New positions for the remaining stops of the day after removing a stop. */
export function planRemoveStop(stops: TripStop[], stopId: string): Result<StopPosition[]> {
  const stop = stops.find((s) => s.id === stopId);
  if (!stop) return fail('That stop is not in this trip.');
  const positions = placeInDay(stopsOnDay(stops, stop.day, stop.id), stop.day, null, 1);
  return ok(changedOnly(stops, positions));
}
