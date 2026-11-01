import { beforeEach, describe, expect, it } from '@jest/globals';

import { callApi, resetFixtures } from '../src/api';

beforeEach(() => {
  resetFixtures();
});

describe('fixture ApiClient', () => {
  it('finds jazz places and skips one that no longer has jazz', async () => {
    const { results } = await callApi('searchRecommendations', {
      text: '',
      interests: ['jazz'],
      city: 'Seattle',
    });
    const ids = results.map((r) => r.recommendation.id);
    expect(ids).toContain('r1');
    expect(ids).toContain('r8');
    expect(ids).not.toContain('r4');
  });

  it('keeps one saved entry per place and keeps the note', async () => {
    await callApi('savePlace', { placeId: 'p-jazz', recommendationId: 'r1' });
    await callApi('updateSavedNote', { placeId: 'p-jazz', personalNote: 'Friday?' });
    await callApi('savePlace', { placeId: 'p-jazz', recommendationId: 'r8' });
    const { saved } = await callApi('listSavedPlaces', {});
    expect(saved).toHaveLength(1);
    expect(saved[0].personalNote).toBe('Friday?');
    expect(saved[0].recommendations).toHaveLength(2);
  });

  it('refuses a stale trip edit and changes nothing', async () => {
    const { trip } = await callApi('createTrip', {
      city: 'Seattle',
      startDate: '2026-11-01',
      endDate: '2026-11-02',
      dailyWindow: { start: '09:00', end: '21:00' },
    });
    const first = await callApi('addStop', {
      tripId: trip.trip.id,
      expectedRevision: 1,
      placeId: 'p-pike',
      day: 1,
      visitMinutes: 60,
    });
    expect(first.trip.trip.revision).toBe(2);
    await expect(
      callApi('addStop', {
        tripId: trip.trip.id,
        expectedRevision: 1,
        placeId: 'p-sam',
        day: 1,
        visitMinutes: 60,
      }),
    ).rejects.toMatchObject({ code: 'aborted' });
    const after = await callApi('getTrip', { tripId: trip.trip.id });
    expect(after.trip.stops).toHaveLength(1);
  });
});
