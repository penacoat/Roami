import { describe, expect, it } from '@jest/globals';

import type { PlaceSummary } from '@roami/shared';

import {
  MAX_PLACES_PER_CITY,
  OSM_CATEGORIES,
  REFRESH_DAYS,
  REFRESH_MS,
  buildOverpassQuery,
  categoryFor,
  cityIdFor,
  distanceMeters,
  isCurrent,
  isStale,
  mergeOverpass,
  normalizeName,
  overpassAreaId,
  parseNominatim,
  parseOverpass,
  planImport,
  relationIdOf,
  withoutDuplicatesOf,
} from '../src/logic/osmPlaces';

const PORTLAND = { cityId: 'osm-relation-186579', name: 'Portland' };
const AT = '2026-11-22T12:00:00.000Z';
const DAY = 24 * 60 * 60 * 1000;

// Shaped like real Nominatim answers (format=jsonv2, addressdetails=1).
const NOMINATIM = [
  {
    osm_type: 'relation',
    osm_id: 186579,
    lat: '45.5202471',
    lon: '-122.674194',
    name: 'Portland',
    display_name: 'Portland, Multnomah County, Oregon, United States',
    address: {
      city: 'Portland',
      county: 'Multnomah County',
      state: 'Oregon',
      country: 'United States',
    },
  },
  {
    osm_type: 'node',
    osm_id: 1,
    lat: '45.5',
    lon: '-122.6',
    name: 'Portland (a point, not a boundary)',
  },
  {
    osm_type: 'relation',
    osm_id: 132501,
    lat: '43.6573605',
    lon: '-70.2586618',
    name: 'Portland',
    address: { city: 'Portland', state: 'Maine', country: 'United States' },
  },
  { osm_type: 'relation', osm_id: 186579, lat: '45.5', lon: '-122.6', name: 'Portland' },
  { osm_type: 'relation', osm_id: 'x', lat: '1', lon: '1', name: 'Broken' },
];

function node(id: number, tags: Record<string, string>, lat = 45.52, lon = -122.67) {
  return { type: 'node', id, lat, lon, tags };
}

describe('city IDs', () => {
  it('round-trips a relation ID', () => {
    expect(cityIdFor(186579)).toBe('osm-relation-186579');
    expect(relationIdOf('osm-relation-186579')).toBe(186579);
  });
  it('refuses anything else', () => {
    for (const bad of [
      '',
      'Seattle',
      'osm-node-1',
      'osm-relation-',
      'osm-relation-01',
      'osm-relation-1x',
    ]) {
      expect(relationIdOf(bad)).toBeNull();
    }
  });
  it('builds the Overpass area ID from the relation', () => {
    expect(overpassAreaId(186579)).toBe(3600186579);
    expect(buildOverpassQuery(186579, 'sights')).toContain('area(id:3600186579)');
  });
  it('splits sights from food so a big city does not time out', () => {
    const sights = buildOverpassQuery(186579, 'sights');
    const food = buildOverpassQuery(186579, 'food');
    expect(sights).toContain('museum');
    expect(sights).not.toContain('restaurant');
    expect(food).toContain('restaurant');
    expect(food).not.toContain('museum');
  });
  it('keeps the food query light: no relations, a smaller cap', () => {
    const food = buildOverpassQuery(186579, 'food');
    expect(food).toContain('nw["amenity"');
    expect(food).not.toContain('nwr');
    expect(food).toContain('out center tags 800;');
    expect(buildOverpassQuery(186579, 'sights')).toContain('nwr["tourism"');
  });
  it('merges the two answers, ignoring a missing one', () => {
    expect(mergeOverpass({ elements: [1] }, null, { elements: [2, 3] })).toEqual({
      elements: [1, 2, 3],
    });
  });
});

describe('parseNominatim', () => {
  it('keeps boundary relations once each, labeled so same-named cities differ', () => {
    expect(parseNominatim(NOMINATIM)).toEqual([
      {
        cityId: 'osm-relation-186579',
        name: 'Portland',
        label: 'Portland, Oregon, United States',
        latitude: 45.5202471,
        longitude: -122.674194,
      },
      {
        cityId: 'osm-relation-132501',
        name: 'Portland',
        label: 'Portland, Maine, United States',
        latitude: 43.6573605,
        longitude: -70.2586618,
      },
    ]);
  });
  it('returns nothing for an answer that is not a list', () => {
    expect(parseNominatim({ error: 'busy' })).toEqual([]);
    expect(parseNominatim(null)).toEqual([]);
  });
});

describe('categoryFor', () => {
  it('maps OSM tags to Roami categories', () => {
    expect(categoryFor({ tourism: 'museum' })).toBe('museum');
    expect(categoryFor({ amenity: 'theatre' })).toBe('theater');
    expect(categoryFor({ amenity: 'pub' })).toBe('bar');
    expect(categoryFor({ leisure: 'park' })).toBe('park');
    expect(categoryFor({ shop: 'books' })).toBe('bookstore');
  });
  it('prefers the sight over the food when a place is both', () => {
    expect(categoryFor({ amenity: 'cafe', tourism: 'attraction' })).toBe('attraction');
  });
  it('returns null for tags Roami does not show', () => {
    expect(categoryFor({ amenity: 'parking' })).toBeNull();
    expect(categoryFor({})).toBeNull();
  });
  it('only produces listed categories (the rules tests check the same list)', () => {
    expect(OSM_CATEGORIES).toContain(categoryFor({ tourism: 'zoo' }));
    expect(new Set(OSM_CATEGORIES).size).toBe(OSM_CATEGORIES.length);
  });
});

describe('parseOverpass', () => {
  it('converts elements to places in the city', () => {
    const json = {
      elements: [
        node(1, {
          name: 'Portland Art Museum',
          tourism: 'museum',
          opening_hours: 'Tu-Su 10:00-17:00',
        }),
        {
          type: 'way',
          id: 2,
          center: { lat: 45.51, lon: -122.68 },
          tags: { name: 'Park Blocks', leisure: 'park' },
        },
      ],
    };
    expect(parseOverpass(json, PORTLAND, AT)).toEqual([
      {
        id: 'osm-node-1',
        name: 'Portland Art Museum',
        city: 'Portland',
        cityId: 'osm-relation-186579',
        latitude: 45.52,
        longitude: -122.67,
        category: 'museum',
        openingHours: 'Tu-Su 10:00-17:00',
        missingFields: [],
        source: { provider: 'osm', providerId: 'node/1', retrievedAt: AT },
        updatedAt: AT,
      },
      {
        id: 'osm-way-2',
        name: 'Park Blocks',
        city: 'Portland',
        cityId: 'osm-relation-186579',
        latitude: 45.51,
        longitude: -122.68,
        category: 'park',
        openingHours: null,
        missingFields: ['openingHours'],
        source: { provider: 'osm', providerId: 'way/2', retrievedAt: AT },
        updatedAt: AT,
      },
    ]);
  });

  it('skips elements without a name, location or known category, and repeats', () => {
    const json = {
      elements: [
        node(1, { tourism: 'museum' }),
        node(2, { name: 'Parking', amenity: 'parking' }),
        { type: 'way', id: 3, tags: { name: 'No center', leisure: 'park' } },
        node(4, { name: 'Off the map', tourism: 'museum' }, 95, 0),
        node(5, { name: 'x'.repeat(201), tourism: 'museum' }),
        node(6, { name: 'Kept', tourism: 'museum' }),
        node(6, { name: 'Kept', tourism: 'museum' }),
        { type: 'area', id: 7, lat: 1, lon: 1, tags: { name: 'Wrong type', tourism: 'museum' } },
      ],
    };
    expect(parseOverpass(json, PORTLAND, AT).map((p) => p.id)).toEqual(['osm-node-6']);
  });

  it('treats overlong hours as unknown rather than guessing', () => {
    const json = {
      elements: [node(1, { name: 'Odd', tourism: 'museum', opening_hours: 'a'.repeat(301) })],
    };
    const [place] = parseOverpass(json, PORTLAND, AT);
    expect(place.openingHours).toBeNull();
    expect(place.missingFields).toEqual(['openingHours']);
  });

  it('ranks well-known sights first and caps the city', () => {
    const elements = [];
    for (let i = 1; i <= MAX_PLACES_PER_CITY + 50; i++) {
      elements.push(node(i, { name: `Cafe ${i}`, amenity: 'cafe' }));
    }
    elements.push(node(9001, { name: 'Zoo', tourism: 'zoo', wikidata: 'Q1' }));
    elements.push(node(9002, { name: 'Big Park', leisure: 'park' }));
    const places = parseOverpass({ elements }, PORTLAND, AT);
    expect(places).toHaveLength(MAX_PLACES_PER_CITY);
    expect(places[0].name).toBe('Zoo');
    expect(places[1].name).toBe('Big Park');
  });

  it('can be asked for fewer places than the city limit', () => {
    const elements = [1, 2, 3].map((i) => node(i, { name: `Museum ${i}`, tourism: 'museum' }));
    expect(parseOverpass({ elements }, PORTLAND, AT, 2)).toHaveLength(2);
    expect(parseOverpass({ elements }, PORTLAND, AT, 0)).toEqual([]);
  });

  it('returns nothing for an answer without elements', () => {
    expect(parseOverpass({ remark: 'timeout' }, PORTLAND, AT)).toEqual([]);
  });
});

describe('freshness', () => {
  const now = Date.parse(AT);
  it(`is stale after ${REFRESH_DAYS} days`, () => {
    expect(isStale(now - REFRESH_MS + DAY, now)).toBe(false);
    expect(isStale(now - REFRESH_MS - 1, now)).toBe(true);
  });
  it('hides places the latest refresh did not see again', () => {
    const cityImport = now;
    expect(isCurrent(now, cityImport)).toBe(true);
    // Written by an earlier attempt of this same refresh that didn't finish.
    expect(isCurrent(now - 2 * DAY, cityImport)).toBe(true);
    // Left over from the import before, so it wasn't in OSM this time.
    expect(isCurrent(now - REFRESH_MS - DAY, cityImport)).toBe(false);
  });
  it('creates new places, updates stale ones, and leaves fresh ones alone', () => {
    const [a, b, c] = parseOverpass(
      { elements: [1, 2, 3].map((i) => node(i, { name: `Museum ${i}`, tourism: 'museum' })) },
      PORTLAND,
      AT,
    );
    const existing = new Map([
      [b.id, now - REFRESH_MS - DAY],
      [c.id, now - DAY],
    ]);
    expect(planImport([a, b, c], existing, now)).toEqual({ create: [a], update: [b] });
  });
});

describe('duplicates of hand-made places', () => {
  const place = (id: string, name: string, latitude: number, longitude: number): PlaceSummary => ({
    id,
    name,
    latitude,
    longitude,
    category: 'market',
    openingHours: null,
    missingFields: [],
  });

  it('normalizes names', () => {
    expect(normalizeName('The Pike Place Market!')).toBe('pike place market');
    expect(normalizeName('Café & Bar')).toBe('cafe and bar');
  });
  it('measures distance in meters', () => {
    expect(
      distanceMeters(
        { latitude: 47.6, longitude: -122.3 },
        { latitude: 47.601, longitude: -122.3 },
      ),
    ).toBeCloseTo(111, 0);
  });
  it('drops an imported place that matches a hand-made one nearby', () => {
    const manual = [place('p-pike', 'Pike Place Market', 47.6097, -122.3425)];
    const imported = [
      place('osm-way-1', 'Pike Place Market', 47.6093, -122.3421), // about 50 m away
      place('osm-way-2', 'Pike Place Market', 47.7, -122.3), // same name, far away
      place('osm-node-3', 'Seattle Aquarium', 47.6076, -122.343),
    ];
    expect(withoutDuplicatesOf(imported, manual).map((p) => p.id)).toEqual([
      'osm-way-2',
      'osm-node-3',
    ]);
  });
});
