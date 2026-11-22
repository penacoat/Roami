import { MAX_TRIP_DAYS, isValidTime, tripDayCount } from '../logic/trips';

export interface TripDraft {
  city: string;
  startDate: string;
  endDate: string;
  dayStart: string;
  dayEnd: string;
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
  return null;
}
