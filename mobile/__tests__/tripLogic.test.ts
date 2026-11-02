import { describe, expect, it } from '@jest/globals';
import type { TripStop } from '@roami/shared';

import {
  isValidDate,
  planAddStop,
  planMoveStop,
  planRemoveStop,
  tripDayCount,
  validateNewTrip,
  validateStopDetails,
} from '../src/logic/trips';

const stop = (id: string, day: number, order: number, placeId = `p-${id}`): TripStop => ({
  id,
  tripId: 't1',
  placeId,
  title: null,
  recommendationIds: [],
  day,
  order,
  startTime: null,
  visitMinutes: 60,
  walkingMinutesFromPrevious: null,
  isFixed: false,
  isRequired: false,
  warnings: [],
});

const trip = {
  city: ' Seattle ',
  startDate: '2026-11-03',
  endDate: '2026-11-05',
  dailyWindow: { start: '09:00', end: '21:00' },
};

describe('dates', () => {
  it('accepts real dates only', () => {
    expect(isValidDate('2026-02-28')).toBe(true);
    expect(isValidDate('2026-02-30')).toBe(false);
    expect(isValidDate('2026-2-3')).toBe(false);
  });
  it('counts both the first and last day', () => {
    expect(tripDayCount('2026-11-03', '2026-11-03')).toBe(1);
    expect(tripDayCount('2026-11-03', '2026-11-09')).toBe(7);
    expect(tripDayCount('2027-03-13', '2027-03-15')).toBe(3); // across a time change
  });
});

describe('validateNewTrip', () => {
  it('accepts a valid trip and trims the city', () => {
    const result = validateNewTrip(trip);
    expect(result).toEqual({ ok: true, value: { ...trip, city: 'Seattle', startingPoints: [] } });
  });
  it.each([
    [{ city: '  ' }, 'Choose a city.'],
    [{ endDate: '2026-11-01' }, 'The end date is before the start date.'],
    [{ endDate: '2026-11-10' }, 'Trips can be at most 7 days.'],
    [{ startDate: '11/03/2026' }, 'Enter a valid start date.'],
    [{ dailyWindow: { start: '9am', end: '21:00' } }, 'Enter daily start and end times as HH:mm.'],
    [
      { dailyWindow: { start: '21:00', end: '09:00' } },
      'The daily end time must be after the start time.',
    ],
    [
      { startingPoints: [{ label: 'Hotel', latitude: 200, longitude: 0 }] },
      'A starting point has an invalid location.',
    ],
  ])('rejects %j', (patch, message) => {
    expect(validateNewTrip({ ...trip, ...patch })).toEqual({ ok: false, error: message });
  });
});

describe('validateStopDetails', () => {
  it('requires a whole number of visit minutes from 1 to 720', () => {
    expect(validateStopDetails({ visitMinutes: 90 }).ok).toBe(true);
    expect(validateStopDetails({ visitMinutes: 0 }).ok).toBe(false);
    expect(validateStopDetails({ visitMinutes: 12.5 }).ok).toBe(false);
    expect(validateStopDetails({ visitMinutes: 721 }).ok).toBe(false);
  });
});

describe('planAddStop', () => {
  const stops = [stop('a', 1, 1), stop('b', 1, 2), stop('c', 2, 1)];

  it('appends to the end of the day when no order is given', () => {
    const result = planAddStop(stops, 3, { id: 'new', placeId: 'p-new', day: 1 });
    expect(result).toEqual({
      ok: true,
      value: { position: { id: 'new', day: 1, order: 3 }, moved: [] },
    });
  });
  it('shifts later stops down when inserting at the front', () => {
    const result = planAddStop(stops, 3, { id: 'new', placeId: 'p-new', day: 1, order: 1 });
    expect(result).toEqual({
      ok: true,
      value: {
        position: { id: 'new', day: 1, order: 1 },
        moved: [
          { id: 'a', day: 1, order: 2 },
          { id: 'b', day: 1, order: 3 },
        ],
      },
    });
  });
  it('clamps an order past the end to the next free spot', () => {
    const result = planAddStop(stops, 3, { id: 'new', placeId: 'p-new', day: 2, order: 9 });
    expect(result.ok && result.value.position).toEqual({ id: 'new', day: 2, order: 2 });
  });
  it('refuses a sixth stop in one day', () => {
    const full = [1, 2, 3, 4, 5].map((n) => stop(`s${n}`, 1, n));
    expect(planAddStop(full, 3, { id: 'new', placeId: 'p-new', day: 1 })).toEqual({
      ok: false,
      error: 'Day 1 already has 5 stops.',
    });
  });
  it('refuses a day outside the trip', () => {
    expect(planAddStop(stops, 3, { id: 'new', placeId: 'p-new', day: 4 })).toEqual({
      ok: false,
      error: 'Choose a day from 1 to 3.',
    });
  });
  it('refuses scheduling the same place twice', () => {
    expect(planAddStop(stops, 3, { id: 'new', placeId: 'p-a', day: 3 }).ok).toBe(false);
  });
});

describe('planMoveStop', () => {
  const stops = [stop('a', 1, 1), stop('b', 1, 2), stop('c', 1, 3), stop('d', 2, 1)];

  it('reorders within a day', () => {
    expect(planMoveStop(stops, 3, { stopId: 'c', day: 1, order: 1 })).toEqual({
      ok: true,
      value: [
        { id: 'c', day: 1, order: 1 },
        { id: 'a', day: 1, order: 2 },
        { id: 'b', day: 1, order: 3 },
      ],
    });
  });
  it('moves to another day and closes the gap it leaves', () => {
    expect(planMoveStop(stops, 3, { stopId: 'a', day: 2, order: 1 })).toEqual({
      ok: true,
      value: [
        { id: 'a', day: 2, order: 1 },
        { id: 'd', day: 2, order: 2 },
        { id: 'b', day: 1, order: 1 },
        { id: 'c', day: 1, order: 2 },
      ],
    });
  });
  it('changes nothing when the stop is already there', () => {
    expect(planMoveStop(stops, 3, { stopId: 'b', day: 1, order: 2 })).toEqual({
      ok: true,
      value: [],
    });
  });
  it('refuses moving onto a full day', () => {
    const full = [...[1, 2, 3, 4, 5].map((n) => stop(`s${n}`, 2, n)), stop('x', 1, 1)];
    expect(planMoveStop(full, 3, { stopId: 'x', day: 2, order: 1 }).ok).toBe(false);
  });
  it('allows reordering within a full day', () => {
    const full = [1, 2, 3, 4, 5].map((n) => stop(`s${n}`, 2, n));
    expect(planMoveStop(full, 3, { stopId: 's5', day: 2, order: 1 }).ok).toBe(true);
  });
});

describe('planRemoveStop', () => {
  it('renumbers the rest of the day', () => {
    const stops = [stop('a', 1, 1), stop('b', 1, 2), stop('c', 1, 3), stop('d', 2, 1)];
    expect(planRemoveStop(stops, 'a')).toEqual({
      ok: true,
      value: [
        { id: 'b', day: 1, order: 1 },
        { id: 'c', day: 1, order: 2 },
      ],
    });
  });
});
