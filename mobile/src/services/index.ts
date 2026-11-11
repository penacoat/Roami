import { registerLiveHandlers } from '../api';

import { getFeed } from './DiscoveryService';
import { getPlace, listPlaces } from './PlaceService';
import { ensureProfile, getProfile, updateProfile } from './ProfileService';
import { createRecommendation } from './RecommendationService';
import { addStop, moveStop, removeStop, updateStopTime } from './RevisionService';
import { listSavedPlaces, removeSavedPlace, savePlace, updateSavedNote } from './SaveService';
import { searchRecommendations } from './SearchService';
import { addCandidate, createTrip, getTrip, listTrips, removeCandidate } from './TripService';

/**
 * Called once at app startup. Each service registered here replaces its fixture
 * when EXPO_PUBLIC_API_MODE=live. Keep one line per service so teammates adding
 * services don't conflict with each other.
 */
export function registerServices(): void {
  registerLiveHandlers({
    listPlaces,
    ensureProfile,
    getProfile,
    updateProfile,
    getPlace,
    getFeed,
    searchRecommendations,
    createRecommendation,
    savePlace,
    listSavedPlaces,
    updateSavedNote,
    removeSavedPlace,
    createTrip,
    listTrips,
    getTrip,
    addCandidate,
    removeCandidate,
    addStop,
    moveStop,
    removeStop,
    updateStopTime,
  });
}
