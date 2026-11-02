import type { ModerationStatus, Recommendation } from '@roami/shared';
import { collection, getDocs, query, where, type DocumentData } from 'firebase/firestore';

import { db } from './firestore';

// Matches COLLECTIONS.recommendations in shared/src/models.ts.
const RECOMMENDATIONS = 'recommendations';

// Firestore allows at most 30 values in one 'in' filter.
const IN_LIMIT = 30;

const STATUSES: ModerationStatus[] = ['active', 'hidden', 'removed'];

function toRecommendation(id: string, data: DocumentData): Recommendation {
  const status = STATUSES.find((s) => s === data.moderationStatus) ?? 'removed';
  return {
    id,
    authorId: String(data.authorId ?? ''),
    placeId: String(data.placeId ?? ''),
    description: String(data.description ?? ''),
    tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
    visitDate: typeof data.visitDate === 'string' ? data.visitDate : null,
    sourceLinks: Array.isArray(data.sourceLinks) ? data.sourceLinks.map(String) : [],
    moderationStatus: status,
    createdAt: String(data.createdAt ?? ''),
  };
}

/** Active recommendations for one place. The rules require the moderationStatus filter. */
export async function listActiveForPlace(placeId: string): Promise<Recommendation[]> {
  const snapshot = await getDocs(
    query(
      collection(db, RECOMMENDATIONS),
      where('placeId', '==', placeId),
      where('moderationStatus', '==', 'active'),
    ),
  );
  return snapshot.docs.map((d) => toRecommendation(d.id, d.data()));
}

/** Active recommendations for any of these places, read 30 places at a time. */
export async function listActiveForPlaces(placeIds: string[]): Promise<Recommendation[]> {
  const unique = [...new Set(placeIds)];
  const chunks: string[][] = [];
  for (let i = 0; i < unique.length; i += IN_LIMIT) chunks.push(unique.slice(i, i + IN_LIMIT));

  const snapshots = await Promise.all(
    chunks.map((ids) =>
      getDocs(
        query(
          collection(db, RECOMMENDATIONS),
          where('placeId', 'in', ids),
          where('moderationStatus', '==', 'active'),
        ),
      ),
    ),
  );
  return snapshots.flatMap((s) => s.docs.map((d) => toRecommendation(d.id, d.data())));
}
