/**
 * The only code that talks to OpenStreetMap's free services:
 *   - Nominatim, to find a city by name (usage policy: at most one request a
 *     second, an identifying User-Agent, and no search-as-you-type).
 *   - Overpass, to download a city's places (usage policy: well under 10,000
 *     requests a day; Roami sends about one per new or stale city).
 * Both are free and need no key. The data is © OpenStreetMap contributors
 * (ODbL), so screens that show it must say so.
 */

const USER_AGENT = 'Roami/1.0 (student travel app; https://github.com/penacoat/Roami)';
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
// The main public instance, then a second public one if the first is busy.
const OVERPASS_URLS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];
const NOMINATIM_TIMEOUT_MS = 15_000;
const OVERPASS_TIMEOUT_MS = 100_000;
const NOMINATIM_GAP_MS = 1_100;

/** OpenStreetMap could not be reached or was too busy. Shown as 'unavailable'. */
export class OsmUnavailableError extends Error {
  readonly code = 'unavailable';
  constructor(message: string) {
    super(message);
    this.name = 'OsmUnavailableError';
  }
}

let lastNominatimCall = 0;
const cityCache = new Map<string, unknown>();

/** Forgets cached city searches and the rate-limit clock (used by tests). */
export function resetOsmClient(): void {
  lastNominatimCall = 0;
  cityCache.clear();
}

async function fetchJson(url: string, init: RequestInit, timeoutMs: number): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json', ...init.headers },
    });
    if (!response.ok) throw new OsmUnavailableError(`OpenStreetMap answered ${response.status}.`);
    return await response.json();
  } catch (error) {
    if (error instanceof OsmUnavailableError) throw error;
    throw new OsmUnavailableError('Could not reach OpenStreetMap.');
  } finally {
    clearTimeout(timer);
  }
}

/** Raw Nominatim results for a city name. Parse with parseNominatim. */
export async function searchCities(query: string): Promise<unknown> {
  const key = query.toLowerCase();
  if (cityCache.has(key)) return cityCache.get(key);

  const wait = lastNominatimCall + NOMINATIM_GAP_MS - Date.now();
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
  lastNominatimCall = Date.now();

  const params = new URLSearchParams({
    q: query,
    format: 'jsonv2',
    addressdetails: '1',
    featureType: 'city',
    limit: '8',
    'accept-language': 'en',
  });
  const json = await fetchJson(`${NOMINATIM_URL}?${params}`, {}, NOMINATIM_TIMEOUT_MS);
  cityCache.set(key, json);
  return json;
}

/** Raw Overpass results for a query. Parse with parseOverpass. */
export async function fetchOverpass(query: string): Promise<unknown> {
  let lastError: unknown = null;
  for (const url of OVERPASS_URLS) {
    try {
      const json = await fetchJson(
        url,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: `data=${encodeURIComponent(query)}`,
        },
        OVERPASS_TIMEOUT_MS,
      );
      // Overpass reports a timeout or overload as a 200 with a "remark", and
      // the elements it returns are then incomplete. Never store those.
      const remark = (json as { remark?: unknown })?.remark;
      if (typeof remark === 'string' && /error|timed out|out of memory/i.test(remark)) {
        throw new OsmUnavailableError('OpenStreetMap was too busy to answer in full.');
      }
      return json;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof OsmUnavailableError
    ? lastError
    : new OsmUnavailableError('Could not reach OpenStreetMap.');
}
