import type { PlaceSummary, SearchResult } from '@roami/shared';

import { tokenize } from './searchMatcher';

function comparable(text: string): string {
  return tokenize(text).join(' ');
}

function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Keeps Explore's catalog list aligned with recommendation relevance while
 * retaining name/category-only matches and stable ordering for ties.
 */
export function rankExplorePlaces(
  places: PlaceSummary[],
  text: string,
  results: SearchResult[],
): PlaceSummary[] {
  const query = comparable(text);
  if (!query) return places;

  const rankedMatchByPlace = new Map<string, { tier: number; index: number }>();
  results.forEach((result, index) => {
    const placeId = result.recommendation.place.id;
    const tier = result.reasons.some(
      (reason) => reason.kind === 'exact' && reason.source === 'text',
    )
      ? 1
      : result.reasons.some(
            (reason) =>
              reason.source === 'text' && (reason.kind === 'synonym' || reason.kind === 'prefix'),
          )
        ? 2
        : result.matchLevel === 'exact'
          ? 3
          : 5;
    const current = rankedMatchByPlace.get(placeId);
    if (!current || tier < current.tier) rankedMatchByPlace.set(placeId, { tier, index });
  });

  const relevance = (place: PlaceSummary) => {
    const name = comparable(place.name);
    const category = comparable(place.category);
    const match = rankedMatchByPlace.get(place.id);

    if (name === query) return { tier: 0, matchIndex: -1, position: 0 };
    if (match?.tier === 1) return { tier: 1, matchIndex: match.index, position: 0 };
    if (name.includes(query)) {
      return { tier: 2, matchIndex: -1, position: name.indexOf(query) };
    }
    if (match?.tier === 2) return { tier: 2, matchIndex: match.index, position: 0 };
    if (match?.tier === 3) return { tier: 3, matchIndex: match.index, position: 0 };
    if (category === query || category.includes(query)) {
      return { tier: 4, matchIndex: -1, position: category === query ? 0 : 1 };
    }
    if (match) return { tier: match.tier, matchIndex: match.index, position: 0 };
    return { tier: 6, matchIndex: Number.MAX_SAFE_INTEGER, position: 0 };
  };

  return [...places].sort((a, b) => {
    const aRank = relevance(a);
    const bRank = relevance(b);
    return (
      aRank.tier - bRank.tier ||
      aRank.matchIndex - bRank.matchIndex ||
      aRank.position - bRank.position ||
      compareText(comparable(a.name), comparable(b.name)) ||
      compareText(a.id, b.id)
    );
  });
}
