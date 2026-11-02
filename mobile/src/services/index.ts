import { registerLiveHandlers } from '../api';

import { getFeed } from './DiscoveryService';
import { getPlace, listPlaces } from './PlaceService';
import { ensureProfile, getProfile, updateProfile } from './ProfileService';
import { addStop, moveStop, removeStop } from './RevisionService';
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
    createTrip,
    listTrips,
    getTrip,
    addCandidate,
    removeCandidate,
    addStop,
    moveStop,
    removeStop,
  });
}
