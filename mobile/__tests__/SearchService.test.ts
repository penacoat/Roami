// searchRecommendations against an in-memory Firestore that mimics the security
// rules (test-utils/fakeFirestore.ts).
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { ApiError } from '../src/api';
import { clearSearchCache, searchRecommendations } from '../src/services/SearchService';
import { fake } from '../test-utils/fakeFirestore';

jest.mock('firebase/firestore', () => require('../test-utils/fakeFirestore').firestoreModule);
jest.mock('../src/repositories/firestore', () => ({ db: {} }));

function seedPlace(id: string, city = 'Seattle') {
  fake.seed(`places/${id}`, {
    id,
    name: `Place ${id}`,
    city,
    latitude: 47.6,
    longitude: -122.3,
    category: 'cafe',
    openingHours: null,
    missingFields: ['openingHours'],
    source: { provider: 'manual', providerId: null, retrievedAt: '2026-10-01T12:00:00Z' },
    updatedAt: '2026-10-01T12:00:00Z',
  });
}

function seedRec(
  id: string,
  placeId: string,
  description: string,
  tags: string[],
  moderationStatus = 'active',
  createdAt = '2026-10-01T12:00:00Z',
) {
  fake.seed(`recommendations/${id}`, {
    id,
    authorId: 'u-maya',
    placeId,
    description,
    tags,
    visitDate: null,
    sourceLinks: [],
    moderationStatus,
    createdAt,
  });
}

const search = (text: string, interests: string[] = [], extra = {}) =>
  searchRecommendations({ text, interests, city: 'Seattle', ...extra });

async function rejectsWith(promise: Promise<unknown>, code: string) {
  await expect(promise).rejects.toBeInstanceOf(ApiError);
  await expect(promise).rejects.toMatchObject({ code });
}

beforeEach(() => {
  fake.reset();
  clearSearchCache();
  fake.uid = 'viewer';
  fake.seed('users/u-maya', { id: 'u-maya', name: 'Maya', bio: '', interests: [], createdAt: '' });
  for (const id of ['p-jazz', 'p-cafe', 'p-bar', 'p-pdx']) {
    seedPlace(id, id === 'p-pdx' ? 'Portland' : 'Seattle');
  }
  seedRec('r1', 'p-jazz', 'Small room, great trio on weekends.', ['jazz', 'live music']);
  seedRec(
    'r4',
    'p-cafe',
    'Used to have jazz nights, but it no longer has jazz. Still good coffee.',
    ['cafe', 'coffee', 'study'],
  );
  seedRec('r9', 'p-bar', 'Loud and fun on Fridays.', ['live music', 'bar']);
  seedRec('r-removed', 'p-jazz', 'Best jazz ever.', ['jazz'], 'removed');
  seedRec('r-pdx', 'p-pdx', 'Portland jazz.', ['jazz']);
});

describe('searchRecommendations', () => {
  it('returns exact matches first, then broader ones, each with reasons', async () => {
    const { results } = await search('jazz');
    expect(results.map((r) => [r.recommendation.id, r.matchLevel])).toEqual([
      ['r1', 'exact'],
      ['r9', 'broader'],
    ]);
    expect(results[0].reasons).toEqual([
      { kind: 'exact', term: 'jazz', matched: 'jazz', source: 'tag' },
    ]);
    expect(results[0].recommendation).toMatchObject({
      status: 'available',
      author: { name: 'Maya' },
      place: { id: 'p-jazz' },
    });
  });
  it('skips "no longer has jazz", removed recommendations, and other cities', async () => {
    const ids = (await search('jazz')).results.map((r) => r.recommendation.id);
    expect(ids).not.toContain('r4');
    expect(ids).not.toContain('r-removed');
    expect(ids).not.toContain('r-pdx');
  });
  it('uses interests as search terms', async () => {
    const { results } = await search('', ['coffee']);
    expect(results.map((r) => r.recommendation.id)).toEqual(['r4']);
  });
  it('returns no results for an empty search or no matches', async () => {
    await expect(search('')).resolves.toEqual({ results: [] });
    await expect(search('skydiving')).resolves.toEqual({ results: [] });
  });
  it('respects the limit', async () => {
    const { results } = await search('jazz', [], { limit: 1 });
    expect(results.map((r) => r.recommendation.id)).toEqual(['r1']);
  });
  it('reuses the city data between searches', async () => {
    await search('jazz');
    const readsAfterFirst = fake.reads;
    await search('coffee');
    expect(fake.reads - readsAfterFirst).toBeLessThan(5); // only author names are read again
  });
  it('rejects a missing city and an overly long search', async () => {
    await rejectsWith(
      searchRecommendations({ text: 'jazz', interests: [], city: ' ' }),
      'invalid-argument',
    );
    await rejectsWith(search('x'.repeat(201)), 'invalid-argument');
  });
});
