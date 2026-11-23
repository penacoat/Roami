import type { StartingPoint, WalkingLimit } from '@roami/shared';
import {
  MAX_TRIP_DAYS,
  MAX_STARTING_POINT_LABEL_LENGTH,
  MAX_WALKING_DISTANCE_METERS,
  MAX_WALKING_DURATION_MINUTES,
  isValidTime,
  tripDayCount,
} from '../logic/trips';

export interface TripDraft {
  city: string;
  startDate: string;
  endDate: string;
  dayStart: string;
  dayEnd: string;
  startingPointLabel: string;
  walkingLimitType: WalkingLimit['type'] | null;
  walkingLimitValue: string;
}

export interface TripPreferences {
  startingPoints: StartingPoint[];
  walkingLimit: WalkingLimit | null;
}

export function dateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function formatDate(value: string): string {
  return new Date(`${value}T12:00:00`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function tripDays(start: string, end: string): number {
  return tripDayCount(start, end);
}

function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00`);
  return !Number.isNaN(date.getTime()) && dateKey(date) === value;
}

export function validateTripDraft(draft: TripDraft): string | null {
  if (!draft.city.trim()) return 'Add a destination to start your trip.';
  if (!validDate(draft.startDate) || !validDate(draft.endDate))
    return 'Choose your departure and return dates.';
  if (draft.endDate < draft.startDate)
    return 'Your return date must be on or after your departure.';
  if (tripDays(draft.startDate, draft.endDate) > MAX_TRIP_DAYS) {
    return `Trips can be at most ${MAX_TRIP_DAYS} days.`;
  }
  if (!isValidTime(draft.dayStart) || !isValidTime(draft.dayEnd)) {
    return 'Use 24-hour time for daily hours, for example 09:00 and 21:00.';
  }
  if (draft.dayEnd <= draft.dayStart) return 'Daily end time must be after the start time.';
  if (draft.startingPointLabel.trim().length > MAX_STARTING_POINT_LABEL_LENGTH) {
    return `Starting location must be ${MAX_STARTING_POINT_LABEL_LENGTH} characters or fewer.`;
  }
  if (draft.walkingLimitType) {
    const value = draft.walkingLimitValue.trim();
    if (!value) return 'Enter a maximum walking preference or choose No preference.';
    if (draft.walkingLimitType === 'distance') {
      if (!/^\d+(\.\d{1,3})?$/.test(value)) {
        return 'Enter a walking distance in kilometers, up to three decimal places.';
      }
      const meters = Number(value) * 1_000;
      if (!Number.isInteger(meters) || meters < 1 || meters > MAX_WALKING_DISTANCE_METERS) {
        return 'Walking distance must be between 0.001 and 100 km.';
      }
    } else {
      if (!/^\d+$/.test(value)) return 'Enter a whole number of walking minutes.';
      const minutes = Number(value);
      if (minutes < 1 || minutes > MAX_WALKING_DURATION_MINUTES) {
        return `Walking duration must be between 1 and ${MAX_WALKING_DURATION_MINUTES} minutes.`;
      }
    }
  } else if (draft.walkingLimitValue.trim()) {
    return 'Choose Distance or Duration, or clear the walking preference.';
  }
  return null;
}

export function tripPreferencesFromDraft(draft: TripDraft): TripPreferences {
  const label = draft.startingPointLabel.trim();
  const startingPoints = label ? [{ label }] : [];
  const value = draft.walkingLimitValue.trim();
  const walkingLimit: WalkingLimit | null = !draft.walkingLimitType
    ? null
    : {
        type: draft.walkingLimitType,
        value: draft.walkingLimitType === 'distance' ? Number(value) * 1_000 : Number(value),
      };
  return { startingPoints, walkingLimit };
}
