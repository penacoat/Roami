import type { SavedPlace } from '@roami/shared';
import {
  collection,
  doc,
  getDocs,
  query,
  runTransaction,
  where,
  type DocumentData,
} from 'firebase/firestore';

import { db } from './firestore';

// Matches COLLECTIONS.savedPlaces in shared/src/models.ts.
const SAVED_PLACES = 'savedPlaces';

/** One entry per user and place: the document ID is `${userId}_${placeId}`, as the rules require. */
export function saveIdFor(userId: string, placeId: string): string {
  return `${userId}_${placeId}`;
}

function toSavedPlace(id: string, data: DocumentData): SavedPlace {
  return {
    id,
    userId: String(data.userId),
    placeId: String(data.placeId),
    recommendationIds: Array.isArray(data.recommendationIds)
      ? data.recommendationIds.map(String)
      : [],
    personalNote: typeof data.personalNote === 'string' ? data.personalNote : '',
    createdAt: String(data.createdAt ?? ''),
  };
}

/** Exactly the fields the security rules allow on a saved place. */
function saveDocument(save: SavedPlace): DocumentData {
  return {
    id: save.id,
    userId: save.userId,
    placeId: save.placeId,
    recommendationIds: save.recommendationIds,
    personalNote: save.personalNote,
    createdAt: save.createdAt,
  };
}

/** The user's saved places. The rules require the userId filter. */
export async function listSavesFor(userId: string): Promise<SavedPlace[]> {
  const snapshot = await getDocs(
    query(collection(db, SAVED_PLACES), where('userId', '==', userId)),
  );
  return snapshot.docs.map((d) => toSavedPlace(d.id, d.data()));
}

/** What a save change does: write this save, delete it, or leave it alone. */
export type SaveChange = SavedPlace | 'delete' | null;

/**
 * Reads the user's save for a place and applies `decide` in one transaction,
 * so two saves at once can't overwrite each other's recommendations or note.
 * `decide` gets null when there is no save yet. Anything it throws cancels the
 * change and is rethrown. Returns the save as it is afterward (null if none).
 */
export async function changeSave(
  userId: string,
  placeId: string,
  decide: (current: SavedPlace | null) => SaveChange,
): Promise<SavedPlace | null> {
  const ref = doc(db, SAVED_PLACES, saveIdFor(userId, placeId));
  return runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(ref);
    const current = snapshot.exists() ? toSavedPlace(snapshot.id, snapshot.data()) : null;
    const change = decide(current);
    if (change === null) return current;
    if (change === 'delete') {
      if (current) transaction.delete(ref);
      return null;
    }
    transaction.set(ref, saveDocument(change));
    return change;
  });
}
