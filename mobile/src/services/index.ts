import { registerLiveHandlers } from '../api';

import { listPlaces } from './PlaceService';

/**
 * Called once at app startup. Each service registered here replaces its fixture
 * when EXPO_PUBLIC_API_MODE=live. Keep one line per service so teammates adding
 * services don't conflict with each other.
 */
export function registerServices(): void {
  registerLiveHandlers({
    listPlaces,
  });
}
