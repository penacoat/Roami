// Fake backend for development. Keeps its state in memory, so a save or a trip
// edit shows up in later calls until the app reloads. The search here is a
// simple stand-in: the real SearchMatcher replaces it.
import type {
  MatchReason,
  PlaceSummary,
  PublicUser,
  RecommendationView,
  SavedPlaceView,
  SearchResult,
  Trip,
  TripStop,
  TripStopView,
  TripSummary,
  TripView,
} from '@roami/shared';

import { ME, OTHER_USERS, PLACES, RECOMMENDATIONS } from './fixtureData';
import { ApiError, type ApiHandlers } from './types';
import { validateStopTime } from '../logic/trips';

const MAX_STOPS_PER_DAY = 5;
const MAX_TRIP_DAYS = 7;

interface SavedRecord {
  placeId: string;
  recommendationIds: string[];
  personalNote: string;
  createdAt: string;
}

interface TripRecord {
  trip: Trip;
  stops: TripStop[];
}

let profile: PublicUser = ME;
let profileCreated = false;
let saved = new Map<string, SavedRecord>();
let trips = new Map<string, TripRecord>();
let userRecs: RecommendationView[] = [];
let counter = 1;

/** Puts the fixtures back to their starting state (used by tests). */
export function resetFixtures(): void {
  profile = { ...ME, interests: [...ME.interests] };
  profileCreated = false;
  saved = new Map();
  trips = new Map();
  userRecs = [];
  counter = 1;
}
resetFixtures();

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const delay = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 120));
const nowIso = (): string => new Date().toISOString();
const allRecs = (): RecommendationView[] => [...RECOMMENDATIONS, ...userRecs];

function nextId(prefix: string): string {
  const id = `${prefix}${counter}`;
  counter += 1;
  return id;
}

function getPlace(id: string): PlaceSummary {
  const found = PLACES.find((p) => p.id === id);
  if (!found) throw new ApiError('not-found', `No place with id ${id}.`);
  return found;
}

function getRecs(ids: string[]): RecommendationView[] {
  const all = allRecs();
  return ids
    .map((id) => all.find((r) => r.id === id))
    .filter((r): r is RecommendationView => r !== undefined);
}

function savedView(record: SavedRecord): SavedPlaceView {
  return {
    place: getPlace(record.placeId),
    recommendations: getRecs(record.recommendationIds),
    personalNote: record.personalNote,
    createdAt: record.createdAt,
  };
}

function getTripRecord(id: string): TripRecord {
  const record = trips.get(id);
  if (!record) throw new ApiError('not-found', `No trip with id ${id}.`);
  return record;
}

function tripView(record: TripRecord): TripView {
  const stops: TripStopView[] = [...record.stops]
    .sort((a, b) => a.day - b.day || a.order - b.order)
    .map((s) => ({ ...s, place: s.placeId ? getPlace(s.placeId) : null }));
  return {
    trip: record.trip,
    candidates: record.trip.candidatePlaceIds.map(getPlace),
    stops,
  };
}

/** Same rule the real app must follow: a stale edit is refused and nothing changes. */
function checkRevision(record: TripRecord, expected: number): void {
  if (record.trip.revision !== expected) {
    throw new ApiError('aborted', 'This trip changed since you loaded it. Reload and try again.');
  }
}

/** Every saved change raises the revision by exactly one. */
function commit(record: TripRecord, patch: Partial<Trip> = {}): void {
  record.trip = {
    ...record.trip,
    ...patch,
    revision: record.trip.revision + 1,
    updatedAt: nowIso(),
  };
}

function checkDay(day: number): void {
  if (!Number.isInteger(day) || day < 1 || day > MAX_TRIP_DAYS) {
    throw new ApiError('invalid-argument', `Day must be between 1 and ${MAX_TRIP_DAYS}.`);
  }
}

function dayCount(record: TripRecord, day: number, exceptId?: string): number {
  return record.stops.filter((s) => s.day === day && s.id !== exceptId).length;
}

function renumber(record: TripRecord, day: number): void {
  record.stops
    .filter((s) => s.day === day)
    .sort((a, b) => a.order - b.order)
    .forEach((s, index) => {
      s.order = index + 1;
    });
}

function makeRoom(record: TripRecord, day: number, order: number): void {
  record.stops
    .filter((s) => s.day === day && s.order >= order)
    .forEach((s) => {
      s.order += 1;
    });
}

const RELATED: Record<string, string[]> = {
  jazz: ['live music'],
  'live music': ['jazz'],
  coffee: ['cafe'],
  views: ['sunset'],
};

function matchRec(rec: RecommendationView, terms: string[]): MatchReason[] {
  const text = rec.description.toLowerCase();
  const tags = rec.tags.map((t) => t.toLowerCase());
  const reasons: MatchReason[] = [];
  for (const term of terms) {
    if (text.includes(`no longer has ${term}`)) continue;
    if (tags.includes(term)) {
      reasons.push({ kind: 'exact', term, matched: term, source: 'tag' });
      continue;
    }
    if (text.includes(term)) {
      reasons.push({ kind: 'exact', term, matched: term, source: 'text' });
      continue;
    }
    const related = (RELATED[term] ?? []).find((r) => tags.includes(r));
    if (related) reasons.push({ kind: 'broader', term, matched: related, source: 'tag' });
  }
  return reasons;
}

function search(text: string, interests: string[], limit: number): SearchResult[] {
  const terms = [...text.split(/\s+/), ...interests]
    .map((t) => t.trim().toLowerCase())
    .filter((t) => t.length > 0);
  const results: SearchResult[] = [];
  for (const rec of allRecs()) {
    const reasons = matchRec(rec, terms);
    if (reasons.length === 0) continue;
    const exact = reasons.some((r) => r.kind !== 'broader');
    results.push({ recommendation: rec, matchLevel: exact ? 'exact' : 'broader', reasons });
  }
  results.sort((a, b) => {
    if (a.matchLevel !== b.matchLevel) return a.matchLevel === 'exact' ? -1 : 1;
    return b.reasons.length - a.reasons.length;
  });
  return results.slice(0, limit);
}

const discoveryHandlers: Pick<
  ApiHandlers,
  | 'ensureProfile'
  | 'getProfile'
  | 'updateProfile'
  | 'listPlaces'
  | 'getPlace'
  | 'getFeed'
  | 'searchRecommendations'
  | 'createRecommendation'
  | 'savePlace'
  | 'listSavedPlaces'
  | 'updateSavedNote'
  | 'removeSavedPlace'
> = {
  async ensureProfile(request) {
    await delay();
    const created = !profileCreated;
    profileCreated = true;
    if (created && request.displayName) {
      profile = { ...profile, name: request.displayName };
    }
    return clone({ profile, created });
  },

  async getProfile(request) {
    await delay();
    if (!request.userId || request.userId === profile.id) return clone({ profile });
    const other = OTHER_USERS.find((u) => u.id === request.userId);
    if (!other) throw new ApiError('not-found', 'No such user.');
    return clone({ profile: other });
  },

  async updateProfile(request) {
    await delay();
    profile = {
      ...profile,
      name: request.name ?? profile.name,
      bio: request.bio ?? profile.bio,
      interests: request.interests ?? profile.interests,
    };
    return clone({ profile });
  },

  async listPlaces(request) {
    await delay();
    // The bundled demo catalog contains Seattle places only.
    return clone({ places: request.city.trim().toLowerCase() === 'seattle' ? PLACES : [] });
  },

  async getPlace(request) {
    await delay();
    const place = getPlace(request.placeId);
    const recommendations = allRecs().filter((r) => r.place.id === place.id);
    return clone({ place, recommendations });
  },

  async getFeed(request) {
    await delay();
    const items = [...allRecs()]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, request.limit ?? 20);
    return clone({ items });
  },

  async searchRecommendations(request) {
    await delay();
    return clone({ results: search(request.text, request.interests, request.limit ?? 20) });
  },

  async createRecommendation(request) {
    await delay();
    const description = request.description.trim();
    if (description.length === 0) {
      throw new ApiError('invalid-argument', 'Add a description.');
    }
    const view: RecommendationView = {
      id: nextId('r-user-'),
      status: 'available',
      place: getPlace(request.placeId),
      author: { id: profile.id, name: profile.name },
      description,
      tags: request.tags,
      visitDate: request.visitDate ?? null,
      sourceLinks: request.sourceLinks ?? [],
      createdAt: nowIso(),
    };
    userRecs = [...userRecs, view];
    return clone({ recommendation: view });
  },

  async savePlace(request) {
    await delay();
    getPlace(request.placeId);
    const record: SavedRecord = saved.get(request.placeId) ?? {
      placeId: request.placeId,
      recommendationIds: [],
      personalNote: '',
      createdAt: nowIso(),
    };
    const recId = request.recommendationId;
    if (recId && !record.recommendationIds.includes(recId)) {
      record.recommendationIds.push(recId);
    }
    saved.set(request.placeId, record);
    return clone({ saved: savedView(record) });
  },

  async listSavedPlaces() {
    await delay();
    return clone({ saved: [...saved.values()].map(savedView) });
  },

  async updateSavedNote(request) {
    await delay();
    const record = saved.get(request.placeId);
    if (!record) throw new ApiError('not-found', 'That place is not saved.');
    record.personalNote = request.personalNote;
    return clone({ saved: savedView(record) });
  },

  async removeSavedPlace(request) {
    await delay();
    saved.delete(request.placeId);
    return { removed: true };
  },
};

const tripHandlers: Pick<
  ApiHandlers,
  | 'createTrip'
  | 'listTrips'
  | 'getTrip'
  | 'addCandidate'
  | 'removeCandidate'
  | 'addStop'
  | 'moveStop'
  | 'removeStop'
  | 'updateStopTime'
> = {
  async createTrip(request) {
    await delay();
    if (request.endDate < request.startDate) {
      throw new ApiError('invalid-argument', 'The end date is before the start date.');
    }
    const days = (Date.parse(request.endDate) - Date.parse(request.startDate)) / 86400000 + 1;
    if (days > MAX_TRIP_DAYS) {
      throw new ApiError('invalid-argument', `Trips can be at most ${MAX_TRIP_DAYS} days.`);
    }
    const stamp = nowIso();
    const trip: Trip = {
      id: nextId('trip-'),
      ownerId: profile.id,
      city: request.city,
      startDate: request.startDate,
      endDate: request.endDate,
      dailyWindow: request.dailyWindow,
      startingPoints: request.startingPoints ?? [],
      candidatePlaceIds: [],
      revision: 1,
      createdAt: stamp,
      updatedAt: stamp,
    };
    const record: TripRecord = { trip, stops: [] };
    trips.set(trip.id, record);
    return clone({ trip: tripView(record) });
  },

  async listTrips() {
    await delay();
    const summaries: TripSummary[] = [...trips.values()].map((r) => ({
      id: r.trip.id,
      city: r.trip.city,
      startDate: r.trip.startDate,
      endDate: r.trip.endDate,
      candidateCount: r.trip.candidatePlaceIds.length,
      stopCount: r.stops.length,
    }));
    return clone({ trips: summaries });
  },

  async getTrip(request) {
    await delay();
    return clone({ trip: tripView(getTripRecord(request.tripId)) });
  },

  async addCandidate(request) {
    await delay();
    const record = getTripRecord(request.tripId);
    getPlace(request.placeId);
    if (!record.trip.candidatePlaceIds.includes(request.placeId)) {
      commit(record, { candidatePlaceIds: [...record.trip.candidatePlaceIds, request.placeId] });
    }
    return clone({ trip: tripView(record) });
  },

  async removeCandidate(request) {
    await delay();
    const record = getTripRecord(request.tripId);
    if (record.trip.candidatePlaceIds.includes(request.placeId)) {
      commit(record, {
        candidatePlaceIds: record.trip.candidatePlaceIds.filter((id) => id !== request.placeId),
      });
    }
    return clone({ trip: tripView(record) });
  },

  async addStop(request) {
    await delay();
    const record = getTripRecord(request.tripId);
    checkRevision(record, request.expectedRevision);
    getPlace(request.placeId);
    checkDay(request.day);
    const startTime = request.startTime ?? null;
    const timeCheck = validateStopTime({ startTime, visitMinutes: request.visitMinutes });
    if (!timeCheck.ok) throw new ApiError('invalid-argument', timeCheck.error);
    const count = dayCount(record, request.day);
    if (count >= MAX_STOPS_PER_DAY) {
      throw new ApiError('invalid-argument', `At most ${MAX_STOPS_PER_DAY} stops per day.`);
    }
    const order = Math.max(1, Math.min(request.order ?? count + 1, count + 1));
    makeRoom(record, request.day, order);
    record.stops.push({
      id: nextId('stop-'),
      tripId: record.trip.id,
      placeId: request.placeId,
      title: null,
      recommendationIds: request.recommendationIds ?? [],
      day: request.day,
      order,
      startTime,
      visitMinutes: request.visitMinutes,
      walkingMinutesFromPrevious: null, // unknown, never zero
      isFixed: false,
      isRequired: false,
      warnings: [],
    });
    commit(record);
    return clone({ trip: tripView(record) });
  },

  async moveStop(request) {
    await delay();
    const record = getTripRecord(request.tripId);
    checkRevision(record, request.expectedRevision);
    checkDay(request.day);
    const stop = record.stops.find((s) => s.id === request.stopId);
    if (!stop) throw new ApiError('not-found', 'No such stop.');
    const targetCount = dayCount(record, request.day, stop.id);
    if (targetCount >= MAX_STOPS_PER_DAY) {
      throw new ApiError('invalid-argument', `At most ${MAX_STOPS_PER_DAY} stops per day.`);
    }
    const order = Math.max(1, Math.min(request.order, targetCount + 1));
    const oldDay = stop.day;
    record.stops = record.stops.filter((s) => s.id !== stop.id);
    renumber(record, oldDay);
    makeRoom(record, request.day, order);
    record.stops.push({ ...stop, day: request.day, order });
    renumber(record, request.day);
    commit(record);
    return clone({ trip: tripView(record) });
  },

  async removeStop(request) {
    await delay();
    const record = getTripRecord(request.tripId);
    checkRevision(record, request.expectedRevision);
    const stop = record.stops.find((s) => s.id === request.stopId);
    if (!stop) throw new ApiError('not-found', 'No such stop.');
    record.stops = record.stops.filter((s) => s.id !== stop.id);
    renumber(record, stop.day);
    commit(record);
    return clone({ trip: tripView(record) });
  },

  async updateStopTime(request) {
    await delay();
    const record = getTripRecord(request.tripId);
    checkRevision(record, request.expectedRevision);
    const startTime = request.startTime ?? null;
    const check = validateStopTime({ startTime, visitMinutes: request.visitMinutes });
    if (!check.ok) throw new ApiError('invalid-argument', check.error);
    const stop = record.stops.find((s) => s.id === request.stopId);
    if (!stop) throw new ApiError('not-found', 'No such stop.');
    if (stop.startTime === startTime && stop.visitMinutes === request.visitMinutes) {
      return clone({ trip: tripView(record) });
    }
    stop.startTime = startTime;
    stop.visitMinutes = request.visitMinutes;
    commit(record);
    return clone({ trip: tripView(record) });
  },
};

export const fixtureHandlers: ApiHandlers = { ...discoveryHandlers, ...tripHandlers };
