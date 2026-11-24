import { registerLiveHandlers } from '../api';
import { searchCities } from '../cities/citySearch';

import { getPlaceJournal, markVisited, saveRanking } from './JournalService';
import { listPreparation, savePreparation, removePreparation } from './PreparationService';
import { getFeed } from './DiscoveryService';
import { getPlace, listPlaces, resolveCity } from './PlaceService';
import { followUser, getFollowing, unfollowUser } from './FollowService';
import { ensureProfile, getProfile, updateProfile } from './ProfileService';
import { createRecommendation } from './RecommendationService';
import {
  addFixedActivity,
  addStop,
  applyItinerary,
  moveStop,
  removeStop,
  updateStopTime,
  updateStopDetails,
} from './RevisionService';
import {
  removeSavedRecommendation,
  listSavedPlaces,
  removeSavedPlace,
  restoreSavedPlace,
  savePlace,
  updateSavedNote,
} from './SaveService';
import { searchRecommendations } from './SearchService';
import {
  addCandidate,
  createTrip,
  deleteTrip,
  getTrip,
  listTrips,
  removeCandidate,
  setTripArchived,
} from './TripService';

/**
 * Called once at app startup. Each service registered here replaces its fixture
 * when EXPO_PUBLIC_API_MODE=live. Keep one line per service so teammates adding
 * services don't conflict with each other.
 */
export function registerServices(): void {
  registerLiveHandlers({
    searchCities,
    resolveCity,
    listPlaces,
    ensureProfile,
    getProfile,
    updateProfile,
    getPlace,
    getFeed,
    getFollowing,
    followUser,
    unfollowUser,
    searchRecommendations,
    createRecommendation,
    savePlace,
    listSavedPlaces,
    updateSavedNote,
    removeSavedPlace,
    removeSavedRecommendation,
    restoreSavedPlace,
    createTrip,
    listTrips,
    setTripArchived,
    getTrip,
    deleteTrip,
    addCandidate,
    removeCandidate,
    addStop,
    addFixedActivity,
    applyItinerary,
    moveStop,
    removeStop,
    updateStopTime,
    updateStopDetails,
    listPreparation,
    savePreparation,
    removePreparation,
    getPlaceJournal,
    markVisited,
    saveRanking,
  });
}
