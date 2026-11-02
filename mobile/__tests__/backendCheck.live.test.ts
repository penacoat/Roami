// Runs the dev backend check through the real services (as live mode does),
// against the in-memory Firestore that mimics the security rules.
import { beforeEach, expect, it, jest } from '@jest/globals';

import { runBackendCheck } from '../src/dev/backendCheck';
import { fake } from '../test-utils/fakeFirestore';

jest.mock('firebase/firestore', () => require('../test-utils/fakeFirestore').firestoreModule);
jest.mock('../src/repositories/firestore', () => ({ db: {} }));
jest.mock('../src/auth/AuthService', () => {
  const { fake: f } = require('../test-utils/fakeFirestore');
  return {
    getCurrentUserId: () => f.uid,
    getCurrentUser: () => (f.uid ? { uid: f.uid, email: null, displayName: 'Alice' } : null),
  };
});
// Send callApi straight to the real services, the way live mode does.
jest.mock('../src/api', () => {
  const actual = jest.requireActual<typeof import('../src/api')>('../src/api');
  return {
    ...actual,
    callApi: (name: string, request: unknown) => {
      const services = {
        ...jest.requireActual<Record<string, unknown>>('../src/services/ProfileService'),
        ...jest.requireActual<Record<string, unknown>>('../src/services/PlaceService'),
        ...jest.requireActual<Record<string, unknown>>('../src/services/DiscoveryService'),
        ...jest.requireActual<Record<string, unknown>>('../src/services/SearchService'),
        ...jest.requireActual<Record<string, unknown>>('../src/services/TripService'),
        ...jest.requireActual<Record<string, unknown>>('../src/services/RevisionService'),
      } as Record<string, (r: unknown) => Promise<unknown>>;
      return services[name](request);
    },
  };
});

beforeEach(() => {
  fake.reset();
  fake.uid = 'alice';
  fake.seed('users/u-maya', { id: 'u-maya', name: 'Maya', bio: '', interests: [], createdAt: '' });
  for (const id of ['p-a', 'p-b', 'p-c']) {
    fake.seed(`places/${id}`, {
      id,
      name: `Place ${id}`,
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
  fake.seed('recommendations/r1', {
    id: 'r1',
    authorId: 'u-maya',
    placeId: 'p-a',
    description: 'Great coffee, and a jazz trio on Fridays.',
    tags: ['coffee'],
    visitDate: null,
    sourceLinks: [],
    moderationStatus: 'active',
    createdAt: '2026-10-01T12:00:00Z',
  });
});

it('passes every step through the real services', async () => {
  const lines = await runBackendCheck();
  expect(lines.filter((l) => !l.ok)).toEqual([]);
  expect(lines.map((l) => l.text)).toEqual(
    expect.arrayContaining([
      'ensureProfile: Alice (created)',
      'getPlace: Place p-a, 1 recommendations',
      'searchRecommendations: 1 exact, 0 broader, first matched "jazz" (exact)',
      'stale edit: refused with "aborted", as expected',
      'All steps passed.',
    ]),
  );
});
