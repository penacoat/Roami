import type { Trip, TripStopView } from '@roami/shared';
import { minutesOfDay } from '../logic/trips';
import { MIDNIGHT } from './stopTime';

export function activityName(stop: TripStopView): string {
  return stop.place?.name ?? stop.title ?? 'Place unavailable';
}

export function timedActivities(stops: TripStopView[]) {
  return stops
    .flatMap((stop) => {
      if (stop.startTime === null) return [];
      const start = minutesOfDay(stop.startTime);
      return [{ stop, start, end: start + stop.visitMinutes }];
    })
    .sort((a, b) => a.start - b.start || a.end - b.end);
}

export function timeBetweenActivities(events: ReturnType<typeof timedActivities>) {
  const gaps: { start: number; end: number }[] = [];
  let busyUntil = 0;
  for (const [index, event] of events.entries()) {
    if (index > 0 && event.start > busyUntil) gaps.push({ start: busyUntil, end: event.start });
    busyUntil = Math.max(busyUntil, event.end);
  }
  return gaps;
}

export function calendarBounds(
  window: Trip['dailyWindow'],
  events: ReturnType<typeof timedActivities>,
) {
  const start = Math.min(minutesOfDay(window.start), ...events.map((event) => event.start));
  const end = Math.max(minutesOfDay(window.end), ...events.map((event) => event.end));
  return { start: Math.floor(start / 30) * 30, end: Math.min(MIDNIGHT, Math.ceil(end / 30) * 30) };
}

export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return [hours > 0 && `${hours} hr`, remainder > 0 && `${remainder} min`]
    .filter(Boolean)
    .join(' ');
}
