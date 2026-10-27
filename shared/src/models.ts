/**
 * Shared data types for every Firestore collection in Roami.
 * Dates are ISO strings ("2026-10-26T14:30:00Z"); day-only dates are
 * "YYYY-MM-DD"; times of day are "HH:mm". Repositories convert to and
 * from Firestore timestamps, so this file never depends on Firebase.
 */

export type UserId = string;
export type PlaceId = string;
export type RecommendationId = string;
export type TripId = string;
export type TripStopId = string;
export type CollectionId = string;
export type CommentId = string;
export type ReportId = string;

export const COLLECTIONS = {
  users: 'users',
  places: 'places',
  recommendations: 'recommendations',
  savedPlaces: 'savedPlaces',
  trips: 'trips',
  tripStops: 'tripStops',
  tripShares: 'tripShares',
  rankings: 'rankings',
  follows: 'follows',
  likes: 'likes',
  collections: 'collections',
  comments: 'comments',
  preparationTasks: 'preparationTasks',
  visits: 'visits',
  reports: 'reports',
  blocks: 'blocks',
} as const;

export type ModerationStatus = 'active' | 'hidden' | 'removed';

/** Where a piece of data came from, so missing info can be labeled. */
export interface DataSource {
  provider: 'osm' | 'manual';
  providerId: string | null; // e.g. the OpenStreetMap ID, used to avoid duplicate imports
  retrievedAt: string;
}

// 1. Accounts and Profiles
export interface User {
  id: UserId; // same as the Firebase Auth uid
  name: string;
  bio: string;
  interests: string[];
  createdAt: string;
}

// 9. Place data (catalog)
export interface Place {
  id: PlaceId;
  name: string;
  latitude: number;
  longitude: number;
  category: string;
  openingHours: string | null; // null means unknown, not "closed"
  missingFields: string[]; // e.g. ["openingHours"]
  source: DataSource;
  updatedAt: string;
}

// 3. Social recommendations
export interface Recommendation {
  id: RecommendationId;
  authorId: UserId;
  placeId: PlaceId;
  description: string;
  tags: string[];
  visitDate: string | null;
  sourceLinks: string[]; // linked videos stay external references
  moderationStatus: ModerationStatus;
  createdAt: string;
}

export interface Collection {
  id: CollectionId;
  ownerId: UserId;
  title: string;
  placeIds: PlaceId[];
  recommendationIds: RecommendationId[];
  isPublished: boolean;
  createdAt: string;
}

export interface Follow {
  followerId: UserId;
  followeeId: UserId;
  createdAt: string;
}

export interface Like {
  userId: UserId;
  recommendationId: RecommendationId;
  createdAt: string;
}

export interface Comment {
  id: CommentId;
  authorId: UserId;
  targetType: 'recommendation' | 'place';
  targetId: string;
  text: string;
  parentCommentId: CommentId | null;
  isQuestion: boolean;
  replyPlaceId: PlaceId | null; // a reply can point to a place
  moderationStatus: ModerationStatus;
  createdAt: string;
}

// 4. Saved places and trips
/** Document ID is `${userId}_${placeId}`, so there is one entry per user and place. */
export interface SavedPlace {
  id: string;
  userId: UserId;
  placeId: PlaceId;
  recommendationIds: RecommendationId[]; // every recommendation that led to this save
  personalNote: string;
  createdAt: string;
}

export interface StartingPoint {
  label: string;
  latitude: number;
  longitude: number;
}

export interface Trip {
  id: TripId;
  ownerId: UserId;
  city: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;
  dailyWindow: { start: string; end: string }; // "09:00" to "21:00"
  startingPoints: StartingPoint[];
  candidatePlaceIds: PlaceId[]; // candidates are not scheduled until they become stops
  revision: number; // increases on every saved change, to detect outdated edits
  createdAt: string;
  updatedAt: string;
}

// 5. Itinerary stops
export interface TripStop {
  id: TripStopId;
  tripId: TripId;
  placeId: PlaceId | null; // null for a fixed commitment that isn't a catalog place
  title: string | null; // used for fixed commitments such as a reservation
  recommendationIds: RecommendationId[];
  day: number; // 1-based day of the trip
  order: number; // position within the day
  startTime: string | null; // "HH:mm"
  visitMinutes: number;
  walkingMinutesFromPrevious: number | null; // null means unavailable, never zero
  isFixed: boolean; // fixed commitment, never moved by the planner
  isRequired: boolean; // required stop, always kept in the plan
  warnings: string[];
}

/** Document ID is the trip ID. Viewers get read-only access. */
export interface TripShare {
  tripId: TripId;
  viewerIds: UserId[];
}

export interface PreparationTask {
  id: string;
  tripStopId: TripStopId;
  title: string;
  bookingUrl: string | null; // links go to external sites; Roami handles no purchases
  source: string | null;
  deadline: string | null;
  needsReview: boolean; // set when the stop changes
}

// 6. Visits and rankings
export interface Visit {
  id: string;
  userId: UserId;
  placeId: PlaceId;
  visitDate: string;
}

/** Document ID is `${userId}_${category}`. Each place appears once per category. */
export interface Ranking {
  id: string;
  userId: UserId;
  category: string;
  placeIds: PlaceId[]; // best first
}

// 7. Safety and moderation
export type ReportStatus = 'open' | 'reviewed' | 'actioned' | 'dismissed';

export interface Report {
  id: ReportId;
  reporterId: UserId;
  contentType: 'recommendation' | 'comment' | 'user';
  contentId: string;
  reason: string;
  status: ReportStatus;
  reviewedBy: UserId | null;
  createdAt: string;
}

export interface Block {
  userId: UserId;
  blockedUserId: UserId;
  createdAt: string;
}