import type {
  KnownCost,
  PlaceId,
  PreparationTask,
  Ranking,
  RecommendationId,
  StartingPoint,
  TripId,
  TripStopId,
  Visit,
} from './models';
import type {
  CityLocation,
  CityMatch,
  PlaceSummary,
  PublicUser,
  RecommendationView,
  SavedPlaceView,
  SearchResult,
  TripSummary,
  TripView,
} from './views';

/**
 * Error codes the app uses (they match Firebase error codes).
 * 'aborted' means the trip changed since you loaded it (stale revision).
 * Reload the trip and let the user retry. Nothing was saved.
 */
export type ApiErrorCode =
  | 'unauthenticated' // not signed in
  | 'permission-denied' // signed in but not allowed (e.g. not the trip owner)
  | 'invalid-argument' // the request failed validation
  | 'not-found'
  | 'aborted' // stale trip revision
  | 'unavailable' // an external service is down; show "unavailable", never zero
  | 'internal';

// ---------- Accounts and profiles ----------

/** Call after sign-up and sign-in. Creates the profile record if it doesn't exist yet. */
export interface EnsureProfileRequest {
  displayName?: string;
}
export interface EnsureProfileResponse {
  profile: PublicUser;
  created: boolean;
}

export interface GetProfileRequest {
  userId?: string; // omit for the signed-in user
}
export interface GetProfileResponse {
  profile: PublicUser;
}

export interface UpdateProfileRequest {
  name?: string;
  bio?: string;
  interests?: string[];
}
export interface UpdateProfileResponse {
  profile: PublicUser;
}

// ---------- Discovery and map ----------

export interface SearchCitiesRequest {
  query: string;
}
export interface SearchCitiesResponse {
  cities: CityLocation[];
}

/** Turns what the user typed into cities to choose from. Call once on submit, not per keystroke. */
export interface ResolveCityRequest {
  query: string;
}
export interface ResolveCityResponse {
  matches: CityMatch[]; // empty when nothing matched
}

/**
 * With cityId, a city opened for the first time is imported from OpenStreetMap
 * (this can take up to about 30 seconds), and a city imported more than 30 days
 * ago is refreshed in the background. Without cityId, only places already
 * stored under that city name are returned.
 */
export interface ListPlacesRequest {
  city: string;
  cityId?: string;
}
export interface ListPlacesResponse {
  places: PlaceSummary[];
}

/** For a map marker: the place and its recommendations. */
export interface GetPlaceRequest {
  placeId: PlaceId;
}
export interface GetPlaceResponse {
  place: PlaceSummary;
  recommendations: RecommendationView[];
}

export interface GetFeedRequest {
  city: string;
  cityId?: string;
  limit?: number;
}
export interface GetFeedResponse {
  items: RecommendationView[];
}

export interface SearchRecommendationsRequest {
  text: string;
  interests: string[];
  city: string;
  cityId?: string;
  limit?: number;
}
/** Exact matches come first, then broader matches. Each says why it matched. */
export interface SearchRecommendationsResponse {
  results: SearchResult[];
}

// ---------- Social recommendations ----------

export interface CreateRecommendationRequest {
  placeId: PlaceId;
  description: string; // must be nonempty
  tags: string[];
  visitDate?: string; // YYYY-MM-DD
  sourceLinks?: string[]; // external links only
}
export interface CreateRecommendationResponse {
  recommendation: RecommendationView;
}

// ---------- Saved places ----------

/**
 * One saved entry per user and place. Saving another recommendation for a
 * place you already saved attaches it as a source and keeps your note.
 */
export interface SavePlaceRequest {
  placeId: PlaceId;
  recommendationId?: RecommendationId; // the recommendation that led to the save
}
export interface SavePlaceResponse {
  saved: SavedPlaceView;
}

export interface ListSavedPlacesRequest {
  // no fields
}
export interface ListSavedPlacesResponse {
  saved: SavedPlaceView[];
}

export interface UpdateSavedNoteRequest {
  placeId: PlaceId;
  personalNote: string;
}
export interface UpdateSavedNoteResponse {
  saved: SavedPlaceView;
}

export interface RemoveSavedRecommendationRequest {
  placeId: PlaceId;
  recommendationId: RecommendationId;
}

export interface RemoveSavedPlaceRequest {
  placeId: PlaceId;
}
export interface RemoveSavedPlaceResponse {
  removed: true;
}

// ---------- Trips ----------

export interface CreateTripRequest {
  city: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;
  dailyWindow: { start: string; end: string }; // "09:00" to "21:00"
  startingPoints?: StartingPoint[];
}
export interface CreateTripResponse {
  trip: TripView;
}

export interface ListTripsRequest {
  includeScheduledPlaces?: boolean;
}
export interface ListTripsResponse {
  trips: TripSummary[];
}

export interface GetTripRequest {
  tripId: TripId;
}
export interface GetTripResponse {
  trip: TripView;
}

export interface DeleteTripRequest {
  tripId: TripId;
  expectedRevision: number;
}

/** Adding a candidate does not schedule it. Does not need expectedRevision. */
export interface AddCandidateRequest {
  tripId: TripId;
  placeId: PlaceId;
  recommendationIds?: RecommendationId[];
}
export interface AddCandidateResponse {
  trip: TripView;
}

export interface RemoveCandidateRequest {
  tripId: TripId;
  placeId: PlaceId;
}
export interface RemoveCandidateResponse {
  trip: TripView;
}

// ---------- Scheduled stops (all need expectedRevision) ----------
// Send the revision you loaded. If the trip changed since then, the save is
// refused with 'aborted' and nothing changes. Success returns the trip with a new revision.

export interface AddStopRequest {
  tripId: TripId;
  expectedRevision: number;
  placeId: PlaceId;
  recommendationIds?: RecommendationId[];
  day: number; // 1-based
  order?: number; // 1 is first in the day; omit to append
  visitMinutes: number;
  startTime?: string | null; // "HH:mm" (24-hour); omit or null for an untimed stop
}
export interface AddStopResponse {
  trip: TripView;
}

export interface AddFixedActivityRequest {
  tripId: TripId;
  expectedRevision: number;
  day: number;
  title: string;
  startTime: string;
  visitMinutes: number;
}

export interface ApplyItineraryRequest {
  tripId: TripId;
  expectedRevision: number;
  placeIds: PlaceId[];
  strategy: 'earlier' | 'later';
}

export interface MoveStopRequest {
  tripId: TripId;
  expectedRevision: number;
  stopId: TripStopId;
  day: number;
  order: number;
}
export interface MoveStopResponse {
  trip: TripView;
}

export interface RemoveStopRequest {
  tripId: TripId;
  expectedRevision: number;
  stopId: TripStopId;
}
export interface RemoveStopResponse {
  trip: TripView;
}

// Sets when a stop starts and how long it lasts. startTime is "HH:mm" (24-hour),
// or null to leave the stop untimed. The stop must end by midnight.
export interface UpdateStopTimeRequest {
  tripId: TripId;
  expectedRevision: number;
  stopId: TripStopId;
  startTime: string | null;
  visitMinutes: number;
  // Calendar placement rejects overlaps with any timed activity.
  requireOpenSlot?: boolean;
}
export interface UpdateStopTimeResponse {
  trip: TripView;
}

export interface UpdateStopDetailsRequest {
  tripId: TripId;
  expectedRevision: number;
  stopId: TripStopId;
  isRequired?: boolean;
  cost?: KnownCost | null;
}

export interface StopPreparationRequest {
  tripId: TripId;
  stopId: TripStopId;
}

export interface SavePreparationRequest extends StopPreparationRequest {
  taskId?: string;
  title: string;
  bookingUrl: string | null;
  deadline: string | null;
  completed: boolean;
  reviewSchedule?: boolean;
}

export interface PlaceJournalResponse {
  visited: { place: PlaceSummary; visitDate: string }[];
  rankings: Ranking[];
}

// ---------- The contract ----------

/**
 * Maps each function name to its request and response. ApiClient uses
 * this so a call like callApi('savePlace', {...}) is type-checked end to end.
 */
export interface ApiContract {
  removeSavedRecommendation: {
    request: RemoveSavedRecommendationRequest;
    response: SavePlaceResponse;
  };
  searchCities: {
    request: SearchCitiesRequest;
    response: SearchCitiesResponse;
  };
  ensureProfile: {
    request: EnsureProfileRequest;
    response: EnsureProfileResponse;
  };
  getProfile: { request: GetProfileRequest; response: GetProfileResponse };
  updateProfile: {
    request: UpdateProfileRequest;
    response: UpdateProfileResponse;
  };
  resolveCity: { request: ResolveCityRequest; response: ResolveCityResponse };
  listPlaces: { request: ListPlacesRequest; response: ListPlacesResponse };
  getPlace: { request: GetPlaceRequest; response: GetPlaceResponse };
  getFeed: { request: GetFeedRequest; response: GetFeedResponse };
  searchRecommendations: {
    request: SearchRecommendationsRequest;
    response: SearchRecommendationsResponse;
  };
  createRecommendation: {
    request: CreateRecommendationRequest;
    response: CreateRecommendationResponse;
  };
  savePlace: { request: SavePlaceRequest; response: SavePlaceResponse };
  listSavedPlaces: {
    request: ListSavedPlacesRequest;
    response: ListSavedPlacesResponse;
  };
  updateSavedNote: {
    request: UpdateSavedNoteRequest;
    response: UpdateSavedNoteResponse;
  };
  removeSavedPlace: {
    request: RemoveSavedPlaceRequest;
    response: RemoveSavedPlaceResponse;
  };
  createTrip: { request: CreateTripRequest; response: CreateTripResponse };
  listTrips: { request: ListTripsRequest; response: ListTripsResponse };
  getTrip: { request: GetTripRequest; response: GetTripResponse };
  deleteTrip: { request: DeleteTripRequest; response: { deleted: true } };
  addCandidate: {
    request: AddCandidateRequest;
    response: AddCandidateResponse;
  };
  removeCandidate: {
    request: RemoveCandidateRequest;
    response: RemoveCandidateResponse;
  };
  addStop: { request: AddStopRequest; response: AddStopResponse };
  addFixedActivity: {
    request: AddFixedActivityRequest;
    response: AddStopResponse;
  };
  applyItinerary: { request: ApplyItineraryRequest; response: AddStopResponse };
  moveStop: { request: MoveStopRequest; response: MoveStopResponse };
  removeStop: { request: RemoveStopRequest; response: RemoveStopResponse };
  updateStopTime: {
    request: UpdateStopTimeRequest;
    response: UpdateStopTimeResponse;
  };
  updateStopDetails: {
    request: UpdateStopDetailsRequest;
    response: AddStopResponse;
  };
  listPreparation: {
    request: StopPreparationRequest;
    response: { tasks: PreparationTask[] };
  };
  savePreparation: {
    request: SavePreparationRequest;
    response: { task: PreparationTask };
  };
  removePreparation: {
    request: StopPreparationRequest & { taskId: string };
    response: { deleted: true };
  };
  getPlaceJournal: {
    request: Record<string, never>;
    response: PlaceJournalResponse;
  };
  markVisited: {
    request: { placeId: PlaceId; visitDate: string };
    response: { visit: Visit };
  };
  saveRanking: {
    request: { category: string; placeIds: PlaceId[] };
    response: PlaceJournalResponse;
  };
}

export type ApiFunctionName = keyof ApiContract;
export type ApiRequest<K extends ApiFunctionName> = ApiContract[K]['request'];
export type ApiResponse<K extends ApiFunctionName> = ApiContract[K]['response'];
