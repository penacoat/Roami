import type { ModerationStatus, Recommendation } from '@roami/shared';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  where,
  type DocumentData,
} from 'firebase/firestore';

import { db } from './firestore';

// Matches COLLECTIONS.recommendations in shared/src/models.ts.
const RECOMMENDATIONS = 'recommendations';

// Firestore allows at most 30 values in one 'in' filter.
const IN_LIMIT = 30;

const STATUSES: ModerationStatus[] = ['active', 'hidden', 'removed'];

/** Firestore-generated ID for a new recommendation. */
export function newRecommendationId(): string {
  return doc(collection(db, RECOMMENDATIONS)).id;
}

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

/** Exactly the fields allowed by validRecommendation in firestore.rules. */
function recommendationDocument(recommendation: Recommendation): DocumentData {
  return {
    id: recommendation.id,
    authorId: recommendation.authorId,
    placeId: recommendation.placeId,
    description: recommendation.description,
    tags: recommendation.tags,
    visitDate: recommendation.visitDate,
    sourceLinks: recommendation.sourceLinks,
    moderationStatus: recommendation.moderationStatus,
    createdAt: recommendation.createdAt,
  };
}

export async function createRecommendation(recommendation: Recommendation): Promise<void> {
  await setDoc(doc(db, RECOMMENDATIONS, recommendation.id), recommendationDocument(recommendation));
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

/**
 * The recommendations among these IDs that the user can see, keyed by ID. The
 * rules hide removed and hidden recommendations from everyone but their
 * author, so those, and IDs that don't exist, are left out.
 */
export async function getRecommendationsByIds(ids: string[]): Promise<Map<string, Recommendation>> {
  const unique = [...new Set(ids)].filter((id) => id.length > 0);
  const found = await Promise.all(
    unique.map(async (id) => {
      try {
        const snapshot = await getDoc(doc(db, RECOMMENDATIONS, id));
        return snapshot.exists() ? toRecommendation(snapshot.id, snapshot.data()) : null;
      } catch (error) {
        const code = (error as { code?: unknown } | null)?.code;
        if (code === 'permission-denied') return null;
        throw error;
      }
    }),
  );
  return new Map(found.flatMap((r) => (r ? [[r.id, r] as const] : [])));
}
