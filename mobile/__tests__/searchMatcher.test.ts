import { describe, expect, it } from '@jest/globals';

import {
  matchRecommendation,
  parseQuery,
  rankMatches,
  singular,
  type Searchable,
} from '../src/logic/searchMatcher';

const rec = (
  id: string,
  description: string,
  tags: string[],
  createdAt = '2026-10-01T12:00:00Z',
): Searchable => ({ id, description, tags, createdAt });

// The seed and fixture recommendations that matter for these tests.
const JAZZ_CLUB = rec('r1', 'Small room, great trio on weekends.', ['jazz', 'live music']);
const OLD_JAZZ_CAFE = rec(
  'r4',
  'Used to have jazz nights, but it no longer has jazz. Still good coffee and quiet for studying.',
  ['cafe', 'coffee', 'study'],
);
const LIVE_MUSIC_BAR = rec('r9', 'Loud and fun on Fridays.', ['live music', 'bar']);

describe('parseQuery', () => {
  it('drops filler words and duplicates', () => {
    expect(parseQuery('a good place for Coffee and COFFEE', [])).toEqual(['coffee']);
  });
  it('keeps known phrases together', () => {
    expect(parseQuery('live music near Pike', [])).toEqual(['live music', 'pike']);
  });
  it('keeps multi-word tags from the catalog together', () => {
    expect(parseQuery('freshly ground coffee', [], ['freshly ground'])).toEqual([
      'freshly ground',
      'coffee',
    ]);
  });
  it('adds interests as whole terms', () => {
    expect(parseQuery('', ['Jazz', 'live music'])).toEqual(['jazz', 'live music']);
  });
});

describe('singular', () => {
  it('handles common plurals', () => {
    expect(['museums', 'galleries', 'glasses', 'views', 'bus'].map(singular)).toEqual([
      'museum',
      'gallery',
      'glass',
      'view',
      'bus',
    ]);
  });
});

describe('matchRecommendation', () => {
  it('ignores capitalization', () => {
    expect(matchRecommendation(JAZZ_CLUB, ['JAZZ'])).toEqual([
      { kind: 'exact', term: 'JAZZ', matched: 'jazz', source: 'tag' },
    ]);
  });
  it('matches plurals as exact', () => {
    const museum = rec('m', 'Great collection.', ['museum']);
    expect(matchRecommendation(museum, ['museums'])[0]).toMatchObject({ kind: 'exact' });
  });
  it('finds a term in the written description', () => {
    const r = rec('t', 'Get a pastry and walk the lower levels.', ['market']);
    expect(matchRecommendation(r, ['walk'])).toEqual([
      { kind: 'exact', term: 'walk', matched: 'walk', source: 'text' },
    ]);
  });
  it('does not match negated text: "no longer has jazz" is not a jazz match', () => {
    expect(matchRecommendation(OLD_JAZZ_CAFE, ['jazz'])).toEqual([]);
  });
  it.each([
    'No jazz here, but the coffee is good.',
    'Jazz is no longer offered.',
    "They don't do jazz anymore.",
    'Great spot without jazz.',
  ])('treats "%s" as not a jazz match', (description) => {
    expect(matchRecommendation(rec('n', description, []), ['jazz'])).toEqual([]);
  });
  it('keeps negation within its clause', () => {
    const r = rec('n', 'No wifi, great jazz on Saturdays.', []);
    expect(matchRecommendation(r, ['jazz'])).toEqual([
      { kind: 'exact', term: 'jazz', matched: 'jazz', source: 'text' },
    ]);
  });
  it('matches synonyms', () => {
    expect(matchRecommendation(OLD_JAZZ_CAFE, ['espresso'])).toEqual([
      { kind: 'synonym', term: 'espresso', matched: 'coffee', source: 'tag' },
    ]);
  });
  it('matches a prefix of 3 or more letters, but not shorter', () => {
    expect(matchRecommendation(OLD_JAZZ_CAFE, ['caf'])).toEqual([
      { kind: 'prefix', term: 'caf', matched: 'cafe', source: 'tag' },
    ]);
    expect(matchRecommendation(OLD_JAZZ_CAFE, ['ca'])).toEqual([]);
  });
  it('labels a related idea as broader, not exact', () => {
    expect(matchRecommendation(LIVE_MUSIC_BAR, ['jazz'])).toEqual([
      { kind: 'broader', term: 'jazz', matched: 'live music', source: 'tag' },
    ]);
  });
  it('matches written accounts, not just categories ("vintage sunglasses")', () => {
    const shop = rec('s', 'Found amazing vintage eyewear in the back room.', ['clothing']);
    expect(matchRecommendation(shop, ['vintage', 'sunglasses'])).toEqual([
      { kind: 'exact', term: 'vintage', matched: 'vintage', source: 'text' },
      { kind: 'synonym', term: 'sunglasses', matched: 'eyewear', source: 'text' },
    ]);
  });
  it('folds accents', () => {
    expect(matchRecommendation(rec('a', 'Best café in town.', []), ['cafe'])).toHaveLength(1);
  });
});

describe('rankMatches', () => {
  it('puts a recommendation matching both interests above one matching only one', () => {
    const both = rec('both', 'Freshly ground coffee and a jazz trio.', [], '2026-01-01T00:00:00Z');
    const coffeeOnly = rec('coffee', 'Great coffee.', ['coffee'], '2026-10-30T00:00:00Z');
    expect(rankMatches([coffeeOnly, both], ['coffee', 'jazz']).map((m) => m.id)).toEqual([
      'both',
      'coffee',
    ]);
  });
  it('lists exact matches before broader ones and labels each', () => {
    const results = rankMatches([LIVE_MUSIC_BAR, JAZZ_CLUB, OLD_JAZZ_CAFE], ['jazz']);
    expect(results.map((m) => [m.id, m.matchLevel])).toEqual([
      ['r1', 'exact'],
      ['r9', 'broader'],
    ]);
  });
  it('breaks ties by newest first', () => {
    const older = rec('older', '', ['coffee'], '2026-01-01T00:00:00Z');
    const newer = rec('newer', '', ['coffee'], '2026-02-01T00:00:00Z');
    expect(rankMatches([older, newer], ['coffee']).map((m) => m.id)).toEqual(['newer', 'older']);
  });
  it('returns nothing for no terms', () => {
    expect(rankMatches([JAZZ_CLUB], [])).toEqual([]);
  });
});
