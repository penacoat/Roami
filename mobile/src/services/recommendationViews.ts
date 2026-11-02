import type { PlaceSummary, Recommendation, RecommendationView } from '@roami/shared';

import { getUserNames } from '../repositories/UserRepository';

/** Shown when an author has no profile document (for example, an account from before ensureProfile). */
export const UNKNOWN_AUTHOR_NAME = 'Roami user';

/**
 * Turns active recommendations into the views screens show, newest first.
 * Recommendations whose place isn't in `places` are skipped.
 */
export async function toRecommendationViews(
  recommendations: Recommendation[],
  places: Map<string, PlaceSummary>,
): Promise<RecommendationView[]> {
  const shown = recommendations.filter((r) => places.has(r.placeId));
  const names = await getUserNames(shown.map((r) => r.authorId));

  return shown
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id))
    .map((r) => ({
      id: r.id,
      status: 'available',
      place: places.get(r.placeId) as PlaceSummary,
      author: { id: r.authorId, name: names.get(r.authorId) ?? UNKNOWN_AUTHOR_NAME },
      description: r.description,
      tags: r.tags,
      visitDate: r.visitDate,
      sourceLinks: r.sourceLinks,
      createdAt: r.createdAt,
    }));
}
