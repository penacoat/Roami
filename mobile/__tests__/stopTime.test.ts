import { expect, it } from '@jest/globals';
import {
  MIDNIGHT,
  formatMinutes,
  formatTimeRange,
  rangeFromMinutes,
  stopRange,
} from '../src/trips/stopTime';

it('shows times and ranges in 12-hour time', () => {
  expect(formatMinutes(0)).toBe('12:00am');
  expect(formatMinutes(12 * 60 + 5)).toBe('12:05pm');
  expect(formatMinutes(MIDNIGHT)).toBe('12:00am');
  expect(formatTimeRange('13:00', 60)).toBe('1:00pm – 2:00pm');
  expect(formatTimeRange('11:30', 45)).toBe('11:30am – 12:15pm');
  expect(formatTimeRange('23:00', 60)).toBe('11:00pm – 12:00am');
});

it('reads a stop as a start and end, with noon to 1pm for an untimed stop', () => {
  expect(stopRange({ startTime: '13:00', visitMinutes: 90 })).toEqual({ start: 780, end: 870 });
  expect(stopRange({ startTime: null, visitMinutes: 60 })).toEqual({ start: 720, end: 780 });
});

it('turns a picked start and end into a start time and length', () => {
  expect(rangeFromMinutes(780, 870)).toEqual({ ok: true, startTime: '13:00', visitMinutes: 90 });
  expect(rangeFromMinutes(23 * 60, MIDNIGHT)).toEqual({
    ok: true,
    startTime: '23:00',
    visitMinutes: 60,
  });
  expect(rangeFromMinutes(840, 780)).toMatchObject({
    ok: false,
    error: 'The end time must be after the start time.',
  });
  expect(rangeFromMinutes(6 * 60, 19 * 60)).toMatchObject({
    ok: false,
    error: 'A visit can be at most 12 hours.',
  });
});
