import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

import {
  OsmUnavailableError,
  fetchOverpass,
  resetOsmClient,
  searchCities,
} from '../src/repositories/OsmRepository';

const fetchMock = jest.fn<typeof fetch>();
const answer = (body: unknown, status = 200) =>
  ({ ok: status >= 200 && status < 300, status, json: async () => body }) as Response;

beforeEach(() => {
  resetOsmClient();
  fetchMock.mockReset();
  globalThis.fetch = fetchMock as unknown as typeof fetch;
});
afterEach(() => {
  jest.useRealTimers();
});

describe('searchCities', () => {
  it('asks Nominatim for cities and identifies Roami', async () => {
    fetchMock.mockResolvedValue(answer([{ osm_type: 'relation' }]));
    await expect(searchCities('Portland')).resolves.toEqual([{ osm_type: 'relation' }]);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toMatch(/^https:\/\/nominatim\.openstreetmap\.org\/search\?/);
    expect(String(url)).toContain('q=Portland');
    expect((init?.headers as Record<string, string>)['User-Agent']).toMatch(/^Roami\//);
  });
  it('reuses an answer instead of asking again', async () => {
    fetchMock.mockResolvedValue(answer([]));
    await searchCities('Portland');
    await searchCities('portland');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it('waits at least a second between requests', async () => {
    jest.useFakeTimers({ now: 1_000_000 });
    fetchMock.mockResolvedValue(answer([]));
    await searchCities('Portland');
    const second = searchCities('Salem');
    await jest.advanceTimersByTimeAsync(500);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(700);
    await second;
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
  it('reports an error answer as unavailable', async () => {
    fetchMock.mockResolvedValue(answer({}, 503));
    await expect(searchCities('Portland')).rejects.toBeInstanceOf(OsmUnavailableError);
  });
});

describe('fetchOverpass', () => {
  it('posts the query', async () => {
    fetchMock.mockResolvedValue(answer({ elements: [] }));
    await expect(fetchOverpass('[out:json];')).resolves.toEqual({ elements: [] });
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe('https://overpass-api.de/api/interpreter');
    expect(init?.method).toBe('POST');
    expect(init?.body).toBe(`data=${encodeURIComponent('[out:json];')}`);
  });
  it('tries the second server when the first is busy', async () => {
    fetchMock
      .mockResolvedValueOnce(answer({}, 429))
      .mockResolvedValueOnce(answer({ elements: [1] }));
    await expect(fetchOverpass('q')).resolves.toEqual({ elements: [1] });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
  it('never returns a partial answer from a timed-out query', async () => {
    fetchMock.mockResolvedValue(
      answer({ elements: [1], remark: 'runtime error: Query timed out in "query" at line 3' }),
    );
    await expect(fetchOverpass('q')).rejects.toBeInstanceOf(OsmUnavailableError);
  });
  it('reports a network failure as unavailable', async () => {
    fetchMock.mockRejectedValue(new TypeError('Network request failed'));
    await expect(fetchOverpass('q')).rejects.toBeInstanceOf(OsmUnavailableError);
  });
});
