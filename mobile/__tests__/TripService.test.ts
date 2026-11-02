// Runs the real trip services and repositories against an in-memory Firestore
// that mimics the security rules (test-utils/fakeFirestore.ts).
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { TripView } from '@roami/shared';

import { ApiError } from '../src/api';
import { addStop, moveStop, removeStop } from '../src/services/RevisionService';
import {
  addCandidate,
  createTrip,
  getTrip,
  listTrips,
  removeCandidate,
} from '../src/services/TripService';
import { fake } from '../test-utils/fakeFirestore';

jest.mock('firebase/firestore', () => require('../test-utils/fakeFirestore').firestoreModule);
jest.mock('../src/repositories/firestore', () => ({ db: {} }));
jest.mock('../src/auth/AuthService', () => ({
  getCurrentUserId: () => require('../test-utils/fakeFirestore').fake.uid,
}));

const NEW_TRIP = {
  city: 'Seattle',
  startDate: '2026-11-03',
  endDate: '2026-11-05',
  dailyWindow: { start: '09:00', end: '21:00' },
};

const place = (id: string, name: string) => ({
  id,
  name,
  city: 'Seattle',
  latitude: 47.6,
  longitude: -122.3,
  category: 'cafe',
  openingHours: null,
  missingFields: ['openingHours'],
  source: { provider: 'manual', providerId: null, retrievedAt: '2026-10-01T12:00:00Z' },
  updatedAt: '2026-10-01T12:00:00Z',
});

async function rejectsWith(promise: Promise<unknown>, code: string) {
  await expect(promise).rejects.toBeInstanceOf(ApiError);
  await expect(promise).rejects.toMatchObject({ code });
}

/** Creates a trip as alice with places p1..p7 in the catalog. */
async function aliceTrip(): Promise<TripView> {
  fake.uid = 'alice';
  return (await createTrip(NEW_TRIP)).trip;
}

beforeEach(() => {
  fake.reset();
  for (let i = 1; i <= 7; i += 1) fake.seed(`places/p${i}`, place(`p${i}`, `Place ${i}`));
});

describe('createTrip', () => {
  it('saves a trip at revision 1 owned by the signed-in user', async () => {
    const view = await aliceTrip();
    expect(view.trip).toMatchObject({ ownerId: 'alice', city: 'Seattle', revision: 1 });
    expect(view.candidates).toEqual([]);
    expect(view.stops).toEqual([]);
    expect(fake.get(`trips/${view.trip.id}`)).toEqual(view.trip);
  });
  it('refuses invalid dates without saving anything', async () => {
    fake.uid = 'alice';
    await rejectsWith(createTrip({ ...NEW_TRIP, endDate: '2026-11-01' }), 'invalid-argument');
    expect(fake.all('trips')).toEqual([]);
  });
  it('requires sign-in', async () => {
    await rejectsWith(createTrip(NEW_TRIP), 'unauthenticated');
  });
});

describe('listTrips and getTrip', () => {
  it('lists only your own trips, with counts', async () => {
    const view = await aliceTrip();
    await addCandidate({ tripId: view.trip.id, placeId: 'p1' });
    await addStop({
      tripId: view.trip.id,
      expectedRevision: 2,
      placeId: 'p2',
      day: 1,
      visitMinutes: 60,
    });
    fake.uid = 'bob';
    await createTrip({ ...NEW_TRIP, city: 'Portland' });

    fake.uid = 'alice';
    const { trips } = await listTrips({});
    expect(trips).toEqual([
      {
        id: view.trip.id,
        city: 'Seattle',
        startDate: '2026-11-03',
        endDate: '2026-11-05',
        candidateCount: 1,
        stopCount: 1,
      },
    ]);
  });
  it("answers not-found for a missing trip and for someone else's trip", async () => {
    const view = await aliceTrip();
    fake.uid = 'carol';
    await rejectsWith(getTrip({ tripId: view.trip.id }), 'not-found');
    await rejectsWith(getTrip({ tripId: 'no-such-trip' }), 'not-found');
  });
  it('lets a viewer the trip was shared with read it', async () => {
    const view = await aliceTrip();
    fake.seed(`tripShares/${view.trip.id}`, { tripId: view.trip.id, viewerIds: ['bob'] });
    fake.uid = 'bob';
    await expect(getTrip({ tripId: view.trip.id })).resolves.toMatchObject({
      trip: { trip: { id: view.trip.id } },
    });
  });
});

describe('candidates', () => {
  it('adds a candidate, raising the revision, and ignores a repeat', async () => {
    const view = await aliceTrip();
    const added = await addCandidate({ tripId: view.trip.id, placeId: 'p1' });
    expect(added.trip.trip.revision).toBe(2);
    expect(added.trip.candidates.map((p) => p.name)).toEqual(['Place 1']);

    const again = await addCandidate({ tripId: view.trip.id, placeId: 'p1' });
    expect(again.trip.trip.revision).toBe(2);
    expect(again.trip.trip.candidatePlaceIds).toEqual(['p1']);
  });
  it('refuses a place that is not in the catalog', async () => {
    const view = await aliceTrip();
    await rejectsWith(addCandidate({ tripId: view.trip.id, placeId: 'nope' }), 'not-found');
    expect(fake.get(`trips/${view.trip.id}`)?.revision).toBe(1);
  });
  it('removes a candidate', async () => {
    const view = await aliceTrip();
    await addCandidate({ tripId: view.trip.id, placeId: 'p1' });
    const removed = await removeCandidate({ tripId: view.trip.id, placeId: 'p1' });
    expect(removed.trip.candidates).toEqual([]);
    expect(removed.trip.trip.revision).toBe(3);
  });
  it("refuses changes to someone else's trip", async () => {
    const view = await aliceTrip();
    fake.seed(`tripShares/${view.trip.id}`, { tripId: view.trip.id, viewerIds: ['bob'] });
    fake.uid = 'bob';
    await rejectsWith(addCandidate({ tripId: view.trip.id, placeId: 'p1' }), 'permission-denied');
  });
  it('shows a scheduled candidate as a stop, not a candidate', async () => {
    const view = await aliceTrip();
    await addCandidate({ tripId: view.trip.id, placeId: 'p1' });
    const { trip } = await addStop({
      tripId: view.trip.id,
      expectedRevision: 2,
      placeId: 'p1',
      day: 1,
      visitMinutes: 45,
    });
    expect(trip.candidates).toEqual([]);
    expect(trip.stops.map((s) => s.place?.name)).toEqual(['Place 1']);

    const afterRemove = await removeStop({
      tripId: view.trip.id,
      expectedRevision: 3,
      stopId: trip.stops[0].id,
    });
    expect(afterRemove.trip.candidates.map((p) => p.id)).toEqual(['p1']);
  });
});

describe('stops (revision service)', () => {
  async function tripWithStops(placeIds: string[], day = 1) {
    const view = await aliceTrip();
    let current = view;
    for (const placeId of placeIds) {
      current = (
        await addStop({
          tripId: view.trip.id,
          expectedRevision: current.trip.revision,
          placeId,
          day,
          visitMinutes: 60,
        })
      ).trip;
    }
    return current;
  }

  it('adds stops in order, raising the revision each time', async () => {
    const trip = await tripWithStops(['p1', 'p2', 'p3']);
    expect(trip.trip.revision).toBe(4);
    expect(trip.stops.map((s) => [s.place?.id, s.day, s.order])).toEqual([
      ['p1', 1, 1],
      ['p2', 1, 2],
      ['p3', 1, 3],
    ]);
    expect(trip.stops[0].walkingMinutesFromPrevious).toBeNull();
  });
  it('inserts at the front and shifts the others', async () => {
    const trip = await tripWithStops(['p1', 'p2']);
    const { trip: after } = await addStop({
      tripId: trip.trip.id,
      expectedRevision: trip.trip.revision,
      placeId: 'p3',
      day: 1,
      order: 1,
      visitMinutes: 30,
    });
    expect(after.stops.map((s) => s.placeId)).toEqual(['p3', 'p1', 'p2']);
    expect(after.stops.map((s) => s.order)).toEqual([1, 2, 3]);
  });
  it('refuses a stale edit and changes nothing', async () => {
    const trip = await tripWithStops(['p1']);
    const before = fake.all('tripStops');
    await rejectsWith(
      addStop({
        tripId: trip.trip.id,
        expectedRevision: 1,
        placeId: 'p2',
        day: 1,
        visitMinutes: 60,
      }),
      'aborted',
    );
    expect(fake.all('tripStops')).toEqual(before);
    expect(fake.get(`trips/${trip.trip.id}`)?.revision).toBe(2);
  });
  it('refuses a sixth stop in a day', async () => {
    const trip = await tripWithStops(['p1', 'p2', 'p3', 'p4', 'p5']);
    await rejectsWith(
      addStop({
        tripId: trip.trip.id,
        expectedRevision: trip.trip.revision,
        placeId: 'p6',
        day: 1,
        visitMinutes: 60,
      }),
      'invalid-argument',
    );
  });
  it('refuses a day after the trip ends and a place not in the catalog', async () => {
    const trip = await tripWithStops([]);
    const base = { tripId: trip.trip.id, expectedRevision: 1, visitMinutes: 60 };
    await rejectsWith(addStop({ ...base, placeId: 'p1', day: 4 }), 'invalid-argument');
    await rejectsWith(addStop({ ...base, placeId: 'nope', day: 1 }), 'not-found');
    expect(fake.all('tripStops')).toEqual([]);
  });
  it('moves a stop to another day and renumbers both days', async () => {
    const trip = await tripWithStops(['p1', 'p2', 'p3']);
    const moving = trip.stops[0];
    const { trip: after } = await moveStop({
      tripId: trip.trip.id,
      expectedRevision: trip.trip.revision,
      stopId: moving.id,
      day: 2,
      order: 1,
    });
    expect(after.trip.revision).toBe(trip.trip.revision + 1);
    expect(after.stops.map((s) => [s.placeId, s.day, s.order])).toEqual([
      ['p2', 1, 1],
      ['p3', 1, 2],
      ['p1', 2, 1],
    ]);
  });
  it('keeps the revision when a move changes nothing', async () => {
    const trip = await tripWithStops(['p1', 'p2']);
    const { trip: after } = await moveStop({
      tripId: trip.trip.id,
      expectedRevision: trip.trip.revision,
      stopId: trip.stops[1].id,
      day: 1,
      order: 2,
    });
    expect(after.trip.revision).toBe(trip.trip.revision);
  });
  it('removes a stop and closes the gap', async () => {
    const trip = await tripWithStops(['p1', 'p2', 'p3']);
    const { trip: after } = await removeStop({
      tripId: trip.trip.id,
      expectedRevision: trip.trip.revision,
      stopId: trip.stops[1].id,
    });
    expect(after.stops.map((s) => [s.placeId, s.order])).toEqual([
      ['p1', 1],
      ['p3', 2],
    ]);
    expect(fake.all('tripStops')).toHaveLength(2);
  });
  it('answers not-found for a stop that is not in the trip', async () => {
    const trip = await tripWithStops(['p1']);
    await rejectsWith(
      removeStop({ tripId: trip.trip.id, expectedRevision: trip.trip.revision, stopId: 'gone' }),
      'not-found',
    );
  });
  it("refuses stop changes on someone else's trip", async () => {
    const trip = await tripWithStops(['p1']);
    fake.seed(`tripShares/${trip.trip.id}`, { tripId: trip.trip.id, viewerIds: ['bob'] });
    fake.uid = 'bob';
    await rejectsWith(
      removeStop({
        tripId: trip.trip.id,
        expectedRevision: trip.trip.revision,
        stopId: trip.stops[0].id,
      }),
      'permission-denied',
    );
  });
  it('fills a 3-day trip to the limit in one go', async () => {
    const view = await aliceTrip();
    for (let i = 8; i <= 16; i += 1) fake.seed(`places/p${i}`, place(`p${i}`, `Place ${i}`));
    let current = view;
    for (let i = 0; i < 15; i += 1) {
      current = (
        await addStop({
          tripId: view.trip.id,
          expectedRevision: current.trip.revision,
          placeId: `p${i + 1}`,
          day: 1 + Math.floor(i / 5),
          visitMinutes: 30,
        })
      ).trip;
    }
    expect(current.stops).toHaveLength(15);
    expect(current.trip.revision).toBe(16);
  });
});
