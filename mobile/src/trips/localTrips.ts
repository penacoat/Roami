import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Trip } from '../../../shared/src/models';

// Demo storage only. Replace this module with ApiClient when the trips API exists.
export async function saveLocalTrip(trip: Trip): Promise<void> {
  await AsyncStorage.setItem(`roami:trip:${trip.ownerId}:${trip.id}`, JSON.stringify(trip));
}
