// writeImportedPlaces against a minimal stand-in for firebase/firestore.
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import type { Place } from '@roami/shared';

const mockRefused = new Set<string>();
const mockStored = new Map<string, Record<string, unknown>>();
const mockCommits: string[][] = [];

const mockDenied = () => Object.assign(new Error('denied'), { code: 'permission-denied' });

jest.mock('../src/repositories/firestore', () => ({ db: {} }));
jest.mock('firebase/firestore', () => ({
  doc: (_db: unknown, collection: string, id: string) => ({ path: `${collection}/${id}`, id }),
  serverTimestamp: () => 'SERVER_TIME',
  setDoc: async (ref: { path: string; id: string }, data: Record<string, unknown>) => {
    if (mockRefused.has(ref.id)) throw mockDenied();
    mockStored.set(ref.path, data);
  },
  writeBatch: () => {
    const writes: [{ path: string; id: string }, Record<string, unknown>][] = [];
    return {
      set(ref: { path: string; id: string }, data: Record<string, unknown>) {
        writes.push([ref, data]);
      },
      async commit() {
        if (writes.some(([ref]) => mockRefused.has(ref.id))) throw mockDenied();
        mockCommits.push(writes.map(([ref]) => ref.id));
        for (const [ref, data] of writes) mockStored.set(ref.path, data);
      },
    };
  },
}));

// eslint-disable-next-line import/first
import { writeImportedPlaces } from '../src/repositories/PlaceRepository';

const place = (n: number): Place => ({
  id: `osm-node-${n}`,
  name: `Place ${n}`,
  city: 'Portland',
  cityId: 'osm-relation-186579',
  latitude: 45.5,
  longitude: -122.6,
  category: 'museum',
  openingHours: null,
  missingFields: ['openingHours'],
  source: { provider: 'osm', providerId: `node/${n}`, retrievedAt: '2026-11-22T12:00:00Z' },
  updatedAt: '2026-11-22T12:00:00Z',
});

beforeEach(() => {
  mockRefused.clear();
  mockStored.clear();
  mockCommits.length = 0;
});

describe('writeImportedPlaces', () => {
  it('writes in batches of at most 400 with a server timestamp', async () => {
    const places = Array.from({ length: 450 }, (_, i) => place(i + 1));
    const written = await writeImportedPlaces(places);
    expect(written.size).toBe(450);
    expect(mockCommits.map((ids) => ids.length)).toEqual([400, 50]);
    expect(mockStored.get('places/osm-node-1')).toMatchObject({
      importedAt: 'SERVER_TIME',
      cityId: 'osm-relation-186579',
    });
  });

  it('retries a mockRefused batch one by one and skips only the mockRefused places', async () => {
    mockRefused.add('osm-node-2');
    const written = await writeImportedPlaces([place(1), place(2), place(3)]);
    expect([...written].sort()).toEqual(['osm-node-1', 'osm-node-3']);
    expect(mockStored.has('places/osm-node-2')).toBe(false);
  });
});
