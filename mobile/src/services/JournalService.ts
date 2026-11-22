import { ApiError } from '../api';
import { journalView, validateRanking } from '../logic/journal';
import { isValidDate } from '../logic/trips';
import { readJournal, writeRanking, writeVisit } from '../repositories/JournalRepository';
import { getPlacesByIds } from '../repositories/PlaceRepository';
import { requirePlaceId, requireUserId } from './TripService';

async function viewFor(userId: string) {
  const { visits, rankings } = await readJournal(userId);
  const places = await getPlacesByIds(visits.map((visit) => visit.placeId));
  return journalView(visits, rankings, places);
}

export function getPlaceJournal() {
  return viewFor(requireUserId());
}

export async function markVisited(request: { placeId: string; visitDate: string }) {
  const userId = requireUserId();
  const placeId = requirePlaceId(request.placeId);
  if (placeId.includes('/') || !isValidDate(request.visitDate)) {
    throw new ApiError('invalid-argument', 'Choose a place and a valid visit date.');
  }
  if (!(await getPlacesByIds([placeId])).has(placeId)) {
    throw new ApiError('not-found', 'That place is no longer in the catalog.');
  }
  const id = `${userId}_${placeId}_${request.visitDate}`;
  const visit = { id, userId, placeId, visitDate: request.visitDate };
  await writeVisit(visit);
  return { visit };
}

export async function saveRanking(request: { category: string; placeIds: string[] }) {
  const userId = requireUserId();
  const before = await viewFor(userId);
  const checked = validateRanking(request.category, request.placeIds, before);
  if (!checked.ok) throw new ApiError('invalid-argument', checked.error);
  const ranking = { id: `${userId}_${request.category}`, userId, ...request };
  await writeRanking(ranking);
  return {
    ...before,
    rankings: [...before.rankings.filter(({ category }) => category !== request.category), ranking],
  };
}
