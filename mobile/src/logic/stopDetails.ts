import type {
  KnownCost,
  PlaceSummary,
  Trip,
  TripStop,
  TripStopView,
  UpdateStopDetailsRequest,
} from '@roami/shared';
import { minutesOfDay, type Result } from './trips';

export function readCost(value: unknown): KnownCost | null {
  if (typeof value !== 'object' || value === null) return null;
  const { amount, currency } = value as Partial<KnownCost>;
  if (
    typeof amount !== 'number' ||
    !Number.isFinite(amount) ||
    amount < 0 ||
    amount > 1_000_000_000 ||
    typeof currency !== 'string' ||
    !/^[A-Z]{3}$/.test(currency)
  )
    return null;
  return { amount, currency };
}

export function planStopDetails(
  stop: TripStop,
  request: UpdateStopDetailsRequest,
): Result<TripStop> {
  if (request.isRequired !== undefined && typeof request.isRequired !== 'boolean') {
    return { ok: false, error: 'Choose whether this is a must-do activity.' };
  }
  const cost = readCost(request.cost);
  if (request.cost !== undefined && request.cost !== null && !cost) {
    return { ok: false, error: 'Enter a valid amount and a three-letter currency, such as USD.' };
  }
  return {
    ok: true,
    value: {
      ...stop,
      isRequired: request.isRequired ?? stop.isRequired,
      ...(request.cost !== undefined && { cost }),
    },
  };
}

export function outsidePlanningHours(
  stop: Pick<TripStop, 'startTime' | 'visitMinutes'>,
  hours: Trip['dailyWindow'],
): boolean {
  if (stop.startTime === null) return false;
  const start = minutesOfDay(stop.startTime);
  return start < minutesOfDay(hours.start) || start + stop.visitMinutes > minutesOfDay(hours.end);
}

function canLocate(place: PlaceSummary | null): place is PlaceSummary {
  return (
    !!place &&
    Number.isFinite(place.latitude) &&
    Math.abs(place.latitude) <= 90 &&
    Number.isFinite(place.longitude) &&
    Math.abs(place.longitude) <= 180
  );
}

/** Straight-line distance at 4.5 km/h, without street routing. */
function walkingEstimate(from: PlaceSummary | null, to: PlaceSummary | null): number | null {
  if (!canLocate(from) || !canLocate(to)) return null;
  const radians = Math.PI / 180;
  const latitude = (to.latitude - from.latitude) * radians;
  const longitude = (to.longitude - from.longitude) * radians;
  const a =
    Math.sin(latitude / 2) ** 2 +
    Math.cos(from.latitude * radians) *
      Math.cos(to.latitude * radians) *
      Math.sin(longitude / 2) ** 2;
  const km = 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(a)));
  return Math.ceil(km / (4.5 / 60));
}

export function describeDayStops(stops: TripStopView[]) {
  const sorted = [...stops].sort(
    (a, b) => (a.startTime ?? '24:00').localeCompare(b.startTime ?? '24:00') || a.order - b.order,
  );
  return sorted.map((stop, index) => {
    const previous = sorted[index - 1];
    const stored = previous?.order === stop.order - 1 ? stop.walkingMinutesFromPrevious : null;
    const estimated = previous ? walkingEstimate(previous.place, stop.place) : null;
    return {
      stop,
      previous,
      walking: stored ?? estimated,
      straightLine: stored === null && estimated !== null,
    };
  });
}
