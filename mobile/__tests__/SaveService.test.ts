// Saved places against an in-memory Firestore that mimics the security rules
// (test-utils/fakeFirestore.ts).
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { ApiError } from '../src/api';
import {
  listSavedPlaces,
  removeSavedPlace,
  savePlace,
  updateSavedNote,
} from '../src/services/SaveService';
import { fake } from '../test-utils/fakeFirestore';

jest.mock('firebase/firestore', () => require('../test-utils/fakeFirestore').firestoreModule);
jest.mock('../src/repositories/firestore', () => ({ db: {} }));
jest.mock('../src/auth/AuthService', () => ({
  getCurrentUserId: () => require('../test-utils/fakeFirestore').fake.uid,
}));

function seedPlace(id: string) {
  fake.seed(`places/${id}`, {
    id,
    name: `Place ${id}`,
    city: 'Seattle',
    latitude: 47.6,
    longitude: -122.3,
    category: 'museum',
    openingHours: null,
    missingFields: ['openingHours'],
    source: { provider: 'manual', providerId: null, retrievedAt: '2026-10-01T12:00:00Z' },
    updatedAt: '2026-10-01T12:00:00Z',
  });
}

function seedRec(id: string, placeId: string, moderationStatus = 'active') {
  fake.seed(`recommendations/${id}`, {
    id,
    authorId: 'u-maya',
    placeId,
    description: `About ${placeId}`,
    tags: ['art'],
    visitDate: null,
    sourceLinks: [],
    moderationStatus,
    createdAt: '2026-10-01T12:00:00Z',
  });
}

async function rejectsWith(promise: Promise<unknown>, code: string) {
  await expect(promise).rejects.toBeInstanceOf(ApiError);
  await expect(promise).rejects.toMatchObject({ code });
}

beforeEach(() => {
  fake.reset();
  fake.uid = 'alice';
  fake.seed('users/u-maya', { id: 'u-maya', name: 'Maya', bio: '', interests: [], createdAt: '' });
  seedPlace('p-sam');
  seedPlace('p-park');
  seedRec('r5', 'p-sam');
  seedRec('r7', 'p-sam');
  seedRec('r-park', 'p-park');
  seedRec('r-removed', 'p-sam', 'removed');
});

describe('savePlace', () => {
  it('creates one saved entry with the recommendation that led to it', async () => {
    const { saved } = await savePlace({ placeId: 'p-sam', recommendationId: 'r5' });
    expect(saved.place.id).toBe('p-sam');
    expect(saved.recommendations.map((r) => [r.id, r.status, r.author?.name])).toEqual([
      ['r5', 'available', 'Maya'],
    ]);
    expect(saved.personalNote).toBe('');
    expect(fake.get('savedPlaces/alice_p-sam')).toMatchObject({
      userId: 'alice',
      placeId: 'p-sam',
      recommendationIds: ['r5'],
    });
  });
  it('attaches another recommendation to the same entry and keeps the note', async () => {
    await savePlace({ placeId: 'p-sam', recommendationId: 'r5' });
    await updateSavedNote({ placeId: 'p-sam', personalNote: 'See the glass room' });
    const { saved } = await savePlace({ placeId: 'p-sam', recommendationId: 'r7' });
    expect(saved.recommendations.map((r) => r.id)).toEqual(['r5', 'r7']);
    expect(saved.personalNote).toBe('See the glass room');
    expect(fake.all('savedPlaces')).toHaveLength(1);
  });
  it('does not attach the same recommendation twice', async () => {
    await savePlace({ placeId: 'p-sam', recommendationId: 'r5' });
    const { saved } = await savePlace({ placeId: 'p-sam', recommendationId: 'r5' });
    expect(saved.recommendations.map((r) => r.id)).toEqual(['r5']);
  });
  it('saves a place without a recommendation', async () => {
    const { saved } = await savePlace({ placeId: 'p-park' });
    expect(saved.recommendations).toEqual([]);
  });
  it('refuses a place not in the catalog, a removed recommendation, and a mismatched one', async () => {
    await rejectsWith(savePlace({ placeId: 'nope' }), 'not-found');
    await rejectsWith(savePlace({ placeId: 'p-sam', recommendationId: 'r-removed' }), 'not-found');
    await rejectsWith(
      savePlace({ placeId: 'p-sam', recommendationId: 'r-park' }),
      'invalid-argument',
    );
    expect(fake.all('savedPlaces')).toEqual([]);
  });
  it('refuses your own removed recommendation, which the rules still let you read', async () => {
    fake.seed('recommendations/r-mine', {
      id: 'r-mine',
      authorId: 'alice',
      placeId: 'p-sam',
      description: 'Mine',
      tags: [],
      visitDate: null,
      sourceLinks: [],
      moderationStatus: 'removed',
      createdAt: '2026-10-01T12:00:00Z',
    });
    await rejectsWith(savePlace({ placeId: 'p-sam', recommendationId: 'r-mine' }), 'not-found');
  });
  it('requires sign-in', async () => {
    fake.uid = null;
    await rejectsWith(savePlace({ placeId: 'p-sam' }), 'unauthenticated');
  });
});

describe('listSavedPlaces', () => {
  it("lists only your own saves, and not other users'", async () => {
    await savePlace({ placeId: 'p-sam', recommendationId: 'r5' });
    fake.uid = 'bob';
    await savePlace({ placeId: 'p-park' });
    const { saved } = await listSavedPlaces({});
    expect(saved.map((s) => s.place.id)).toEqual(['p-park']);
  });
  it('shows a recommendation removed after saving as unavailable, keeping the save', async () => {
    await savePlace({ placeId: 'p-sam', recommendationId: 'r5' });
    await savePlace({ placeId: 'p-sam', recommendationId: 'r7' });
    await updateSavedNote({ placeId: 'p-sam', personalNote: 'Go Thursday' });
    seedRec('r5', 'p-sam', 'removed');

    const { saved } = await listSavedPlaces({});
    expect(saved).toHaveLength(1);
    expect(saved[0].personalNote).toBe('Go Thursday');
    expect(saved[0].recommendations.map((r) => [r.id, r.status])).toEqual([
      ['r5', 'unavailable'],
      ['r7', 'available'],
    ]);
    expect(saved[0].recommendations[0]).toMatchObject({ author: null, description: '', tags: [] });
  });
});

describe('updateSavedNote', () => {
  it('saves the note', async () => {
    await savePlace({ placeId: 'p-sam' });
    const { saved } = await updateSavedNote({ placeId: 'p-sam', personalNote: '  Go early ' });
    expect(saved.personalNote).toBe('Go early');
  });
  it('refuses a place that is not saved and a note that is too long', async () => {
    await rejectsWith(updateSavedNote({ placeId: 'p-sam', personalNote: 'x' }), 'not-found');
    await savePlace({ placeId: 'p-sam' });
    await rejectsWith(
      updateSavedNote({ placeId: 'p-sam', personalNote: 'x'.repeat(2001) }),
      'invalid-argument',
    );
  });
});

describe('removeSavedPlace', () => {
  it('removes the save, and succeeds if it was not saved', async () => {
    await savePlace({ placeId: 'p-sam' });
    await expect(removeSavedPlace({ placeId: 'p-sam' })).resolves.toEqual({ removed: true });
    expect(fake.all('savedPlaces')).toEqual([]);
    await expect(removeSavedPlace({ placeId: 'p-sam' })).resolves.toEqual({ removed: true });
  });
});
