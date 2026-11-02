import type {
  ListSavedPlacesRequest,
  ListSavedPlacesResponse,
  PlaceSummary,
  Recommendation,
  RecommendationView,
  RemoveSavedPlaceRequest,
  RemoveSavedPlaceResponse,
  SavedPlace,
  SavedPlaceView,
  SavePlaceRequest,
  SavePlaceResponse,
  UpdateSavedNoteRequest,
  UpdateSavedNoteResponse,
} from '@roami/shared';

import { ApiError } from '../api';
import { getPlacesByIds } from '../repositories/PlaceRepository';
import { getRecommendationsByIds } from '../repositories/RecommendationRepository';
import { changeSave, listSavesFor, saveIdFor } from '../repositories/SavedPlaceRepository';
import { toRecommendationViews } from './recommendationViews';
import { requirePlaceId, requireUserId } from './TripService';

// These limits match validSave in firestore.rules.
const MAX_NOTE_LENGTH = 2000;
const MAX_RECOMMENDATIONS = 25;

/** How a recommendation that was removed or hidden appears on a save. */
function unavailableView(id: string, place: PlaceSummary): RecommendationView {
  return {
    id,
    status: 'unavailable',
    place,
    author: null,
    description: '',
    tags: [],
    visitDate: null,
    sourceLinks: [],
    createdAt: '',
  };
}

/**
 * Builds the views for these saves, in the order given. Recommendations that
 * were removed since show as unavailable, and the save, its note, and its other
 * recommendations stay intact. Saves whose place left the catalog are skipped.
 */
async function toSavedPlaceViews(saves: SavedPlace[]): Promise<SavedPlaceView[]> {
  const [places, recs] = await Promise.all([
    getPlacesByIds(saves.map((s) => s.placeId)),
    getRecommendationsByIds(saves.flatMap((s) => s.recommendationIds)),
  ]);
  const active = [...recs.values()].filter(
    (r): r is Recommendation => r.moderationStatus === 'active',
  );
  const views = new Map((await toRecommendationViews(active, places)).map((v) => [v.id, v]));

  return saves.flatMap((save) => {
    const place = places.get(save.placeId);
    if (!place) return [];
    return [
      {
        place,
        recommendations: save.recommendationIds.map(
          (id) => views.get(id) ?? unavailableView(id, place),
        ),
        personalNote: save.personalNote,
        createdAt: save.createdAt,
      },
    ];
  });
}

async function toSavedPlaceView(save: SavedPlace): Promise<SavedPlaceView> {
  const [view] = await toSavedPlaceViews([save]);
  if (!view) throw new ApiError('not-found', 'That place is not in the catalog.');
  return view;
}

/**
 * Saves a place for the signed-in user. There is one saved entry per user and
 * place: saving it again with another recommendation attaches that
 * recommendation as a source and keeps the note.
 */
export async function savePlace(request: SavePlaceRequest): Promise<SavePlaceResponse> {
  const userId = requireUserId();
  const placeId = requirePlaceId(request.placeId);
  const recommendationId = request.recommendationId;
  if (
    recommendationId !== undefined &&
    (typeof recommendationId !== 'string' || !recommendationId)
  ) {
    throw new ApiError('invalid-argument', 'That recommendation ID is invalid.');
  }

  const [places, recs] = await Promise.all([
    getPlacesByIds([placeId]),
    getRecommendationsByIds(recommendationId ? [recommendationId] : []),
  ]);
  if (!places.has(placeId)) throw new ApiError('not-found', 'That place is not in the catalog.');
  if (recommendationId) {
    const rec = recs.get(recommendationId);
    if (!rec || rec.moderationStatus !== 'active') {
      throw new ApiError('not-found', 'That recommendation is no longer available.');
    }
    if (rec.placeId !== placeId) {
      throw new ApiError('invalid-argument', 'That recommendation is about a different place.');
    }
  }

  const saved = await changeSave(userId, placeId, (current) => {
    if (!current) {
      return {
        id: saveIdFor(userId, placeId),
        userId,
        placeId,
        recommendationIds: recommendationId ? [recommendationId] : [],
        personalNote: '',
        createdAt: new Date().toISOString(),
      };
    }
    if (!recommendationId || current.recommendationIds.includes(recommendationId)) return null;
    if (current.recommendationIds.length >= MAX_RECOMMENDATIONS) {
      throw new ApiError(
        'invalid-argument',
        `A saved place can keep at most ${MAX_RECOMMENDATIONS} recommendations.`,
      );
    }
    return { ...current, recommendationIds: [...current.recommendationIds, recommendationId] };
  });
  if (!saved) throw new ApiError('internal', 'The place could not be saved. Try again.');
  return { saved: await toSavedPlaceView(saved) };
}

/** The signed-in user's saved places, most recently saved first. */
export async function listSavedPlaces(
  _request: ListSavedPlacesRequest,
): Promise<ListSavedPlacesResponse> {
  const userId = requireUserId();
  const saves = await listSavesFor(userId);
  saves.sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id));
  return { saved: await toSavedPlaceViews(saves) };
}

export async function updateSavedNote(
  request: UpdateSavedNoteRequest,
): Promise<UpdateSavedNoteResponse> {
  const userId = requireUserId();
  const placeId = requirePlaceId(request.placeId);
  if (typeof request.personalNote !== 'string') {
    throw new ApiError('invalid-argument', 'The note must be text.');
  }
  const personalNote = request.personalNote.trim();
  if (personalNote.length > MAX_NOTE_LENGTH) {
    throw new ApiError('invalid-argument', `Notes can be at most ${MAX_NOTE_LENGTH} characters.`);
  }

  const saved = await changeSave(userId, placeId, (current) => {
    if (!current) throw new ApiError('not-found', 'That place is not saved.');
    return current.personalNote === personalNote ? null : { ...current, personalNote };
  });
  if (!saved) throw new ApiError('not-found', 'That place is not saved.');
  return { saved: await toSavedPlaceView(saved) };
}

/** Removes a saved place. Removing one that isn't saved also succeeds. */
export async function removeSavedPlace(
  request: RemoveSavedPlaceRequest,
): Promise<RemoveSavedPlaceResponse> {
  const userId = requireUserId();
  const placeId = requirePlaceId(request.placeId);
  await changeSave(userId, placeId, (current) => (current ? 'delete' : null));
  return { removed: true };
}
