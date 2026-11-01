// SAMPLE DATA ONLY. Names are real Seattle places, but the hours, descriptions,
// and authors are made up so the UI has something to show.
import type { PlaceSummary, PublicUser, RecommendationView } from '@roami/shared';

export const ME: PublicUser = {
  id: 'fixture-user',
  name: 'Test User',
  bio: '',
  interests: ['jazz', 'coffee'],
};

export const OTHER_USERS: PublicUser[] = [
  { id: 'u-maya', name: 'Maya', bio: 'Exchange student. Loves live music.', interests: ['jazz', 'food'] },
  { id: 'u-jonas', name: 'Jonas', bio: 'Local. Coffee and parks.', interests: ['coffee', 'parks'] },
];

const place = (
  id: string,
  name: string,
  latitude: number,
  longitude: number,
  category: string,
  openingHours: string | null,
): PlaceSummary => ({
  id,
  name,
  latitude,
  longitude,
  category,
  openingHours,
  missingFields: openingHours === null ? ['openingHours'] : [],
});

export const PLACES: PlaceSummary[] = [
  place('p-pike', 'Pike Place Market', 47.6097, -122.3425, 'market', '09:00-18:00'),
  place('p-sam', 'Seattle Art Museum', 47.6073, -122.3381, 'museum', '10:00-17:00'),
  place('p-kerry', 'Kerry Park', 47.6295, -122.3599, 'viewpoint', null),
  place('p-jazz', 'Jazz Alley', 47.6139, -122.3417, 'music venue', '18:00-23:00'),
  place('p-cafe', 'Corner Coffee', 47.6149, -122.319, 'cafe', '07:00-17:00'),
  place('p-park', 'Discovery Park', 47.6573, -122.4058, 'park', null),
  place('p-chihuly', 'Chihuly Garden and Glass', 47.6205, -122.3509, 'museum', '10:00-19:00'),
];

const byId = (id: string): PlaceSummary => {
  const found = PLACES.find((p) => p.id === id);
  if (!found) throw new Error(`Unknown fixture place ${id}`);
  return found;
};

const MAYA = { id: 'u-maya', name: 'Maya' };
const JONAS = { id: 'u-jonas', name: 'Jonas' };

const rec = (
  id: string,
  placeId: string,
  author: { id: string; name: string },
  description: string,
  tags: string[],
): RecommendationView => ({
  id,
  status: 'available',
  place: byId(placeId),
  author,
  description,
  tags,
  visitDate: null,
  sourceLinks: [],
  createdAt: '2026-10-01T12:00:00Z',
});

export const RECOMMENDATIONS: RecommendationView[] = [
  rec('r1', 'p-jazz', MAYA, 'Small room, great trio on weekends. Go early to get a table near the stage.', ['jazz', 'live music', 'nightlife']),
  rec('r2', 'p-kerry', JONAS, 'Best skyline view in the city, especially at sunset. Free.', ['views', 'sunset', 'free']),
  rec('r3', 'p-pike', MAYA, 'Go before 10 to beat the crowds. Get a pastry and walk the lower levels.', ['food', 'market', 'morning']),
  rec('r4', 'p-cafe', JONAS, 'Used to have jazz nights, but it no longer has jazz. Still good coffee and quiet for studying.', ['cafe', 'coffee', 'study']),
  rec('r5', 'p-sam', MAYA, 'Free first Thursday evenings. The Pacific Northwest gallery is the highlight.', ['museum', 'art', 'free']),
  rec('r6', 'p-park', JONAS, 'Big loop trail with water views. Bring a jacket, it gets windy.', ['parks', 'hiking', 'views']),
  rec('r7', 'p-chihuly', MAYA, 'Worth it for the glasshouse. Book ahead in summer.', ['art', 'museum']),
  rec('r8', 'p-jazz', JONAS, 'Dinner and a show. Pricey but the sound is great.', ['jazz', 'live music', 'dinner']),
];
