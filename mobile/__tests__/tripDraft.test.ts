import { expect, it } from '@jest/globals';

import { tripDays, validateTripDraft, type TripDraft } from '../src/trips/tripDraft';

const draft: TripDraft = { city: 'Seattle', startDate: '2026-11-01', endDate: '2026-11-03', dayStart: '09:00', dayEnd: '21:00' };

it('counts inclusive days across daylight saving and year boundaries', () => {
  expect(tripDays('2026-11-01', '2026-11-03')).toBe(3);
  expect(tripDays('2026-12-31', '2027-01-01')).toBe(2);
  expect(tripDays('2026-11-01', '2026-11-01')).toBe(1);
});

it('rejects invalid dates and a return date before departure', () => {
  expect(validateTripDraft({ ...draft, startDate: '2026-02-30' })).toContain('Choose your departure');
  expect(validateTripDraft({ ...draft, endDate: '2026-10-31' })).toContain('return date must be');
});

it('requires valid 24-hour times', () => {
  expect(validateTripDraft({ ...draft, dayStart: '25:00' })).toContain('24-hour time');
  expect(validateTripDraft(draft)).toBeNull();
});
