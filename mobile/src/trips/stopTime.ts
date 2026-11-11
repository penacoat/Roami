// Converting stop times between what's stored ("HH:mm", 24-hour, plus a length
// in minutes), what the time pickers use (minutes after midnight), and what's
// shown ("1:00pm – 2:00pm").
import { MAX_VISIT_MINUTES, minutesOfDay } from '../logic/trips';

/** The end of the day, as minutes after midnight. */
export const MIDNIGHT = 24 * 60;

/** What the pickers start at for a stop that has no time yet: noon to 1pm. */
export const DEFAULT_START = 12 * 60;
export const DEFAULT_END = 13 * 60;

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

/** "HH:mm" for a number of minutes after midnight (0 to 1439). */
export function timeFromMinutes(minutes: number): string {
  return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
}

/** "1:00pm" for 780 minutes after midnight. Midnight shows as "12:00am". */
export function formatMinutes(minutes: number): string {
  const inDay = minutes % MIDNIGHT;
  const hour = Math.floor(inDay / 60);
  const shown = hour % 12 === 0 ? 12 : hour % 12;
  return `${shown}:${pad(inDay % 60)}${hour < 12 ? 'am' : 'pm'}`;
}

/** "1:00pm" for "13:00". */
export function formatTime(time: string): string {
  return formatMinutes(minutesOfDay(time));
}

/** "1:00pm – 2:00pm" for a stop starting at 13:00 that lasts 60 minutes. */
export function formatTimeRange(startTime: string, visitMinutes: number): string {
  const start = minutesOfDay(startTime);
  return `${formatMinutes(start)} – ${formatMinutes(start + visitMinutes)}`;
}

/** A stop's start and end as minutes after midnight, or the defaults if untimed. */
export function stopRange(stop: { startTime: string | null; visitMinutes: number }): {
  start: number;
  end: number;
} {
  if (!stop.startTime) return { start: DEFAULT_START, end: DEFAULT_END };
  const start = minutesOfDay(stop.startTime);
  return { start, end: Math.min(start + stop.visitMinutes, MIDNIGHT) };
}

export type TimeRange =
  { ok: true; startTime: string; visitMinutes: number } | { ok: false; error: string };

/**
 * Checks a picked start and end (minutes after midnight; an end of MIDNIGHT is
 * the end of the day) and turns them into what a stop stores.
 */
export function rangeFromMinutes(start: number, end: number): TimeRange {
  if (end <= start) return { ok: false, error: 'The end time must be after the start time.' };
  if (end - start > MAX_VISIT_MINUTES) {
    return { ok: false, error: 'A visit can be at most 12 hours.' };
  }
  return { ok: true, startTime: timeFromMinutes(start), visitMinutes: end - start };
}
