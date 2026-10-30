import type { Trip } from '../../../shared/src/models';

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
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

export function tripDays(start: string, end: string): number {
  return Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86400000) + 1;
}

function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00`);
  return !Number.isNaN(date.getTime()) && dateKey(date) === value;
}

export function validateTripDraft(draft: TripDraft): string | null {
  if (!draft.city.trim()) return 'Add a destination to start your trip.';
  if (!validDate(draft.startDate) || !validDate(draft.endDate)) return 'Choose your departure and return dates.';
  if (draft.endDate < draft.startDate) return 'Your return date must be on or after your departure.';
  const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;
  if (!timePattern.test(draft.dayStart) || !timePattern.test(draft.dayEnd)) {
    return 'Use 24-hour time for daily hours, for example 09:00 and 21:00.';
  }
  if (draft.dayEnd <= draft.dayStart) return 'Daily end time must be after the start time.';
  return null;
}

export function buildTrip(draft: TripDraft, ownerId: string): Trip {
  const error = validateTripDraft(draft);
  if (error) throw new Error(error);
  const now = new Date().toISOString();
  return {
    id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    ownerId,
    city: draft.city.trim(),
    startDate: draft.startDate,
    endDate: draft.endDate,
    dailyWindow: { start: draft.dayStart, end: draft.dayEnd },
    startingPoints: [],
    candidatePlaceIds: [],
    revision: 1,
    createdAt: now,
    updatedAt: now,
  };
}
