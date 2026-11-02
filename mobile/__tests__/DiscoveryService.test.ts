// getPlace and getFeed against an in-memory Firestore that mimics the security
// rules (test-utils/fakeFirestore.ts).
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { ApiError } from '../src/api';
import { getFeed } from '../src/services/DiscoveryService';
import { getPlace } from '../src/services/PlaceService';
import { UNKNOWN_AUTHOR_NAME } from '../src/services/recommendationViews';
import { fake } from '../test-utils/fakeFirestore';

jest.mock('firebase/firestore', () => require('../test-utils/fakeFirestore').firestoreModule);
jest.mock('../src/repositories/firestore', () => ({ db: {} }));

function seedPlace(id: string, city = 'Seattle', openingHours: string | null = null) {
  fake.seed(`places/${id}`, {
    id,
    name: `Place ${id}`,
    city,
    latitude: 47.6,
    longitude: -122.3,
    category: 'cafe',
    openingHours,
    missingFields: openingHours === null ? ['openingHours'] : [],
    source: { provider: 'manual', providerId: null, retrievedAt: '2026-10-01T12:00:00Z' },
    updatedAt: '2026-10-01T12:00:00Z',
  });
}

function seedRec(
  id: string,
  placeId: string,
  createdAt: string,
  moderationStatus = 'active',
  authorId = 'u-maya',
) {
  fake.seed(`recommendations/${id}`, {
    id,
    authorId,
    placeId,
    description: `About ${placeId}`,
    tags: ['coffee'],
    visitDate: null,
    sourceLinks: [],
    moderationStatus,
    createdAt,
  });
}

async function rejectsWith(promise: Promise<unknown>, code: string) {
  await expect(promise).rejects.toBeInstanceOf(ApiError);
  await expect(promise).rejects.toMatchObject({ code });
}

beforeEach(() => {
  fake.reset();
  fake.uid = 'viewer';
  fake.seed('users/u-maya', { id: 'u-maya', name: 'Maya', bio: '', interests: [], createdAt: '' });
  seedPlace('p-cafe', 'Seattle', '07:00-17:00');
  seedPlace('p-park');
  seedPlace('p-pdx', 'Portland');
  seedRec('r1', 'p-cafe', '2026-10-01T12:00:00Z');
  seedRec('r2', 'p-cafe', '2026-10-03T12:00:00Z');
  seedRec('r-removed', 'p-cafe', '2026-10-04T12:00:00Z', 'removed');
  seedRec('r-hidden', 'p-park', '2026-10-05T12:00:00Z', 'hidden');
  seedRec('r-park', 'p-park', '2026-10-02T12:00:00Z', 'active', 'u-no-profile');
  seedRec('r-pdx', 'p-pdx', '2026-10-06T12:00:00Z');
});

describe('getPlace', () => {
  it('returns the place and its active recommendations, newest first', async () => {
    const { place, recommendations } = await getPlace({ placeId: 'p-cafe' });
    expect(place).toMatchObject({ id: 'p-cafe', openingHours: '07:00-17:00', missingFields: [] });
    expect(recommendations.map((r) => r.id)).toEqual(['r2', 'r1']);
    expect(recommendations[0]).toMatchObject({
      status: 'available',
      author: { id: 'u-maya', name: 'Maya' },
      place: { id: 'p-cafe' },
      tags: ['coffee'],
    });
  });
  it('keeps unknown opening hours as null, never closed', async () => {
    const { place } = await getPlace({ placeId: 'p-park' });
    expect(place.openingHours).toBeNull();
    expect(place.missingFields).toEqual(['openingHours']);
  });
  it('labels an author with no profile instead of failing', async () => {
    const { recommendations } = await getPlace({ placeId: 'p-park' });
    expect(recommendations.map((r) => [r.id, r.author?.name])).toEqual([
      ['r-park', UNKNOWN_AUTHOR_NAME],
    ]);
  });
  it('answers not-found for a place that is not in the catalog', async () => {
    await rejectsWith(getPlace({ placeId: 'nope' }), 'not-found');
  });
});

describe('getFeed', () => {
  it("returns the city's active recommendations, newest first", async () => {
    const { items } = await getFeed({ city: ' Seattle ' });
    expect(items.map((r) => r.id)).toEqual(['r2', 'r-park', 'r1']);
  });
  it('respects the limit', async () => {
    const { items } = await getFeed({ city: 'Seattle', limit: 2 });
    expect(items.map((r) => r.id)).toEqual(['r2', 'r-park']);
  });
  it('returns an empty feed for a city with no places', async () => {
    await expect(getFeed({ city: 'Tokyo' })).resolves.toEqual({ items: [] });
  });
  it('handles more places than one query can filter on (30)', async () => {
    for (let i = 0; i < 45; i += 1) {
      seedPlace(`bulk${i}`);
      seedRec(`bulk-r${i}`, `bulk${i}`, `2026-09-01T00:00:${String(i).padStart(2, '0')}Z`);
    }
    const { items } = await getFeed({ city: 'Seattle', limit: 50 });
    expect(items).toHaveLength(48);
  });
  it('rejects a missing city or a bad limit', async () => {
    await rejectsWith(getFeed({ city: '  ' }), 'invalid-argument');
    await rejectsWith(getFeed({ city: 'Seattle', limit: 0 }), 'invalid-argument');
  });
});
