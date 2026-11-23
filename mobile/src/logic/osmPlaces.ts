import type { CityMatch, Place, PlaceSummary } from '@roami/shared';

/**
 * Pure helpers for importing a city's places from OpenStreetMap: building the
 * Overpass query, turning OSM's answers into Roami places, and deciding what is
 * stale. No network and no Firebase here; see OsmClient and the repositories.
 *
 * Keep REFRESH_DAYS, MAX_NAME_LENGTH, MAX_HOURS_LENGTH and OSM_CATEGORIES in
 * step with the places and cityImports rules in firestore.rules.
 */

/** A city's places are re-imported once its last import is older than this. */
export const REFRESH_DAYS = 30;
export const REFRESH_MS = REFRESH_DAYS * 24 * 60 * 60 * 1000;

/**
 * At most this many places are stored per city, best first. Keeps one import
 * well inside Firestore's free 20,000 writes a day, even for a huge city.
 */
export const MAX_PLACES_PER_CITY = 400;

export const MAX_NAME_LENGTH = 200;
export const MAX_HOURS_LENGTH = 300;

/** Two places closer than this with the same name are treated as one. */
export const DUPLICATE_DISTANCE_METERS = 75;

/** Every category an imported place can have (the rules allow only these). */
export const OSM_CATEGORIES = [
  'museum',
  'gallery',
  'attraction',
  'viewpoint',
  'zoo',
  'aquarium',
  'theme park',
  'landmark',
  'theater',
  'arts center',
  'cinema',
  'market',
  'library',
  'music venue',
  'park',
  'garden',
  'beach',
  'cafe',
  'restaurant',
  'bar',
  'dessert shop',
  'bookstore',
  'bakery',
  'chocolate shop',
  'tea shop',
] as const;
export type OsmCategory = (typeof OSM_CATEGORIES)[number];

type Tags = Record<string, string>;

// Order matters: the first rule that matches decides the category.
const CATEGORY_RULES: { key: string; values: Record<string, OsmCategory> }[] = [
  {
    key: 'tourism',
    values: {
      museum: 'museum',
      gallery: 'gallery',
      attraction: 'attraction',
      viewpoint: 'viewpoint',
      zoo: 'zoo',
      aquarium: 'aquarium',
      theme_park: 'theme park',
    },
  },
  {
    key: 'historic',
    values: { monument: 'landmark', castle: 'landmark', fort: 'landmark', landmark: 'landmark' },
  },
  {
    key: 'amenity',
    values: {
      theatre: 'theater',
      arts_centre: 'arts center',
      cinema: 'cinema',
      marketplace: 'market',
      library: 'library',
      music_venue: 'music venue',
      nightclub: 'music venue',
    },
  },
  { key: 'leisure', values: { park: 'park', garden: 'garden' } },
  { key: 'natural', values: { beach: 'beach' } },
  {
    key: 'amenity',
    values: {
      cafe: 'cafe',
      restaurant: 'restaurant',
      bar: 'bar',
      pub: 'bar',
      ice_cream: 'dessert shop',
    },
  },
  {
    key: 'shop',
    values: {
      books: 'bookstore',
      bakery: 'bakery',
      chocolate: 'chocolate shop',
      tea: 'tea shop',
    },
  },
];

const OUTDOORS = new Set<OsmCategory>(['park', 'garden', 'beach']);
const FOOD_AND_SHOPS = new Set<OsmCategory>([
  'cafe',
  'restaurant',
  'bar',
  'dessert shop',
  'bookstore',
  'bakery',
  'chocolate shop',
  'tea shop',
]);

export function categoryFor(tags: Tags): OsmCategory | null {
  for (const rule of CATEGORY_RULES) {
    const category = rule.values[tags[rule.key]];
    if (category) return category;
  }
  return null;
}

// ---------- City IDs ----------

/** "osm-relation-237385" for OSM relation 237385. */
export function cityIdFor(relationId: number): string {
  return `osm-relation-${relationId}`;
}

/** The OSM relation number in a city ID, or null if it isn't one. */
export function relationIdOf(cityId: string): number | null {
  const match = /^osm-relation-([1-9][0-9]{0,11})$/.exec(cityId);
  return match ? Number(match[1]) : null;
}

// ---------- Nominatim (finding the city) ----------

interface NominatimResult {
  osm_type?: unknown;
  osm_id?: unknown;
  lat?: unknown;
  lon?: unknown;
  name?: unknown;
  display_name?: unknown;
  address?: Record<string, unknown>;
}

const LABEL_KEYS = ['state', 'province', 'region', 'country'];

/**
 * Cities from a Nominatim /search answer (format=jsonv2, addressdetails=1).
 * Only boundary relations are kept, because Overpass needs the city's outline
 * to find what's inside it. Same-named cities are told apart by their label.
 */
export function parseNominatim(json: unknown): CityMatch[] {
  if (!Array.isArray(json)) return [];
  const matches: CityMatch[] = [];
  const seen = new Set<string>();
  for (const raw of json as NominatimResult[]) {
    if (raw?.osm_type !== 'relation') continue;
    const relationId = Number(raw.osm_id);
    const latitude = Number(raw.lat);
    const longitude = Number(raw.lon);
    if (!Number.isSafeInteger(relationId) || relationId <= 0) continue;
    if (!validCoordinates(latitude, longitude)) continue;
    const name = cleanText(raw.name) || cleanText(raw.display_name).split(',')[0]?.trim() || '';
    if (!name) continue;
    const cityId = cityIdFor(relationId);
    if (seen.has(cityId)) continue;
    seen.add(cityId);

    const parts = [name];
    for (const key of LABEL_KEYS) {
      const part = cleanText(raw.address?.[key]);
      if (part && !parts.includes(part)) parts.push(part);
    }
    matches.push({ cityId, name, label: parts.join(', '), latitude, longitude });
  }
  return matches;
}

// ---------- Overpass (the city's places) ----------

/** Overpass's ID for the area inside an OSM relation. */
export function overpassAreaId(relationId: number): number {
  return 3_600_000_000 + relationId;
}

/**
 * A city's places come in two requests, so a big city doesn't time out:
 *   - 'sights': landmarks, museums, parks and other things to see (the
 *     request that must work), and
 *   - 'food': cafés, restaurants, bars and a few kinds of shops, which a city
 *     like New York has tens of thousands of.
 * Each is capped, so a huge city still gets its museums and parks.
 */
export type OverpassPart = 'sights' | 'food';

export function buildOverpassQuery(relationId: number, part: OverpassPart): string {
  const area = 'area.city';
  const filters =
    part === 'sights'
      ? [
          `nwr["tourism"~"^(museum|gallery|attraction|viewpoint|zoo|aquarium|theme_park)$"]["name"](${area});`,
          `nwr["historic"~"^(monument|castle|fort|landmark)$"]["name"](${area});`,
          `nwr["amenity"~"^(theatre|arts_centre|cinema|marketplace|library|music_venue|nightclub)$"]["name"](${area});`,
          `nwr["leisure"~"^(park|garden)$"]["name"](${area});`,
          `nwr["natural"="beach"]["name"](${area});`,
        ]
      : [
          // Nodes and ways only: cafés, restaurants and shops are almost never
          // relations, and skipping relations makes the query much lighter.
          `nw["amenity"~"^(cafe|restaurant|bar|pub|ice_cream)$"]["name"](${area});`,
          `nw["shop"~"^(books|bakery|chocolate|tea)$"]["name"](${area});`,
        ];
  return [
    '[out:json][timeout:90];',
    `area(id:${overpassAreaId(relationId)})->.city;`,
    '(',
    ...filters.map((filter) => `  ${filter}`),
    ');',
    `out center tags ${part === 'sights' ? 1500 : 800};`,
  ].join('\n');
}

/** Puts the two parts' answers together for parseOverpass. */
export function mergeOverpass(...answers: unknown[]): { elements: unknown[] } {
  const elements: unknown[] = [];
  for (const answer of answers) {
    const list = (answer as { elements?: unknown })?.elements;
    if (Array.isArray(list)) elements.push(...list);
  }
  return { elements };
}

interface OverpassElement {
  type?: unknown;
  id?: unknown;
  lat?: unknown;
  lon?: unknown;
  center?: { lat?: unknown; lon?: unknown };
  tags?: Record<string, unknown>;
}

/** The Firestore ID of an OSM element: "osm-node-123". */
export function placeIdFor(type: string, id: number): string {
  return `osm-${type}-${id}`;
}

/** What OSM itself calls the element: "node/123". Stored as source.providerId. */
export function providerIdFor(type: string, id: number): string {
  return `${type}/${id}`;
}

function score(category: OsmCategory, tags: Tags): number {
  let value = FOOD_AND_SHOPS.has(category) ? 10 : OUTDOORS.has(category) ? 20 : 30;
  if (tags.wikidata || tags.wikipedia) value += 20; // a well-known place
  if (tags.website || tags['contact:website']) value += 5;
  if (tags.opening_hours) value += 5;
  return value;
}

/**
 * Turns an Overpass answer into places for one city, best first, at most
 * `limit` (MAX_PLACES_PER_CITY by default). Elements without a name, location or known category are
 * skipped. Opening hours are kept as OSM writes them ("Mo-Fr 09:00-17:00") and
 * are null (unknown, never "closed") when OSM doesn't have them.
 */
export function parseOverpass(
  json: unknown,
  city: Pick<CityMatch, 'cityId' | 'name'>,
  retrievedAt: string,
  limit: number = MAX_PLACES_PER_CITY,
): Place[] {
  const elements = (json as { elements?: unknown })?.elements;
  if (!Array.isArray(elements)) return [];

  const ranked: { place: Place; score: number }[] = [];
  const seen = new Set<string>();
  for (const raw of elements as OverpassElement[]) {
    const type = raw?.type;
    const osmId = Number(raw?.id);
    if (type !== 'node' && type !== 'way' && type !== 'relation') continue;
    if (!Number.isSafeInteger(osmId) || osmId <= 0) continue;
    const id = placeIdFor(type, osmId);
    if (seen.has(id)) continue;

    const tags = readTags(raw.tags);
    const name = cleanText(tags.name);
    if (!name || name.length > MAX_NAME_LENGTH) continue;
    const category = categoryFor(tags);
    if (!category) continue;
    const latitude = Number(raw.lat ?? raw.center?.lat);
    const longitude = Number(raw.lon ?? raw.center?.lon);
    if (!validCoordinates(latitude, longitude)) continue;

    const hours = cleanText(tags.opening_hours);
    const openingHours = hours && hours.length <= MAX_HOURS_LENGTH ? hours : null;
    seen.add(id);
    ranked.push({
      score: score(category, tags),
      place: {
        id,
        name,
        city: city.name,
        cityId: city.cityId,
        latitude,
        longitude,
        category,
        openingHours,
        missingFields: openingHours === null ? ['openingHours'] : [],
        source: { provider: 'osm', providerId: providerIdFor(type, osmId), retrievedAt },
        updatedAt: retrievedAt,
      },
    });
  }

  return ranked
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.place.name.localeCompare(b.place.name) ||
        a.place.id.localeCompare(b.place.id),
    )
    .slice(0, Math.max(0, limit))
    .map((entry) => entry.place);
}

// ---------- Freshness ----------

/** True when a city (or place) imported at importedAtMs should be imported again. */
export function isStale(importedAtMs: number, nowMs: number): boolean {
  return nowMs - importedAtMs > REFRESH_MS;
}

/**
 * Whether an imported place is still in OpenStreetMap, judged by the city's
 * latest import. Every place still in OSM is rewritten during a refresh, so one
 * left a whole refresh period older than the city's import was missing from
 * OSM that time (closed or removed). It is hidden, not deleted, so saved
 * places, trips and recommendations that point to it keep working.
 */
export function isCurrent(placeImportedAtMs: number, cityImportedAtMs: number): boolean {
  return placeImportedAtMs >= cityImportedAtMs - REFRESH_MS;
}

export interface ImportPlan {
  create: Place[];
  update: Place[];
}

/**
 * Which fetched places to write. New ones are created, stale ones updated,
 * and ones written recently (by an earlier import that didn't finish, or by
 * another user at the same moment) are left alone, since the rules refuse to
 * overwrite a fresh place.
 */
export function planImport(
  fetched: Place[],
  existingImportedAtMs: Map<string, number>,
  nowMs: number,
): ImportPlan {
  const plan: ImportPlan = { create: [], update: [] };
  for (const place of fetched) {
    const importedAt = existingImportedAtMs.get(place.id);
    if (importedAt === undefined) plan.create.push(place);
    else if (isStale(importedAt, nowMs)) plan.update.push(place);
  }
  return plan;
}

// ---------- Duplicates of hand-made places ----------

export function distanceMeters(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = toRadians(b.latitude - a.latitude);
  const dLon = toRadians(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(a.latitude)) * Math.cos(toRadians(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** "Pike Place Market" and "pike place market!" compare equal. */
export function normalizeName(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/^the /, '');
}

/**
 * Drops imported places that are the same place as a hand-made one (same name,
 * within DUPLICATE_DISTANCE_METERS), so the hand-made place, with its
 * recommendations, is the one shown.
 */
export function withoutDuplicatesOf<T extends PlaceSummary>(
  imported: T[],
  manual: PlaceSummary[],
): T[] {
  if (manual.length === 0) return imported;
  const byName = new Map<string, PlaceSummary[]>();
  for (const place of manual) {
    const key = normalizeName(place.name);
    byName.set(key, [...(byName.get(key) ?? []), place]);
  }
  return imported.filter((place) => {
    const sameName = byName.get(normalizeName(place.name)) ?? [];
    return !sameName.some((other) => distanceMeters(place, other) <= DUPLICATE_DISTANCE_METERS);
  });
}

// ---------- Small helpers ----------

function cleanText(value: unknown): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
}

function readTags(value: unknown): Tags {
  if (typeof value !== 'object' || value === null) return {};
  const tags: Tags = {};
  for (const [key, tag] of Object.entries(value)) {
    if (typeof tag === 'string') tags[key] = tag;
  }
  return tags;
}

export function validCoordinates(latitude: number, longitude: number): boolean {
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}
