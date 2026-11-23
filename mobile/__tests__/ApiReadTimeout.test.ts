import { afterEach, expect, it, jest } from '@jest/globals';
import { callApi, READ_TIMEOUT_MS } from '../src/api/ApiClient';
import { fixtureHandlers } from '../src/api/fixtureHandlers';

afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});

it('releases a stalled read and does not deliver its late response', async () => {
  jest.useFakeTimers();
  let resolve!: (value: { places: [] }) => void;
  jest.spyOn(fixtureHandlers, 'listPlaces').mockImplementation(
    () =>
      new Promise((yes) => {
        resolve = yes;
      }),
  );
  const success = jest.fn();
  const failure = jest.fn();
  const request = callApi('listPlaces', { city: 'Seattle' }).then(success, failure);
  await jest.advanceTimersByTimeAsync(READ_TIMEOUT_MS);
  await request;
  expect(failure).toHaveBeenCalledWith(expect.objectContaining({ code: 'unavailable' }));
  resolve({ places: [] });
  await Promise.resolve();
  expect(success).not.toHaveBeenCalled();
  expect(jest.getTimerCount()).toBe(0);
});

it('does not report a slow write as failed while it could still commit', async () => {
  jest.useFakeTimers();
  let resolve!: (value: { deleted: true }) => void;
  jest.spyOn(fixtureHandlers, 'deleteTrip').mockImplementation(
    () =>
      new Promise((yes) => {
        resolve = yes;
      }),
  );
  const success = jest.fn();
  const failure = jest.fn();
  const request = callApi('deleteTrip', { tripId: 'trip', expectedRevision: 1 }).then(
    success,
    failure,
  );
  await jest.advanceTimersByTimeAsync(READ_TIMEOUT_MS * 2);
  expect(failure).not.toHaveBeenCalled();
  expect(success).not.toHaveBeenCalled();
  resolve({ deleted: true });
  await request;
  expect(success).toHaveBeenCalledWith({ deleted: true });
});

it('lets a first city import finish after the ordinary refresh timeout', async () => {
  jest.useFakeTimers();
  let resolve!: (value: { places: [] }) => void;
  jest.spyOn(fixtureHandlers, 'listPlaces').mockImplementation(
    () =>
      new Promise((yes) => {
        resolve = yes;
      }),
  );
  const success = jest.fn();
  const failure = jest.fn();
  const pending = callApi(
    'listPlaces',
    { city: 'Portland', cityId: 'osm-relation-186579' },
    { timeoutMs: 20000 },
  ).then(success, failure);
  await jest.advanceTimersByTimeAsync(READ_TIMEOUT_MS + 1);
  expect(failure).not.toHaveBeenCalled();
  resolve({ places: [] });
  await pending;
  expect(success).toHaveBeenCalledWith({ places: [] });
  expect(jest.getTimerCount()).toBe(0);
});
