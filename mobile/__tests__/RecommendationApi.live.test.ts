// Verifies the registered live API route for createRecommendation end to end
// through callApi, using the repository's in-memory Firestore test double.
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('firebase/firestore', () => require('../test-utils/fakeFirestore').firestoreModule);
jest.mock('../src/repositories/firestore', () => ({ db: {} }));
jest.mock('../src/auth/AuthService', () => ({
  getCurrentUserId: () => require('../test-utils/fakeFirestore').fake.uid,
}));

beforeEach(() => {
  jest.resetModules();
  process.env.EXPO_PUBLIC_API_MODE = 'live';
});

describe('registered live createRecommendation API', () => {
  it('routes callApi to RecommendationService instead of its fixture', async () => {
    const { fake } =
      require('../test-utils/fakeFirestore') as typeof import('../test-utils/fakeFirestore');
    fake.reset();
    fake.uid = 'alice';
    fake.seed('users/alice', {
      id: 'alice',
      name: 'Alice',
      bio: '',
      interests: [],
      createdAt: '2026-10-01T12:00:00Z',
    });
    fake.seed('places/p-cafe', {
      id: 'p-cafe',
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

    const { registerServices } = require('../src/services') as typeof import('../src/services');
    const { callApi, getApiMode } = require('../src/api') as typeof import('../src/api');
    registerServices();

    expect(getApiMode()).toBe('live');
    const response = await callApi('createRecommendation', {
      placeId: 'p-cafe',
      description: 'Great espresso.',
      tags: ['coffee'],
    });
    expect(response.recommendation).toMatchObject({
      status: 'available',
      author: { id: 'alice', name: 'Alice' },
      place: { id: 'p-cafe' },
      description: 'Great espresso.',
    });
    expect(fake.all('recommendations')).toHaveLength(1);
  });
});
