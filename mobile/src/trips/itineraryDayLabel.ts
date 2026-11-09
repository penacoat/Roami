import { dateKey, formatDate } from './tripDraft';

export function itineraryDayLabel(startDate: string, day: number): string {
  const date = new Date(`${startDate}T12:00:00`);
  date.setDate(date.getDate() + day - 1);
  return `Day ${day} · ${formatDate(dateKey(date))}`;
}
