import type {
  PlaceId,
  PlacePhoto,
  KnownCost,
  RecommendationId,
  StartingPoint,
  Trip,
  TripStop,
  UserId,
} from "./models";

/** How a search term matched. 'broader' means related, not exact (e.g. "live music" for "jazz"). */
export type MatchKind = "exact" | "synonym" | "prefix" | "broader";

export interface MatchReason {
  kind: MatchKind;
  term: string; // what the user searched for
  matched: string; // the tag or text that matched
  source: "tag" | "text";
}

/** Public profile. Never contains email or other private data. */
export interface PublicUser {
  id: UserId;
  name: string;
  bio: string;
  interests: string[];
}

export interface AuthorSummary {
  id: UserId;
  name: string;
}

export interface CityLocation {
  id: string;
  name: string;
  region: string;
  country: string;
  latitude: number;
  longitude: number;
}

export interface PlaceSummary {
  id: PlaceId;
  name: string;
  city?: string; // Older catalog records may not include a city.
  latitude: number;
  longitude: number;
  category: string;
  openingHours: string | null; // null means unknown, not closed
  openingHoursSource?: { url: string; checkedAt: string }; // reviewed source URL and YYYY-MM-DD snapshot date
  photos?: PlacePhoto[];
  address?: string | null;
  website?: string | null;
  ticketUrl?: string | null;
  cost?: KnownCost;
  missingFields: string[];
}

/**
 * A recommendation as shown to a viewer. If it was removed, status is
 * 'unavailable' and description, tags, and sourceLinks are empty. Saved
 * places and trips that reference it stay intact.
 */
export interface RecommendationView {
  id: RecommendationId;
  status: "available" | "unavailable";
  place: PlaceSummary;
  author: AuthorSummary | null; // null when unavailable
  description: string;
  tags: string[];
  visitDate: string | null;
  sourceLinks: string[];
  createdAt: string;
}

export interface SearchResult {
  recommendation: RecommendationView;
  matchLevel: "exact" | "broader";
  reasons: MatchReason[]; // why it matched, shown in the UI
}

export interface SavedPlaceView {
  place: PlaceSummary;
  recommendations: RecommendationView[]; // every recommendation that led to this save
  personalNote: string;
  createdAt: string;
}

export interface TripSummary {
  id: string;
  city: string;
  startDate: string;
  endDate: string;
  candidateCount: number;
  stopCount: number;
  scheduledPlaces?: { placeId: string; day: number }[];
}

export interface TripStopView extends TripStop {
  place: PlaceSummary | null; // null for a fixed commitment that isn't a catalog place
}

/** One trip with everything the list, map, and day views need. */
export interface TripView {
  trip: Trip;
  canEdit?: boolean; // false for a shared itinerary
  candidates: PlaceSummary[]; // saved for the trip but not scheduled
  stops: TripStopView[]; // scheduled, ordered by day then order
}

export type { StartingPoint };
