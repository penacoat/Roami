// Recommendation creation against an in-memory Firestore that mimics its rules.
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { CreateRecommendationRequest } from '@roami/shared';

import { ApiError } from '../src/api';
import * as recommendationRepository from '../src/repositories/RecommendationRepository';
import { createRecommendation } from '../src/services/RecommendationService';
import { fake } from '../test-utils/fakeFirestore';

jest.mock('firebase/firestore', () => require('../test-utils/fakeFirestore').firestoreModule);
jest.mock('../src/repositories/firestore', () => ({ db: {} }));
jest.mock('../src/auth/AuthService', () => ({
  getCurrentUserId: () => require('../test-utils/fakeFirestore').fake.uid,
}));

const request: CreateRecommendationRequest = {
  placeId: 'p-cafe',
  description: '  A quiet cafe with excellent coffee. ',
  tags: ['coffee', 'quiet'],
  visitDate: '2026-10-30',
  sourceLinks: ['https://example.com/post'],
};

function seedPlace(id: string) {
  fake.seed(`places/${id}`, {
    id,
    name: 'Cafe',
    city: 'Seattle',
    latitude: 47.6,
    longitude: -122.3,
    category: 'cafe',
    openingHours: null,
    missingFields: ['openingHours'],
    source: { provider: 'manual', providerId: null, retrievedAt: '2026-10-01T12:00:00Z' },
    updatedAt: '2026-10-01T12:00:00Z',
  });
}

async function rejectsWith(promise: Promise<unknown>, code: string) {
  await expect(promise).rejects.toBeInstanceOf(ApiError);
  await expect(promise).rejects.toMatchObject({ code });
}

beforeEach(() => {
  jest.restoreAllMocks();
  fake.reset();
  fake.uid = 'alice';
  fake.seed('users/alice', {
    id: 'alice',
    name: 'Alice',
    bio: '',
    interests: [],
    createdAt: '2026-10-01T12:00:00Z',
  });
  seedPlace('p-cafe');
});

describe('createRecommendation', () => {
  it('creates an active recommendation and returns the contract view', async () => {
    const { recommendation } = await createRecommendation(request);

    expect(recommendation).toMatchObject({
      status: 'available',
      place: { id: 'p-cafe', name: 'Cafe' },
      author: { id: 'alice', name: 'Alice' },
      description: 'A quiet cafe with excellent coffee.',
      tags: ['coffee', 'quiet'],
      visitDate: '2026-10-30',
      sourceLinks: ['https://example.com/post'],
    });
    expect(recommendation.id).toBeTruthy();
    expect(recommendation.createdAt).toMatch(/^\d{4}-\d\d-\d\dT/);
    expect(fake.get(`recommendations/${recommendation.id}`)).toMatchObject({
      id: recommendation.id,
      authorId: 'alice',
      placeId: 'p-cafe',
      moderationStatus: 'active',
    });
    expect(Object.keys(fake.get(`recommendations/${recommendation.id}`) ?? {}).sort()).toEqual(
      [
        'authorId',
        'createdAt',
        'description',
        'id',
        'moderationStatus',
        'placeId',
        'sourceLinks',
        'tags',
        'visitDate',
      ].sort(),
    );
  });

  it('rejects whitespace-only descriptions and malformed requests', async () => {
    await rejectsWith(
      createRecommendation({ ...request, description: ' \t ' }),
      'invalid-argument',
    );
    await rejectsWith(
      createRecommendation({
        ...request,
        tags: ['coffee', 2],
      } as unknown as CreateRecommendationRequest),
      'invalid-argument',
    );
    expect(fake.all('recommendations')).toEqual([]);
  });

  it('requires authentication', async () => {
    fake.uid = null;
    await rejectsWith(createRecommendation(request), 'unauthenticated');
    expect(fake.all('recommendations')).toEqual([]);
  });

  it('rejects a place that is not in the catalog', async () => {
    await rejectsWith(createRecommendation({ ...request, placeId: 'missing' }), 'not-found');
    expect(fake.all('recommendations')).toEqual([]);
  });

  it('does not allow a caller to spoof the author ID', async () => {
    await rejectsWith(
      createRecommendation({
        ...request,
        authorId: 'bob',
      } as unknown as CreateRecommendationRequest),
      'invalid-argument',
    );
    expect(fake.all('recommendations')).toEqual([]);
  });

  it('maps Firestore permission errors to ApiError', async () => {
    const permissionDenied = Object.assign(new Error('Rules rejected the write.'), {
      code: 'permission-denied',
    });
    jest
      .spyOn(recommendationRepository, 'createRecommendation')
      .mockRejectedValue(permissionDenied);

    await rejectsWith(createRecommendation(request), 'permission-denied');
  });
});
