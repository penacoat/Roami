import type { PlaceSummary, SearchResult } from '@roami/shared';
import { describe, expect, it } from '@jest/globals';

import { rankExplorePlaces } from '../src/logic/exploreSearch';

const place = (id: string, name: string, category = 'other'): PlaceSummary => ({
  id,
  name,
  category,
  latitude: 47.6,
  longitude: -122.3,
  openingHours: null,
  missingFields: [],
});

function result(
  item: PlaceSummary,
  id: string,
  matchLevel: SearchResult['matchLevel'],
  kind: SearchResult['reasons'][number]['kind'],
  source: SearchResult['reasons'][number]['source'],
): SearchResult {
  return {
    recommendation: {
      id,
      status: 'available',
      place: item,
      author: null,
      description: '',
      tags: [],
      visitDate: null,
      sourceLinks: [],
      createdAt: '2026-10-01T12:00:00Z',
    },
    matchLevel,
    reasons: [{ kind, term: 'museum', matched: 'museum', source }],
  };
}

describe('rankExplorePlaces', () => {
  it('orders exact place names, exact recommendation text, partial names, tags, categories, and related matches', () => {
    const exactName = place('exact', 'Museum', 'other');
    const exactText = place('text', 'Gallery House', 'other');
    const partialName = place('partial', 'Seattle Art Museum');
    const tagged = place('tag', 'Curated Collection', 'other');
    const partialText = place('partial-text', 'Performance Hall', 'other');
    const synonym = place('synonym', 'Exhibit Hall', 'other');
    const category = place('category', 'Glasshouse', 'museum');
    const related = place('related', 'Night Venue', 'other');

    const ranked = rankExplorePlaces(
      [category, related, synonym, tagged, partialText, partialName, exactText, exactName],
      'MUSEUM',
      [
        result(exactText, 'r-text', 'exact', 'exact', 'text'),
        result(partialText, 'r-prefix', 'exact', 'prefix', 'text'),
        result(tagged, 'r-tag', 'exact', 'exact', 'tag'),
        result(synonym, 'r-synonym', 'exact', 'synonym', 'text'),
        result(related, 'r-related', 'broader', 'broader', 'tag'),
      ],
    );

    expect(ranked.map((item) => item.id)).toEqual([
      'exact',
      'text',
      'partial',
      'partial-text',
      'synonym',
      'tag',
      'category',
      'related',
    ]);
  });

  it('uses the best-ranked recommendation when a place has multiple results', () => {
    const textMatch = place('shared', 'The Hall');
    const tagMatch = place('tag', 'Another Hall');
    const results = [
      result(textMatch, 'r-weaker', 'exact', 'exact', 'tag'),
      result(textMatch, 'r-best', 'exact', 'exact', 'text'),
      result(tagMatch, 'r-tag', 'exact', 'exact', 'tag'),
    ];

    expect(
      rankExplorePlaces([tagMatch, textMatch], 'museum', results).map((item) => item.id),
    ).toEqual(['shared', 'tag']);
  });

  it('orders equal relevance deterministically by normalized name and then ID', () => {
    const sameNameZ = place('z', 'Café', 'coffee');
    const sameNameA = place('a', 'Cafe', 'coffee');
    const earlierName = place('b', 'Bean House', 'coffee');

    expect(
      rankExplorePlaces([sameNameZ, sameNameA, earlierName], 'COFFEE', []).map((item) => item.id),
    ).toEqual(['b', 'a', 'z']);
  });

  it('preserves catalog order for an empty search and is stable when there are no matches', () => {
    const places = [place('z', 'Zoo'), place('a', 'Art House')];

    expect(rankExplorePlaces(places, '', []).map((item) => item.id)).toEqual(['z', 'a']);
    expect(rankExplorePlaces(places, 'unmatched', []).map((item) => item.id)).toEqual(['a', 'z']);
  });
});
