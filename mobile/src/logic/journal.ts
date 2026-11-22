import type { PlaceJournalResponse, PlaceSummary, Ranking, Visit } from '@roami/shared';
import type { Result } from './trips';

export function journalView(
  visits: Visit[],
  rankings: Ranking[],
  places: Map<string, PlaceSummary>,
): PlaceJournalResponse {
  const latest = new Map<string, string>();
  for (const visit of visits) {
    if (visit.visitDate > (latest.get(visit.placeId) ?? ''))
      latest.set(visit.placeId, visit.visitDate);
  }
  return {
    visited: Array.from(latest, ([id, visitDate]) => {
      const place = places.get(id);
      return place ? [{ place, visitDate }] : [];
    })
      .flat()
      .sort(
        (a, b) =>
          b.visitDate.localeCompare(a.visitDate) || a.place.name.localeCompare(b.place.name),
      ),
    rankings,
  };
}

export function validateRanking(
  category: string,
  placeIds: string[],
  journal: PlaceJournalResponse,
): Result<null> {
  if (
    typeof category !== 'string' ||
    !category.trim() ||
    category.length > 100 ||
    category.includes('/')
  ) {
    return { ok: false, error: 'Choose a place category.' };
  }
  if (
    !Array.isArray(placeIds) ||
    placeIds.length > 100 ||
    new Set(placeIds).size !== placeIds.length
  ) {
    return { ok: false, error: 'Rank up to 100 different places per category.' };
  }
  if (
    placeIds.some(
      (id) => !journal.visited.some(({ place }) => place.id === id && place.category === category),
    )
  ) {
    return { ok: false, error: 'Rank visited places from this category.' };
  }
  return { ok: true, value: null };
}
