// Fake backend for development. Keeps its state in memory, so a save or a trip
// edit shows up in later calls until the app reloads. The search here is a
// simple stand-in: the real SearchMatcher replaces it.
import type {
  MatchReason,
  PlaceSummary,
  PreparationTask,
  Ranking,
  Visit,
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
import { journalView, validateRanking } from '../logic/journal';
import { planPreparation, taskWithReview } from '../logic/preparation';
import { planStopDetails } from '../logic/stopDetails';
import { itineraryChanges, planItinerary } from '../logic/itineraryPlan';
import {
  applyPositions,
  MAX_CANDIDATES,
  isValidDate,
  planAddStop,
  planFixedActivity,
  planMoveStop,
  planRemoveStop,
  tripDayCount,
  validateActivityOverlap,
  validateNewTrip,
  validateStopDetails,
  validateStopTime,
  type Result,
} from '../logic/trips';

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
let tasks = new Map<string, PreparationTask>();
let visits = new Map<string, Visit>();
let rankings = new Map<string, Ranking>();

/** Puts the fixtures back to their starting state (used by tests). */
export function resetFixtures(): void {
  profile = { ...ME, interests: [...ME.interests] };
  profileCreated = false;
  saved = new Map();
  trips = new Map();
  userRecs = [];
  counter = 1;
  tasks = new Map();
  visits = new Map();
  rankings = new Map();
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
    candidates: record.trip.candidatePlaceIds
      .filter((id) => !stops.some((stop) => stop.placeId === id))
      .map(getPlace),
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

function unwrap<T>(result: Result<T>): T {
  if (!result.ok) throw new ApiError('invalid-argument', result.error);
  return result.value;
}

function saveStops(record: TripRecord, updates: TripStop[], removedId?: string): void {
  const updatedIds = new Set(updates.map((stop) => stop.id));
  record.stops = [
    ...record.stops.filter((stop) => stop.id !== removedId && !updatedIds.has(stop.id)),
    ...updates,
  ];
  commit(record);
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
  | 'deleteTrip'
  | 'addCandidate'
  | 'removeCandidate'
  | 'addStop'
  | 'addFixedActivity'
  | 'applyItinerary'
  | 'moveStop'
  | 'removeStop'
  | 'updateStopTime'
  | 'updateStopDetails'
> = {
  async createTrip(request) {
    await delay();
    const checked = unwrap(validateNewTrip(request));
    const stamp = nowIso();
    const trip: Trip = {
      id: nextId('trip-'),
      ownerId: profile.id,
      city: checked.city,
      startDate: checked.startDate,
      endDate: checked.endDate,
      dailyWindow: checked.dailyWindow,
      startingPoints: checked.startingPoints ?? [],
      walkingLimit: checked.walkingLimit ?? null,
      candidatePlaceIds: [],
      revision: 1,
      createdAt: stamp,
      updatedAt: stamp,
    };
    const record: TripRecord = { trip, stops: [] };
    trips.set(trip.id, record);
    return clone({ trip: tripView(record) });
  },

  async listTrips(request) {
    await delay();
    const summaries: TripSummary[] = [...trips.values()].map((r) => ({
      id: r.trip.id,
      city: r.trip.city,
      startDate: r.trip.startDate,
      endDate: r.trip.endDate,
      candidateCount: r.trip.candidatePlaceIds.filter(
        (id) => !r.stops.some((stop) => stop.placeId === id),
      ).length,
      stopCount: r.stops.length,
      ...(request.includeScheduledPlaces && {
        scheduledPlaces: r.stops.flatMap(({ placeId, day }) => (placeId ? [{ placeId, day }] : [])),
      }),
    }));
    return clone({
      trips: summaries.sort(
        (a, b) => a.startDate.localeCompare(b.startDate) || a.id.localeCompare(b.id),
      ),
    });
  },

  async getTrip(request) {
    await delay();
    return clone({ trip: tripView(getTripRecord(request.tripId)) });
  },

  async deleteTrip(request) {
    await delay();
    const record = trips.get(request.tripId);
    if (record) {
      checkRevision(record, request.expectedRevision);
      trips.delete(request.tripId);
    }
    return { deleted: true };
  },

  async addCandidate(request) {
    await delay();
    const record = getTripRecord(request.tripId);
    getPlace(request.placeId);
    if (!record.trip.candidatePlaceIds.includes(request.placeId)) {
      if (record.trip.candidatePlaceIds.length >= MAX_CANDIDATES) {
        throw new ApiError('invalid-argument', `A trip can have at most ${MAX_CANDIDATES} places.`);
      }
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
    const id = nextId('stop-');
    const { position, moved } = unwrap(
      planAddStop(record.stops, tripDayCount(record.trip.startDate, record.trip.endDate), {
        ...request,
        id,
      }),
    );
    const startTime = request.startTime ?? null;
    unwrap(validateStopDetails(request));
    unwrap(validateStopTime({ startTime, visitMinutes: request.visitMinutes }));
    const stop: TripStop = {
      ...position,
      tripId: record.trip.id,
      placeId: request.placeId,
      title: null,
      recommendationIds: [...new Set(request.recommendationIds ?? [])],
      startTime,
      visitMinutes: request.visitMinutes,
      walkingMinutesFromPrevious: null,
      isFixed: false,
      isRequired: false,
      warnings: [],
    };
    unwrap(validateActivityOverlap(record.stops, stop));
    saveStops(record, [stop, ...applyPositions(record.stops, moved)]);
    return clone({ trip: tripView(record) });
  },

  async addFixedActivity(request) {
    await delay();
    const record = getTripRecord(request.tripId);
    checkRevision(record, request.expectedRevision);
    const { stop, moved } = unwrap(
      planFixedActivity(record.trip, record.stops, nextId('stop-'), request),
    );
    saveStops(record, [stop, ...applyPositions(record.stops, moved)]);
    return clone({ trip: tripView(record) });
  },

  async applyItinerary(request) {
    await delay();
    const record = getTripRecord(request.tripId);
    checkRevision(record, request.expectedRevision);
    const plan = unwrap(
      planItinerary(record.trip, record.stops, request.placeIds, request.strategy),
    );
    const changes = itineraryChanges(record.stops, plan);
    for (const stop of changes) {
      if (stop.id === null) getPlace(stop.placeId!);
    }
    if (changes.length)
      saveStops(
        record,
        changes.map((stop) => ({ ...stop, id: stop.id ?? nextId('stop-') })),
      );
    return clone({ trip: tripView(record) });
  },

  async moveStop(request) {
    await delay();
    const record = getTripRecord(request.tripId);
    checkRevision(record, request.expectedRevision);
    const stop = record.stops.find((s) => s.id === request.stopId);
    if (!stop) throw new ApiError('not-found', 'No such stop.');
    const positions = unwrap(
      planMoveStop(record.stops, tripDayCount(record.trip.startDate, record.trip.endDate), request),
    );
    if (stop.day !== request.day)
      unwrap(validateActivityOverlap(record.stops, { ...stop, day: request.day }));
    if (positions.length) saveStops(record, applyPositions(record.stops, positions));
    return clone({ trip: tripView(record) });
  },

  async removeStop(request) {
    await delay();
    const record = getTripRecord(request.tripId);
    checkRevision(record, request.expectedRevision);
    const positions = unwrap(planRemoveStop(record.stops, request.stopId));
    saveStops(record, applyPositions(record.stops, positions), request.stopId);
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
    const updated = { ...stop, startTime, visitMinutes: request.visitMinutes };
    if (request.requireOpenSlot && stop.isFixed) {
      throw new ApiError('invalid-argument', 'Fixed activities stay at their scheduled time.');
    }
    unwrap(validateActivityOverlap(record.stops, updated, request.requireOpenSlot));
    saveStops(record, [updated]);
    return clone({ trip: tripView(record) });
  },

  async updateStopDetails(request) {
    await delay();
    const record = getTripRecord(request.tripId);
    checkRevision(record, request.expectedRevision);
    const stop = fixtureStop(request.tripId, request.stopId);
    saveStops(record, [unwrap(planStopDetails(stop, request))]);
    return clone({ trip: tripView(record) });
  },
};

function fixtureStop(tripId: string, stopId: string) {
  const stop = getTripRecord(tripId).stops.find((item) => item.id === stopId);
  if (!stop) throw new ApiError('not-found', 'That activity is no longer in this trip.');
  return stop;
}

function fixtureJournal() {
  return journalView(
    [...visits.values()],
    [...rankings.values()],
    new Map(PLACES.map((place) => [place.id, place])),
  );
}

const personalHandlers: Pick<
  ApiHandlers,
  | 'listPreparation'
  | 'savePreparation'
  | 'removePreparation'
  | 'getPlaceJournal'
  | 'markVisited'
  | 'saveRanking'
> = {
  async listPreparation(request) {
    await delay();
    const stop = fixtureStop(request.tripId, request.stopId);
    return clone({
      tasks: [...tasks.values()]
        .filter((task) => task.tripStopId === stop.id)
        .map((task) => taskWithReview(task, stop)),
    });
  },
  async savePreparation(request) {
    await delay();
    const stop = fixtureStop(request.tripId, request.stopId);
    const current = request.taskId ? tasks.get(request.taskId) : undefined;
    if (request.taskId && current?.tripStopId !== stop.id)
      throw new ApiError('not-found', 'That checklist item is unavailable.');
    const task = unwrap(planPreparation(request, stop, current?.id ?? nextId('task-'), current));
    tasks.set(task.id, task);
    return clone({ task: taskWithReview(task, stop) });
  },
  async removePreparation(request) {
    await delay();
    const stop = fixtureStop(request.tripId, request.stopId);
    if (tasks.get(request.taskId)?.tripStopId !== stop.id)
      throw new ApiError('not-found', 'That checklist item is unavailable.');
    tasks.delete(request.taskId);
    return { deleted: true };
  },
  async getPlaceJournal() {
    await delay();
    return clone(fixtureJournal());
  },
  async markVisited(request) {
    await delay();
    if (!isValidDate(request.visitDate))
      throw new ApiError('invalid-argument', 'Choose a valid visit date.');
    getPlace(request.placeId);
    const id = `${profile.id}_${request.placeId}_${request.visitDate}`;
    const visit = { id, userId: profile.id, ...request };
    visits.set(id, visit);
    return clone({ visit });
  },
  async saveRanking(request) {
    await delay();
    unwrap(validateRanking(request.category, request.placeIds, fixtureJournal()));
    rankings.set(request.category, {
      id: `${profile.id}_${request.category}`,
      userId: profile.id,
      ...request,
    });
    return clone(fixtureJournal());
  },
};

export const fixtureHandlers: ApiHandlers = {
  ...discoveryHandlers,
  ...tripHandlers,
  ...personalHandlers,
};
